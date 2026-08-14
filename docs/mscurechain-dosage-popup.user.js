// ==UserScript==
// @name         MSCureChain — Dosage Timing Popup before Save & Print
// @namespace    dhruva-pharmacy
// @version      2.8
// @description  When mobile no. is filled, ask Morning/Afternoon/Night + course days per medicine, capturing hospital/doctor/patient too, and save it to DrJiva so the patient's reminders pick it up
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

  // DrJiva Supabase project — publishable/anon key only, safe to ship in browser code.
  const SUPABASE_URL      = 'https://jlvjnnltynebenflkcua.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_LXzMM6HjPlwUmbMQfqyYXw_QthfwjsU';
  // -------------------------------------------------------------

  let confirmed = false; // true only for the approved, re-fired click

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

    console.log('[dosage] medicines detected:', names);
    return names;
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

  // ---- save the bill to DrJiva (Supabase) so it turns into patient reminders ----
  // Fire-and-forget by design: printing must never wait on or be blocked by this.
  function saveToDrJiva(payload) {
    const startDate = new Date(payload.at); // course starts the day it's billed

    const body = {
      p_mobile: payload.mobile,
      p_patient_name: payload.patient || null,
      p_hospital_name: payload.hospital,
      p_doctor_name: payload.doctor || null,
      p_items: payload.items.map(function (i) {
        return { name: i.medicine, morning: i.morning, afternoon: i.afternoon, night: i.night };
      }),
      p_start_date: formatLocalDate(startDate),
      p_duration_days: payload.durationDays,
      p_day_pattern: 'daily',
    };

    fetch(SUPABASE_URL + '/rest/v1/rpc/create_hospital_medicine_course', {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: 'Bearer ' + SUPABASE_ANON_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
      .then(function (res) {
        return res.json().then(function (json) { return { ok: res.ok, json: json }; });
      })
      .then(function (result) {
        if (!result.ok) { console.error('[dosage] DrJiva save failed:', result.json); return; }
        console.log('[dosage] DrJiva save ok:', result.json);
        if (result.json && result.json.skipped && result.json.skipped.length) {
          console.warn('[dosage] medicines skipped (not matched in catalog):', result.json.skipped);
        }
      })
      .catch(function (err) {
        console.error('[dosage] DrJiva save error (print still proceeds):', err);
      });
  }

  // ---- the popup ----
  function showPopup(saveBtn, mobile) {
    if (document.getElementById('dose-overlay')) return;
    const meds  = getMedicines();
    const state = meds.map(n => ({ medicine: n, Morning: false, Afternoon: false, Night: false }));

    const overlay = document.createElement('div');
    overlay.id = 'dose-overlay';
    overlay.style.cssText =
      'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:2147483647;' +
      'display:flex;align-items:center;justify-content:center;font-family:system-ui,sans-serif;';

    const box = document.createElement('div');
    box.style.cssText =
      'background:#fff;border-radius:20px;padding:24px;width:560px;max-width:94vw;' +
      'max-height:88vh;overflow:auto;box-shadow:0 20px 60px rgba(0,0,0,.3);';
    box.innerHTML =
      '<h2 style="margin:0 0 2px;font-size:20px;color:#0f766e;">Dosage Timing</h2>' +
      '<p style="margin:0 0 16px;font-size:13px;color:#666;">Tap when each medicine is taken' +
        (mobile ? ' &nbsp;·&nbsp; Mobile: ' + mobile : '') + '</p>' +
      '<div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;padding:10px 12px;' +
        'border:1px solid #eee;border-radius:12px;">' +
        '<label for="dose-days" style="font-size:13px;font-weight:700;color:#374151;">Course duration (days)</label>' +
        '<input id="dose-days" type="number" min="1" max="365" value="' + DEFAULT_COURSE_DAYS + '" ' +
          'style="width:70px;padding:6px 8px;border:1.5px solid #d1d5db;border-radius:8px;font-size:14px;' +
          'margin-left:auto;" />' +
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
        'padding:7px 14px;border-radius:10px;font-size:12px;font-weight:700;cursor:pointer;transition:all .12s;' +
        (on
          ? 'background:' + c + ';color:#fff;border:1.5px solid ' + c + ';'
          : 'background:#fff;color:#374151;border:1.5px solid #d1d5db;');
    }

    meds.forEach(function (name, i) {
      const item = state[i];
      const row = document.createElement('div');
      row.style.cssText =
        'display:flex;align-items:center;justify-content:space-between;gap:12px;' +
        'padding:10px 12px;border:1px solid #eee;border-radius:12px;margin-bottom:8px;';

      const label = document.createElement('div');
      label.textContent = (i + 1) + '. ' + name;
      label.style.cssText = 'font-size:14px;font-weight:600;color:#222;flex:1;';

      const toggles = document.createElement('div');
      toggles.style.cssText = 'display:flex;gap:6px;flex-shrink:0;';

      TIMES.forEach(function (t) {
        const c = TIME_COLORS[t];
        const chip = document.createElement('button');
        chip.dataset.on = '0';
        styleChip(chip, c, false, t);
        chip.onclick = function () {
          const on = chip.dataset.on !== '1';
          chip.dataset.on = on ? '1' : '0';
          styleChip(chip, c, on, t);
          item[t] = on;
        };
        toggles.appendChild(chip);
      });

      row.appendChild(label);
      row.appendChild(toggles);
      host.appendChild(row);
    });

    // clicking the dark overlay does nothing — popup stays until Confirm & Print

    box.querySelector('#dose-ok').onclick = function () {
      const daysInput = box.querySelector('#dose-days');
      let durationDays = parseInt(daysInput && daysInput.value, 10);
      if (!Number.isFinite(durationDays) || durationDays < 1) durationDays = DEFAULT_COURSE_DAYS;
      if (durationDays > 365) durationDays = 365;

      const payload = {
        hospital: HOSPITAL_NAME,
        patient:  getVal(PATIENT_SELECTOR),
        mobile:   mobile,
        doctor:   getVal(DOCTOR_SELECTOR),
        at: new Date().toISOString(),
        durationDays: durationDays,
        items: state.map(s => ({ medicine: s.medicine, morning: s.Morning, afternoon: s.Afternoon, night: s.Night }))
      };
      localStorage.setItem('mscurechain_last_schedule', JSON.stringify(payload));
      console.log('[dosage] captured:', payload);

      try {
        saveToDrJiva(payload);
      } catch (err) {
        console.error('[dosage] DrJiva save threw (print still proceeds):', err);
      }

      close();
      confirmed = true;
      const fresh = Array.from(document.querySelectorAll('button'))
        .find(b => (b.textContent || '').trim().toLowerCase().includes(SAVE_BTN_TEXT)) || saveBtn;
      fresh.click(); // let the real Save & Print run
    };
  }

  function close() {
    const o = document.getElementById('dose-overlay');
    if (o) o.remove();
  }
})();
