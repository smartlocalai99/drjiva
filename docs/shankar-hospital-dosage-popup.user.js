// ==UserScript==
// @name         Harrinii (Shankar Hospital) — Dosage Timing Popup before Submit
// @namespace    shankar-pharmacy
// @version      1.1
// @description  When mobile no. is filled, ask Morning/Afternoon/Night + course days per medicine, capture hospital/doctor/patient, and save to DrJiva so the patient's reminders pick it up
// @match        http://192.168.0.113/SHANKARHOSP/*
// @all-frames   true
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  // ======================= CONFIG — FILL THESE IN =======================
  // Paste the real ASP.NET IDs here. Use the "ends-with" form: if the id is
  // ctl00_ContentPlaceHolder1_btnSubmit, write "[id$='btnSubmit']".
  // Leave a value as '' to fall back to the auto-detect heuristics below.

  const SUBMIT_BTN_ID    = "[id$='btnsave']";   // ContentPlaceHolder1_btnsave — confirmed
  const MOBILE_ID        = "[id$='txtmobile']"; // ContentPlaceHolder1_txtmobile
  const PATIENT_ID       = "[id$='txtfname']";  // first name (last name read separately)
  const PATIENT_LAST_ID  = "[id$='txtlname']";  // ContentPlaceHolder1_txtlname
  const DOCTOR_ID        = "[id$='docnm_ddl']"; // Doctor Name dropdown
  const REF_DOCTOR_ID    = "[id$='ddlrefdr']";  // Ref Doctor — used if Doctor Name is "Select"
  const CART_TABLE_ID    = "[id$='gvList']";    // ContentPlaceHolder1_gvList (the cart grid)

  // Must exactly match (or fuzzy-match) the name in DrJiva's hospitals
  // table — it's registered there as "SHANKAR GASTRO HOSPITAL", not
  // "Shankar Hospital". Using the exact name avoids any ambiguity.
  const HOSPITAL_NAME       = 'SHANKAR GASTRO HOSPITAL';
  const SUBMIT_BTN_TEXT     = 'submit'; // fallback text match if no ID given
  const TIMES                = ['Morning', 'Afternoon', 'Night'];
  const TIME_COLORS          = { Morning: '#16a34a', Afternoon: '#dc2626', Night: '#2563eb' };
  const DEFAULT_COURSE_DAYS = 5;
  const DEBUG               = true; // set false once it's working

  // DrJiva Supabase project — publishable/anon key only, safe to ship in browser code.
  const SUPABASE_URL      = 'https://jlvjnnltynebenflkcua.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_LXzMM6HjPlwUmbMQfqyYXw_QthfwjsU';

  // Non-medicine cart items (surgical supplies, fees, etc.) — never show these
  // in the popup, never ask timing for them.
  const BUILTIN_NON_MEDICINE_TERMS = [
    'registration fee', 'consultation fee', 'admission fee', 'room rent',
    'nursing charge', 'procedure charge', 'lab charge', 'surgical gloves',
    'hand gloves', 'cotton roll', 'bandage', 'gauze', 'syringe', 'needle',
    'iv set', 'cannula', 'apron', 'sanitizer',
  ];
  // =====================================================================

  let confirmed = false; // true only for the approved, re-fired click

  function log() {
    if (DEBUG) console.log.apply(console, ['[dosage]'].concat([].slice.call(arguments)));
  }

  // Fetched once at page load, best-effort.
  let ignoredNamesCache = [];
  fetch(SUPABASE_URL + '/rest/v1/rpc/list_ignored_hospital_medicine_names', {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: 'Bearer ' + SUPABASE_ANON_KEY,
      'Content-Type': 'application/json',
    },
    body: '{}',
  })
    .then(function (res) { return res.ok ? res.json() : []; })
    .catch(function () { return []; })
    .then(function (list) { ignoredNamesCache = list || []; });

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

  // ---------- field lookup helpers (ASP.NET friendly) ----------

  function pick(configSel, fallbackSels) {
    if (configSel) {
      const el = document.querySelector(configSel);
      if (el) return el;
      console.warn('[dosage] configured selector matched nothing:', configSel);
    }
    for (let i = 0; i < fallbackSels.length; i++) {
      const el = document.querySelector(fallbackSels[i]);
      if (el) return el;
    }
    return null;
  }

  function readValue(el) {
    if (!el) return '';
    if (el.tagName === 'SELECT') {
      const opt = el.options[el.selectedIndex];
      return opt ? (opt.text || '').trim() : '';
    }
    return (el.value || '').trim();
  }

  function getMobileEl() {
    return pick(MOBILE_ID, [
      "[id$='txtMobile']", "[id$='txtMobileNo']", "[id$='txtPhone']",
      "input[name*='obile' i]", "input[type='tel']",
    ]);
  }

  function getPatientName() {
    const first = readValue(pick(PATIENT_ID, ["[id$='txtfname']"]));
    const last = readValue(pick(PATIENT_LAST_ID, ["[id$='txtlname']"]));
    return (first + ' ' + last).replace(/\s+/g, ' ').trim();
  }

  function getDoctorName() {
    let doc = readValue(pick(DOCTOR_ID, ["[id$='docnm_ddl']"]));
    if (!doc || /^-?select-?$/i.test(doc)) {
      doc = readValue(pick(REF_DOCTOR_ID, ["[id$='ddlrefdr']"]));
    }
    if (!doc || /^-?select-?$/i.test(doc)) return '';
    return doc;
  }

  // ---- read medicines from the cart grid (ContentPlaceHolder1_gvList) ----
  function getCartTable() {
    if (CART_TABLE_ID) {
      const t = document.querySelector(CART_TABLE_ID);
      if (t) return t;
      log('configured cart table matched nothing yet:', CART_TABLE_ID);
    }
    // fallback: any table whose text mentions Item Name and has data rows
    const tables = Array.from(document.querySelectorAll('table'));
    return tables.find(function (t) {
      if (t.rows.length < 2) return false;
      const head = (t.rows[0].innerText || '').toLowerCase();
      return head.indexOf('item name') !== -1;
    }) || null;
  }

  function cellText(cell) {
    if (!cell) return '';
    const inner = cell.querySelector('input, select, textarea');
    if (inner) return readValue(inner);
    return (cell.innerText || cell.textContent || '').replace(/\s+/g, ' ').trim();
  }

  // things that are NOT a medicine name: dates, batch codes, pure numbers, the X/Del cell
  function looksLikeName(text) {
    if (!text) return false;
    if (!/[A-Za-z]{3,}/.test(text)) return false; // needs real letters
    if (/^\d{1,2}\/\d{1,2}\/\d{2,4}/.test(text)) return false; // 30/12/2027
    if (/^\d+$/.test(text)) return false;
    if (/^(x|del|delete|select)$/i.test(text)) return false;
    return true;
  }

  function getMedicines() {
    const table = getCartTable();
    if (!table) { console.warn('[dosage] cart table not found'); return []; }
    log('cart table:', table.id || '(no id)', 'rows =', table.rows.length);

    // locate the Item Name column from the header row, if there is one
    let nameCol = -1;
    if (table.rows.length) {
      const headCells = Array.from(table.rows[0].cells).map(function (c) {
        return (c.innerText || '').replace(/\s+/g, ' ').trim().toLowerCase();
      });
      log('header cells:', headCells);
      nameCol = headCells.findIndex(function (h) { return h.indexOf('item name') !== -1; });
      if (nameCol === -1) nameCol = headCells.findIndex(function (h) { return h.indexOf('name') !== -1; });
    }

    const names = [];
    for (let r = 0; r < table.rows.length; r++) {
      const row = table.rows[r];
      if (row.querySelector('th')) continue; // header row
      const cells = Array.from(row.cells);
      if (!cells.length) continue;

      const texts = cells.map(cellText);
      log('row', r, texts);

      let text = nameCol >= 0 ? texts[nameCol] : '';
      if (!looksLikeName(text)) {
        // fall back: first cell in the first few columns that looks like a name
        text = texts.slice(0, 6).find(looksLikeName) || '';
      }
      if (!looksLikeName(text)) continue;
      if (/item name/i.test(text)) continue; // stray header text
      names.push(text);
    }

    const filtered = names.filter(function (n) { return !isNonMedicineName(n); });
    log('medicines detected:', filtered,
      '(non-medicine hidden:', names.filter(isNonMedicineName), ')');
    return filtered;
  }

  // ---------- intercept the Submit click ----------

  function isSubmitButton(el) {
    if (!el) return false;
    if (SUBMIT_BTN_ID) {
      const target = document.querySelector(SUBMIT_BTN_ID);
      return !!target && (el === target || target.contains(el));
    }
    const label = (el.value || el.textContent || '').trim().toLowerCase();
    return label === SUBMIT_BTN_TEXT || label.indexOf(SUBMIT_BTN_TEXT) === 0;
  }

  document.addEventListener('click', function (e) {
    const btn = e.target.closest("input[type='submit'], input[type='button'], button, a[href*='__doPostBack']");
    if (!isSubmitButton(btn)) return;

    if (confirmed) { confirmed = false; return; } // approved re-click passes through

    // GATE 1: the page guards against double-submit with a hidden "submitdup"
    // counter (CheckIsRepeat reads it). Read it — never call CheckIsRepeat
    // ourselves, because it increments that counter and the page's own call on
    // the re-fired click would then refuse the save.
    const dup = document.querySelector("[id$='submitdup']");
    if (dup && Number(dup.value || 0) > 0) {
      log('bill already submitted (submitdup > 0) — no popup');
      return;
    }

    // GATE 2: only intercept if a mobile number is present
    const mobileEl = getMobileEl();
    if (!mobileEl) console.warn('[dosage] mobile field not found — showing popup anyway');
    const mobile = readValue(mobileEl);
    if (mobileEl && !mobile) return; // empty -> normal submit, no popup

    e.preventDefault();
    e.stopImmediatePropagation();
    showPopup(btn, mobile);
  }, true); // capture phase = we run before the page's own handlers

  // YYYY-MM-DD in local time (avoids UTC day-shift from toISOString)
  function formatLocalDate(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }

  // ---- save to DrJiva (Supabase). Fire-and-forget: billing never waits on it ----
  function saveToDrJiva(payload) {
    const body = {
      p_mobile: payload.mobile,
      p_patient_name: payload.patient || null,
      p_hospital_name: payload.hospital,
      p_doctor_name: payload.doctor || null,
      p_items: payload.items.map(function (i) {
        return { name: i.medicine, morning: i.morning, afternoon: i.afternoon, night: i.night };
      }),
      p_start_date: formatLocalDate(new Date(payload.at)),
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
        log('DrJiva save ok:', result.json);
        if (result.json && result.json.skipped && result.json.skipped.length) {
          console.warn('[dosage] medicines skipped (not matched in catalog):', result.json.skipped);
        }
      })
      .catch(function (err) {
        console.error('[dosage] DrJiva save error (submit still proceeds):', err);
      });
  }

  // ---------- the popup ----------
  function showPopup(submitBtn, mobile) {
    if (document.getElementById('dose-overlay')) return;
    const meds = getMedicines();
    const state = meds.map(function (n) {
      return { medicine: n, Morning: false, Afternoon: false, Night: false };
    });

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
          'background:#0d9488;color:#fff;font-weight:700;font-size:14px;cursor:pointer;">Confirm &amp; Submit</button>' +
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
        chip.type = 'button'; // ASP.NET: stop it submitting the form
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

      row.appendChild(label);
      row.appendChild(toggles);
      host.appendChild(row);
    });

    // clicking the dark overlay does nothing — popup stays until Confirm

    const okBtn = box.querySelector('#dose-ok');
    okBtn.type = 'button';
    okBtn.onclick = function (ev) {
      ev.preventDefault();

      const daysInput = box.querySelector('#dose-days');
      let durationDays = parseInt(daysInput && daysInput.value, 10);
      if (!Number.isFinite(durationDays) || durationDays < 1) durationDays = DEFAULT_COURSE_DAYS;
      if (durationDays > 365) durationDays = 365;

      const payload = {
        hospital: HOSPITAL_NAME,
        patient: getPatientName(),
        mobile: mobile,
        doctor: getDoctorName(),
        at: new Date().toISOString(),
        durationDays: durationDays,
        items: state.map(function (s) {
          return { medicine: s.medicine, morning: s.Morning, afternoon: s.Afternoon, night: s.Night };
        }),
      };
      log('captured:', payload);

      try {
        saveToDrJiva(payload);
      } catch (err) {
        console.error('[dosage] DrJiva save threw (submit still proceeds):', err);
      }

      close();
      confirmed = true;

      // Re-fire the real Submit. Re-query first: an UpdatePanel postback may
      // have replaced the original element since we captured it.
      let fresh = null;
      if (SUBMIT_BTN_ID) fresh = document.querySelector(SUBMIT_BTN_ID);
      if (!fresh) {
        fresh = Array.from(document.querySelectorAll("input[type='submit'], input[type='button'], button"))
          .find(isSubmitButton);
      }
      (fresh || submitBtn).click();
    };
  }

  function close() {
    const o = document.getElementById('dose-overlay');
    if (o) o.remove();
  }

  log('ready on', location.href);
})();
