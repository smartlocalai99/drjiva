// ==UserScript==
// @name         MSCureChain — Dosage Timing Popup before Save & Print
// @namespace    dhruva-pharmacy
// @version      3.1
// @description  When mobile no. is filled, ask Morning/Afternoon/Night + per-medicine course days, capturing hospital/doctor/patient too, and save it to DrJiva so the patient's reminders pick it up
// @match        https://www.mscurechain.com/*
// @match        https://mscurechain.com/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  // ---------- CONFIG (tweak if the page ever changes) ----------
  const SAVE_BTN_TEXT       = 'save & print';
  const MOBILE_SELECTOR     = 'input[placeholder*="digit" i]';
  const PATIENT_SELECTOR    = 'input[placeholder*="enter name" i]';   // "Enter name..."
  const DOCTOR_SELECTOR     = 'input[placeholder*="walk" i]';         // "Self / Walk-in"
  const HOSPITAL_NAME       = 'Dhruva Hospitals';                     // static — change if needed
  const TIMES               = ['Morning', 'Afternoon', 'Night'];
  const TIME_COLORS         = { Morning: '#16a34a', Afternoon: '#dc2626', Night: '#2563eb' }; // green / red / blue
  const DEFAULT_COURSE_DAYS = 5;
  const SAVE_TIMEOUT_MS     = 8000;  // never hold up printing longer than this

  // DrJiva Supabase project — publishable/anon key only, safe to ship in browser code.
  const SUPABASE_URL      = 'https://jlvjnnltynebenflkcua.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_LXzMM6HjPlwUmbMQfqyYXw_QthfwjsU';

  // Non-medicine cart items (surgical supplies, fees, etc.) — never show these
  // in the popup, never ask timing for them. Kept in sync with the same list
  // in create_hospital_medicine_course; anything your team marks "Not a
  // medicine" in Triage is fetched live below and skipped too.
  const BUILTIN_NON_MEDICINE_TERMS = [
    'registration fee', 'consultation fee', 'admission fee', 'room rent',
    'nursing charge', 'procedure charge', 'lab charge', 'surgical gloves',
    'hand gloves', 'cotton roll', 'bandage', 'gauze', 'syringe', 'needle',
    'iv set', 'cannula', 'apron', 'sanitizer',
  ];
  // -------------------------------------------------------------

  let confirmed = false; // true only for the approved, re-fired click

  // Fetched once at page load, best-effort — if it's not back in time for the
  // first click, that click just falls back to the built-in list only.
  let ignoredNamesPromise = fetch(
    SUPABASE_URL + '/rest/v1/rpc/list_ignored_hospital_medicine_names',
    {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: 'Bearer ' + SUPABASE_ANON_KEY,
        'Content-Type': 'application/json',
      },
      body: '{}',
    },
  )
    .then(function (res) { return res.ok ? res.json() : []; })
    .catch(function () { return []; });
  let ignoredNamesCache = [];
  ignoredNamesPromise.then(function (list) { ignoredNamesCache = list || []; });

  function normalizeName(name) {
    return (name || '').trim().toLowerCase().replace(/\s+/g, ' ');
  }

  function isNonMedicineName(name) {
    const normalized = normalizeName(name);
    if (ignoredNamesCache.indexOf(normalized) !== -1) return true;
    return BUILTIN_NON_MEDICINE_TERMS.some(function (term) {
      return normalized.indexOf(term) !== -1;
    });
  }

  document.addEventListener('click', function (e) {
    const btn = e.target.closest('button');
    if (!btn) return;
    if (!(btn.textContent || '').trim().toLowerCase().includes(SAVE_BTN_TEXT)) return;

    if (confirmed) { confirmed = false; return; } // approved re-click passes through

    // GATE: only intercept if a mobile number is present
    const mobile = getVal(MOBILE_SELECTOR, true);     // true -> return null if field missing
    const hasMobile = mobile === null ? true          // can't find field -> show anyway (+warn)
                                      : mobile.length > 0;
    if (!hasMobile) return;                            // empty -> normal print, no popup

    e.preventDefault();
    e.stopImmediatePropagation();
    showPopup(btn, mobile || '');
  }, true); // capture phase = we run before the site

  // read a form field's value; if warnIfMissing, returns null (not '') when not found
  function getVal(sel, warnIfMissing) {
    const el = document.querySelector(sel) || document.querySelector('input[type="tel"]');
    if (!el) { if (warnIfMissing) console.warn('[dosage] field not found:', sel); return warnIfMissing ? null : ''; }
    return (el.value || '').trim();
  }

  // YYYY-MM-DD in the browser's local time (avoids UTC day-shift from toISOString)
  function formatLocalDate(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }

  // ---- read medicines from the ACTIVE CART ----
  function getMedicines() {
    const names = [];
    const delBtns = Array.from(document.querySelectorAll('button'))
      .filter(b => b.querySelector('svg[class*="trash"]'));

    delBtns.forEach(function (b) {
      const row = findRow(b);
      if (!row) return;
      let name = '';
      Array.from(row.children).forEach(function (cell) {
        if (cell.querySelector('button') || cell.querySelector('input')) return; // skip qty/action
        const t = (cell.textContent || '').replace(/\s+/g, ' ').trim();
        if (!t || /₹/.test(t) || /^[0-9]+$/.test(t)) return;                      // skip price/serial
        if (/[A-Za-z]{2,}/.test(t) && t.length > name.length) name = t;           // keep the name cell
      });
      if (name) names.push(name);
    });

    const filtered = names.filter(function (n) { return !isNonMedicineName(n); });
    console.log('[dosage] medicines detected:', filtered, '(non-medicine items hidden:', names.filter(function (n) { return isNonMedicineName(n); }), ')');
    return filtered;
  }

  function findRow(btn) {
    const tr = btn.closest('tr');
    if (tr) return tr;
    let el = btn.parentElement, guard = 0;
    while (el && guard < 10) {
      if (el.children.length >= 3 && /₹/.test(el.textContent)) return el;
      el = el.parentElement; guard++;
    }
    return null;
  }

  // ---- save one batch of medicines that share the same course length ----
  // The RPC takes a single p_duration_days, so medicines with different day
  // counts are sent as separate calls (grouped by days).
  function saveBatchToDrJiva(payload, days, items) {
    const body = {
      p_mobile: payload.mobile,
      p_patient_name: payload.patient || null,
      p_hospital_name: payload.hospital,
      p_doctor_name: payload.doctor || null,
      p_items: items.map(function (i) {
        return { name: i.medicine, morning: i.morning, afternoon: i.afternoon, night: i.night };
      }),
      p_start_date: formatLocalDate(new Date(payload.at)),
      p_duration_days: days,
      p_day_pattern: 'daily',
    };

    console.log('[dosage] sending batch (' + days + ' days):', body);

    return fetch(SUPABASE_URL + '/rest/v1/rpc/create_hospital_medicine_course', {
      method: 'POST',
      keepalive: true,
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: 'Bearer ' + SUPABASE_ANON_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
      .then(function (res) {
        return res.text().then(function (text) {
          let json = null;
          try { json = text ? JSON.parse(text) : null; } catch (e) { json = text; }
          return { ok: res.ok, status: res.status, json: json };
        });
      })
      .then(function (result) {
        if (!result.ok) {
          console.error('[dosage] batch FAILED (' + days + ' days):', result.status, result.json);
          return { ok: false, error: 'HTTP ' + result.status + ' — ' + JSON.stringify(result.json), skipped: [] };
        }
        console.log('[dosage] batch ok (' + days + ' days):', result.json);
        const skipped = (result.json && result.json.skipped) || [];
        if (skipped.length) console.warn('[dosage] not matched in catalog:', skipped);
        return { ok: true, skipped: skipped };
      })
      .catch(function (err) {
        console.error('[dosage] batch ERROR (' + days + ' days):', err);
        return { ok: false, error: String(err && err.message ? err.message : err), skipped: [] };
      });
  }

  // group by days -> one RPC call per distinct duration
  function saveToDrJiva(payload) {
    const groups = {};
    payload.items.forEach(function (i) {
      const d = String(i.days);
      if (!groups[d]) groups[d] = [];
      groups[d].push(i);
    });

    const calls = Object.keys(groups).map(function (d) {
      return saveBatchToDrJiva(payload, parseInt(d, 10), groups[d]);
    });

    if (!calls.length) return Promise.resolve({ ok: true, skipped: [] });

    return Promise.all(calls).then(function (results) {
      const failed = results.filter(function (r) { return !r.ok; });
      const skipped = results.reduce(function (acc, r) { return acc.concat(r.skipped || []); }, []);
      if (failed.length) {
        return { ok: false, error: failed.map(function (f) { return f.error; }).join(' | '), skipped: skipped };
      }
      return { ok: true, skipped: skipped };
    });
  }

  // small non-blocking toast so failures are visible at the counter
  function toast(message, isError) {
    const t = document.createElement('div');
    t.textContent = message;
    t.style.cssText =
      'position:fixed;top:18px;left:50%;transform:translateX(-50%);z-index:2147483647;' +
      'padding:12px 18px;border-radius:12px;font-family:system-ui,sans-serif;font-size:13px;' +
      'font-weight:600;box-shadow:0 8px 24px rgba(0,0,0,.25);max-width:80vw;' +
      (isError ? 'background:#dc2626;color:#fff;' : 'background:#0d9488;color:#fff;');
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, isError ? 8000 : 3000);
  }

  // ---- the popup ----
  function showPopup(saveBtn, mobile) {
    if (document.getElementById('dose-overlay')) return;
    const meds  = getMedicines();
    const state = meds.map(function (n) {
      return { medicine: n, Morning: false, Afternoon: false, Night: false, days: DEFAULT_COURSE_DAYS };
    });

    const overlay = document.createElement('div');
    overlay.id = 'dose-overlay';
    overlay.style.cssText =
      'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:2147483647;' +
      'display:flex;align-items:center;justify-content:center;font-family:system-ui,sans-serif;';

    const box = document.createElement('div');
    box.style.cssText =
      'background:#fff;border-radius:20px;padding:24px;width:620px;max-width:94vw;' +
      'max-height:88vh;overflow:auto;box-shadow:0 20px 60px rgba(0,0,0,.3);';
    box.innerHTML =
      '<h2 style="margin:0 0 2px;font-size:20px;color:#0f766e;">Dosage Timing</h2>' +
      '<p style="margin:0 0 16px;font-size:13px;color:#666;">Tap when each medicine is taken, and set its course days' +
        (mobile ? ' &nbsp;·&nbsp; Mobile: ' + mobile : '') + '</p>' +
      '<div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;padding:10px 12px;' +
        'border:1px solid #eee;border-radius:12px;background:#f9fafb;">' +
        '<label for="dose-all-days" style="font-size:13px;font-weight:700;color:#374151;">Set all to (days)</label>' +
        '<input id="dose-all-days" type="number" min="1" max="365" value="' + DEFAULT_COURSE_DAYS + '" ' +
          'style="width:70px;padding:6px 8px;border:1.5px solid #d1d5db;border-radius:8px;font-size:14px;' +
          'margin-left:auto;" />' +
        '<button id="dose-apply-all" type="button" style="padding:6px 12px;border-radius:8px;border:1.5px solid #0d9488;' +
          'background:#fff;color:#0d9488;font-weight:700;font-size:12px;cursor:pointer;">Apply</button>' +
      '</div>' +
      '<div id="dose-rows"></div>' +
      '<div style="display:flex;gap:10px;justify-content:flex-end;margin-top:18px;">' +
        '<button id="dose-ok" style="padding:10px 20px;border-radius:12px;border:none;' +
          'background:#0d9488;color:#fff;font-weight:700;font-size:14px;cursor:pointer;">Confirm &amp; Print</button>' +
      '</div>';

    overlay.appendChild(box);
    document.body.appendChild(overlay);

    const host = box.querySelector('#dose-rows');
    if (!meds.length) {
      host.innerHTML =
        '<div style="padding:12px;border:1px dashed #d33;border-radius:10px;color:#b00;font-size:13px;">' +
        'No medicines detected in the cart.</div>';
    }

    // OFF = plain button; ON = filled with its colour
    function styleChip(chip, c, on, label) {
      chip.textContent = label;
      chip.style.cssText =
        'padding:7px 12px;border-radius:10px;font-size:12px;font-weight:700;cursor:pointer;transition:all .12s;' +
        (on
          ? 'background:' + c + ';color:#fff;border:1.5px solid ' + c + ';'
          : 'background:#fff;color:#374151;border:1.5px solid #d1d5db;');
    }

    const dayInputs = [];

    meds.forEach(function (name, i) {
      const item = state[i];
      const row = document.createElement('div');
      row.style.cssText =
        'display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;' +
        'padding:10px 12px;border:1px solid #eee;border-radius:12px;margin-bottom:8px;';

      const label = document.createElement('div');
      label.textContent = (i + 1) + '. ' + name;
      label.style.cssText = 'font-size:14px;font-weight:600;color:#222;flex:1;min-width:150px;';

      const toggles = document.createElement('div');
      toggles.style.cssText = 'display:flex;gap:6px;flex-shrink:0;';

      TIMES.forEach(function (t) {
        const c = TIME_COLORS[t];
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.dataset.on = '0';
        styleChip(chip, c, false, t);
        chip.onclick = function (ev) {
          ev.preventDefault();
          const on = chip.dataset.on !== '1';
          chip.dataset.on = on ? '1' : '0';
          styleChip(chip, c, on, t);
          item[t] = on;
        };
        toggles.appendChild(chip);
      });

      // per-medicine course days
      const daysWrap = document.createElement('div');
      daysWrap.style.cssText = 'display:flex;align-items:center;gap:6px;flex-shrink:0;';

      const daysLabel = document.createElement('span');
      daysLabel.textContent = 'days';
      daysLabel.style.cssText = 'font-size:12px;font-weight:700;color:#6b7280;';

      const daysInput = document.createElement('input');
      daysInput.type = 'number';
      daysInput.min = '1';
      daysInput.max = '365';
      daysInput.value = String(DEFAULT_COURSE_DAYS);
      daysInput.style.cssText =
        'width:62px;padding:6px 8px;border:1.5px solid #d1d5db;border-radius:8px;font-size:14px;';
      daysInput.onchange = function () {
        let v = parseInt(daysInput.value, 10);
        if (!Number.isFinite(v) || v < 1) v = DEFAULT_COURSE_DAYS;
        if (v > 365) v = 365;
        daysInput.value = String(v);
        item.days = v;
      };
      dayInputs.push(daysInput);

      daysWrap.appendChild(daysInput);
      daysWrap.appendChild(daysLabel);

      row.appendChild(label);
      row.appendChild(toggles);
      row.appendChild(daysWrap);
      host.appendChild(row);
    });

    // "Set all to" helper
    box.querySelector('#dose-apply-all').onclick = function (ev) {
      ev.preventDefault();
      let v = parseInt(box.querySelector('#dose-all-days').value, 10);
      if (!Number.isFinite(v) || v < 1) v = DEFAULT_COURSE_DAYS;
      if (v > 365) v = 365;
      dayInputs.forEach(function (inp, i) {
        inp.value = String(v);
        state[i].days = v;
      });
    };

    // clicking the dark overlay does nothing — popup stays until Confirm & Print

    const okBtn = box.querySelector('#dose-ok');
    okBtn.type = 'button';
    okBtn.onclick = function () {
      // make sure any typed-but-not-blurred value is picked up
      dayInputs.forEach(function (inp, i) {
        let v = parseInt(inp.value, 10);
        if (!Number.isFinite(v) || v < 1) v = DEFAULT_COURSE_DAYS;
        if (v > 365) v = 365;
        state[i].days = v;
      });

      const payload = {
        hospital: HOSPITAL_NAME,
        patient:  getVal(PATIENT_SELECTOR),
        mobile:   mobile,
        doctor:   getVal(DOCTOR_SELECTOR),
        at: new Date().toISOString(),
        items: state.map(function (s) {
          return {
            medicine: s.medicine,
            morning: s.Morning,
            afternoon: s.Afternoon,
            night: s.Night,
            days: s.days,
          };
        })
      };
      localStorage.setItem('mscurechain_last_schedule', JSON.stringify(payload));
      console.log('[dosage] captured:', payload);

      // lock the button so it can't be double-clicked while saving
      okBtn.disabled = true;
      okBtn.textContent = 'Saving…';
      okBtn.style.opacity = '0.7';
      okBtn.style.cursor = 'default';

      let savePromise;
      try {
        savePromise = saveToDrJiva(payload);
      } catch (err) {
        console.error('[dosage] DrJiva save threw:', err);
        savePromise = Promise.resolve({ ok: false, error: String(err), skipped: [] });
      }

      // wait for the save, but never hold printing longer than SAVE_TIMEOUT_MS
      const timeout = new Promise(function (resolve) {
        setTimeout(function () {
          resolve({ ok: false, error: 'timed out after ' + SAVE_TIMEOUT_MS + 'ms', skipped: [] });
        }, SAVE_TIMEOUT_MS);
      });

      Promise.race([savePromise, timeout]).then(function (result) {
        if (!result.ok) {
          toast('DrJiva save FAILED — reminders not created. ' + (result.error || ''), true);
        } else if (result.skipped && result.skipped.length) {
          toast('Saved, but not in catalogue: ' + result.skipped.join(', '), true);
        } else {
          toast('Saved to DrJiva ✓', false);
        }

        close();
        confirmed = true;
        const fresh = Array.from(document.querySelectorAll('button'))
          .find(b => (b.textContent || '').trim().toLowerCase().includes(SAVE_BTN_TEXT)) || saveBtn;
        fresh.click(); // let the real Save & Print run
      });
    };
  }

  function close() {
    const o = document.getElementById('dose-overlay');
    if (o) o.remove();
  }
})();
