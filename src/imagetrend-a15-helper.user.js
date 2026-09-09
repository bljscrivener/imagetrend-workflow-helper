// ==UserScript==
// @name         ImageTrend A15 MVP helper
// @namespace    local.imagetrend.workflow
// @version      0.1.0
// @description  Review/apply vetted routine A15 ImageTrend defaults on the currently open form view. Never saves/submits.
// @match        https://pafford.imagetrendelite.com/Elite/Organizationpafford/Agencypmsmsboliv/EmsRunForm*
// @grant        none
// @run-at       document-idle
// @noframes
// ==/UserScript==

(() => {
  'use strict';

  if (document.getElementById('it-a15-helper-host')) return;
  if (location.hostname !== 'pafford.imagetrendelite.com') return;

  const FORM = '#form-composer';
  const norm = value => String(value ?? '')
    .replace(/[\u200b\u00ad]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  const visible = el => !!el &&
    el.getClientRects().length > 0 &&
    getComputedStyle(el).visibility !== 'hidden' &&
    getComputedStyle(el).display !== 'none';

  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

  const CLINICAL_NUMERIC_SUFFIXES = [
    '25341', // total GCS (calculated)
    '30193', // MAP
    '25345', // HR
    '25349', // RR
    '25347', // SpO2
    '25352', // ETCO2
    '25355f', '25355c', // temperature
    '25358', // pain score
    '25357'  // APGAR
  ];

  function isProtectedNumericId(id) {
    return CLINICAL_NUMERIC_SUFFIXES.some(suffix => String(id || '').endsWith(suffix));
  }

  function allById(id) {
    return [...document.querySelectorAll(`[id="${CSS.escape(id)}"]`)]
      .filter(el => el.closest(FORM));
  }

  function oneVisibleById(id) {
    const matches = allById(id).filter(visible);
    if (matches.length === 0) return null;
    if (matches.length !== 1) throw new Error(`${id}: duplicate visible fields.`);
    return matches[0];
  }

  function nearestControlContainer(el) {
    return el?.closest('.single-row-control, .smart-list-control, .date-time, [id]') || el;
  }

  function currentSmart(container) {
    const selected = [...container.querySelectorAll('button.smart-list-item')]
      .filter(button => button.classList.contains('selected') || button.getAttribute('aria-pressed') === 'true')
      .map(button => norm(button.textContent))
      .filter(Boolean);
    if (selected.length === 0) return '';
    if (selected.length === 1) return selected[0];
    return selected;
  }

  function currentSingle(container) {
    const value = norm(container.querySelector('.koSingleselect-selectedItem-value')?.textContent);
    return value === 'Not Recorded' ? '' : value;
  }

  function currentMulti(container) {
    const values = [...container.querySelectorAll(
      '.koMultiselect-selectedItem, .koMultiselect-selected-item, [class*="koMultiselect"][class*="selected"]'
    )]
      .filter(visible)
      .map(el => norm(el.textContent))
      .filter(Boolean);
    return [...new Set(values)];
  }

  function readField(el) {
    if (!el) return '';
    const container = nearestControlContainer(el);
    if (container.querySelector('button.smart-list-item')) return currentSmart(container);
    if (container.querySelector('.koSingleselect-selectedItem-value')) return currentSingle(container);
    if (container.querySelector('.koMultiselect-searchbar-input, komultiselect, .koMultiselect')) return currentMulti(container);
    if ('value' in el) return norm(el.value);
    const input = container.querySelector('input, textarea, select');
    return input && 'value' in input ? norm(input.value) : '';
  }

  function isBlank(value) {
    if (Array.isArray(value)) return value.length === 0;
    return norm(value) === '';
  }

  function sameValue(current, target) {
    if (Array.isArray(current)) return current.length === 1 && norm(current[0]) === norm(target);
    return norm(current) === norm(target);
  }

  function candidateNodes(container, targetText) {
    const target = norm(targetText);
    const selectors = [
      'button.smart-list-item',
      '.koSingleselect-dropDownItem',
      '.koMultiselect-dropDownItem',
      '.koMultiselect-dropdown-item',
      '[class*="koMultiselect"][class*="dropDownItem"]',
      '.not-value-label'
    ];
    const nodes = [...container.querySelectorAll(selectors.join(','))]
      .filter(node => norm(node.textContent) === target);
    return [...new Set(nodes)];
  }

  function clickable(node) {
    if (!node) return null;
    if (node.matches('button, [role="option"], .koSingleselect-dropDownItem, .koMultiselect-dropDownItem, .koMultiselect-dropdown-item')) return node;
    return node.closest('button, [role="option"], .koSingleselect-dropDownItem, .koMultiselect-dropDownItem, .koMultiselect-dropdown-item, li, div');
  }

  async function exposeChoices(container) {
    const singleToggle = container.querySelector('button.koSingleselect-down-button');
    if (singleToggle && !singleToggle.disabled) {
      singleToggle.click();
      await sleep(100);
      return;
    }
    const multiSearch = container.querySelector('.koMultiselect-searchbar-input');
    if (multiSearch && !multiSearch.disabled) {
      multiSearch.focus();
      multiSearch.click();
      await sleep(100);
      return;
    }
    const multiToggle = container.querySelector('button.koMultiselect-down-button, button[class*="koMultiselect"][class*="down"]');
    if (multiToggle && !multiToggle.disabled) {
      multiToggle.click();
      await sleep(100);
    }
  }

  async function setChoice(el, target, before) {
    const container = nearestControlContainer(el);
    if (!sameValue(readField(el), before)) throw new Error('Field changed since review.');
    let nodes = candidateNodes(container, target);
    if (!nodes.some(visible)) {
      await exposeChoices(container);
      nodes = candidateNodes(container, target);
    }
    const usable = nodes.map(clickable).filter(Boolean).filter(visible);
    const unique = [...new Set(usable)];
    if (unique.length !== 1) throw new Error(`Choice "${target}" missing or ambiguous.`);
    const node = unique[0];
    if (node.disabled || node.getAttribute('aria-disabled') === 'true') throw new Error(`Choice "${target}" is disabled.`);
    node.click();
    const deadline = Date.now() + 3500;
    while (Date.now() < deadline) {
      if (sameValue(readField(el), target)) return;
      await sleep(100);
    }
    throw new Error(`ImageTrend did not confirm "${target}".`);
  }

  function nativeSetInput(el, value) {
    if (!el || !('value' in el)) throw new Error('Writable input not found.');
    if (el.disabled || el.readOnly) throw new Error('Input is disabled/read-only.');
    if (isProtectedNumericId(el.id)) throw new Error('Protected clinical numeric field blocked.');
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    if (!setter) throw new Error('Native input setter unavailable.');
    setter.call(el, String(value));
    el.dispatchEvent(new Event('input', {bubbles: true}));
    el.dispatchEvent(new Event('change', {bubbles: true}));
    el.dispatchEvent(new Event('blur', {bubbles: true}));
  }

  function currentAgeYears() {
    const age = oneVisibleById('24949') || allById('24949')[0];
    if (!age) return null;
    const number = Number.parseFloat(age.value);
    if (!Number.isFinite(number)) return null;
    const unitsContainer = oneVisibleById('081ba95f-6c1e-57f7-b5cb-9585b308f268') || allById('081ba95f-6c1e-57f7-b5cb-9585b308f268')[0];
    const units = norm(unitsContainer ? readField(unitsContainer) : 'Years');
    if (!units || /^year/i.test(units)) return number;
    if (/month/i.test(units)) return number / 12;
    if (/day/i.test(units)) return number / 365.25;
    if (/hour/i.test(units)) return number / 8766;
    return null;
  }

  function parseDateTime(dateValue, timeValue) {
    const dm = norm(dateValue).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    const tm = norm(timeValue).match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
    if (!dm || !tm) return null;
    const date = new Date(Number(dm[3]), Number(dm[1]) - 1, Number(dm[2]), Number(tm[1]), Number(tm[2]), Number(tm[3] || 0));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function formatDate(date) {
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${mm}/${dd}/${date.getFullYear()}`;
  }

  function formatTime(date) {
    return [date.getHours(), date.getMinutes(), date.getSeconds()]
      .map(value => String(value).padStart(2, '0')).join(':');
  }

  const RULES = [
    // Existing STAT helper workflow.
    {id:'95cf67b7-74f0-5a19-b258-08c7b96ef8d6', label:'Unit Disposition', target:'Patient Contact Made'},
    {id:'a5db14f5-8f30-5131-937c-912204f5151d', label:'Type of Service Requested', target:'Emergency Response (Primary Response Area)'},
    {id:'ffbe72d1-96b3-53c5-a4a1-530b61be4635', label:"Number of Pt's at Scene", target:'Single'},
    {id:'ccc317e4-c422-592f-b490-2f3d1473be56', label:'Cardiac Arrest', target:'No'},
    {id:'57f37db6-1c94-5266-8734-10cc7c7f3903', label:'Possible Stroke', target:'No'},
    {id:'a21c0596-9e23-54f5-868e-a3809e80c27f', label:'Traumatic Injury', target:'No'},
    {id:'ed8c85c1-75e0-ed11-bfb9-001dd8b72ccf', label:'Is a STEMI probable?', target:'No'},
    {id:'66032c95-5556-5d89-a6fc-369c5b53509b', label:'Work-Related Illness/Injury', target:'No'},
    {id:'8224dbe2-d85a-5cb1-8108-61264de6dd1b', label:'Incident/Pt Disposition', target:'Transport - Pt Treated, Transported by this Unit'},
    {id:'249d37ae-50e7-523e-89a9-99e79c86c69d', label:'Patient Evaluation/Care', target:'Patient Evaluated and Care Provided'},
    {id:'e4a449b1-be1e-5803-9ff2-533f42478c13', label:'Crew Disposition', target:'Initiated and Continued Primary Care'},
    {id:'cfb7f889-af42-5a1b-8018-a55dfa923e00', label:'Transport Disposition', target:'Transport by This EMS Unit (This Crew Only)'},

    // Dispatch / history reconciliation.
    {id:'3cf8b9c0-7cf5-5581-a1b4-0a6ec9de735e', label:'Primary Role of Unit', target:'Ground Transport (ALS Equipped)', mode:'fillBlank'},
    {id:'2538b000-9d1a-52ab-9082-14aaa092730c', label:'Barriers to Patient Care', target:'None Noted', mode:'fillBlank'},

    // Routine transport profile.
    {id:'25089', label:'Number of Pts Transported in this Unit', target:'1', input:true, mode:'fillBlank'},
    {id:'12e06449-632f-5f97-b454-ec747e814719', label:'EMS Transport Method', target:'Ground-Ambulance', mode:'fillBlank'},
    {id:'62dd5264-cd67-56ec-a3d3-f35e00818537', label:'Transport Mode from Scene', target:'Without Lights and Sirens', mode:'fillBlank'},
    {id:'c05db124-d7cf-542c-a7bd-dbd12066f73d', label:'Transport from Scene Type', target:'No Lights or Sirens', mode:'fillBlank'},
    {id:'0bf28da1-6fc8-5cb0-a49f-9541aef01cae', label:'How Pt Was Moved to Ambulance', target:'Stretcher', mode:'fillBlank'},
    {id:'fca2bbb8-e1de-56ec-973e-7f6f1a597a03', label:'Patient Secured By', target:'Cot- 5 straps, Including Shoulders', mode:'fillBlank'},
    {id:'fa166830-90f8-5671-8e1d-3e729c9779ec', label:'Position of Pt During Transport', target:'Semi-Fowlers', mode:'fillBlank'},
    {id:'fe9abea5-c339-5375-a38c-3c9f8cbc6e54', label:'How Pt Was Moved From Ambulance', target:'Stretcher', mode:'fillBlank'},
    {id:'50ac60ee-31b5-5836-b004-25def8d05ae7', label:'Accepting Hospital Notified', target:'Yes', mode:'fillBlank'},
    {id:'fe38276c-e64c-5d82-b377-fed71bb7023e', label:'Facility Notified By', target:'Phone', mode:'fillBlank'},
    {id:'16ccfb92-ef4d-5527-a0ee-39639fd222f4', label:'Destination Team Pre-Arrival Alert or Activation', target:'No', mode:'fillBlank'},
    {id:'ae3afe47-5b10-5761-8ee0-db6094b90b5c', label:'Type of Destination', target:'Hospital', mode:'fillBlank'},

    // Routine A15 vital metadata. Measured numerical values are intentionally absent.
    {id:'7f5c88af-a3be-5947-b47b-ffe6cc957102', label:'AVPU', target:'Alert', mode:'fillBlank'},
    {id:'94f6e43f-139c-5eda-bd46-bdb95d7111bd', label:'GCS Eye', target:'4- Opens Eyes spontaneously (All Age Groups)', mode:'fillBlank'},
    {id:'30b5cc8f-c8c4-5446-a140-df8017828842', label:'GCS Verbal', target:'5- Oriented (>2 Years); Smiles, oriented to sounds, follows objects, interacts', mode:'fillBlank'},
    {id:'de69b8e0-ea97-5898-af28-163665df5d03', label:'GCS Motor', target:'6- Obeys commands (>2Years); Appropriate response to stimulation', mode:'fillBlank'},
    {id:'d6db496e-fd74-5d8a-a016-e324072dcb9c', label:'GCS Qualifier', target:'Initial GCS has legitimate values without interventions such as intubation and sedation', mode:'fillBlank'},
    {id:'0dcf3d4f-f98d-53c9-a042-3bd73e6104d9', label:'BP Method', target:'Cuff-Automated', mode:'fillBlank'},
    {id:'189b8c3d-3285-5066-b469-296a5c87d922', label:'HR Method', target:'Electronic Monitor - Pulse Oximeter', mode:'fillBlank'},
    {id:'1ac08c15-b252-5b17-bdd5-990dfb81b475', label:'Respiratory Effort', target:'Normal', mode:'fillBlank'},
    {id:'98cd8d07-762f-5665-9bef-e9b908b6d9dd', label:'Pulse Oximetry Qualifier', target:'Room Air', mode:'fillBlank'},
    {id:'37a26280-090a-5d8d-b95d-c6c950839a6f', label:'Pain Scale Type', target:'Numeric (0-10)', mode:'fillBlank'},
    {id:'10388fca-facb-5673-87e2-e109f28bd064', label:'Stroke Scale Score', target:'Negative', mode:'fillBlank'},
    {id:'408ab322-147e-5539-afaf-2062d143a55c', label:'Stroke Scale Type', target:'FAST', mode:'fillBlank'},
    {id:'fc93d071-9efc-5ce9-a393-3507852a8e19', label:'ECG Interpretation', target:'Not Applicable', mode:'fillBlank'},

    // Procedure metadata for an already-open procedure entry.
    {id:'c07c1d8b-c7d4-5a5a-8ec1-01bf67f882e0', label:"Procedure Performed Prior to this Unit's EMS Care", target:'No', mode:'fillBlank'},
    {id:'d0c37cfb-ac96-5c0e-9eb6-d21aeb3f57d7', label:'Role/Type of Person Performing the Procedure', target:'Paramedic', mode:'procedureRole'},
    {id:'6a3cd763-c562-574c-b209-bbced74d73c1', label:'Procedure Authorization', target:'Protocol (Standing Order)', mode:'fillBlank'},
    {id:'adcc71b8-0b92-5387-8b9f-cb94b729e4ac', label:'Procedure Successful', target:'Yes', mode:'fillBlank'}
  ];

  function resolveDerivedRules() {
    const extra = [];

    // Dispatch priority -> response mode; never guesses when priority is blank/unrecognized.
    const priorityEl = oneVisibleById('cd7b3bdc-ae84-5312-aacc-89fa5caea2b5');
    const modeEl = oneVisibleById('c1aa0ea5-0ad9-52d7-9170-4f0a725c2699');
    if (priorityEl && modeEl) {
      const priority = norm(readField(priorityEl));
      let target = '';
      if (/^1-Immediate\/Warning Devices$/i.test(priority)) target = 'With Lights and Sirens';
      else if (/^[2-5]-/.test(priority)) target = 'Without Lights and Sirens';
      if (target) extra.push({id:'c1aa0ea5-0ad9-52d7-9170-4f0a725c2699', label:'Response Mode to Scene', target, mode:'fillBlank', derived:`Dispatch Priority: ${priority}`});
    }

    // P3/P4 + blank incident location type -> Hospital.
    const locationEl = oneVisibleById('1e967d09-1081-5f71-bcfc-871d7b1f69dc');
    if (priorityEl && locationEl) {
      const priority = norm(readField(priorityEl));
      if (/^[34]-/.test(priority)) extra.push({id:'1e967d09-1081-5f71-bcfc-871d7b1f69dc', label:'Incident Location Type', target:'Hospital', mode:'fillBlank', derived:`Dispatch Priority: ${priority}`});
    }

    // Receiving hospital contacted = destination arrival - 5 minutes, only when target fields are blank.
    const destDate = oneVisibleById('29338Date');
    const destTime = oneVisibleById('29338Time');
    const contactDate = oneVisibleById('25648Date');
    const contactTime = oneVisibleById('25648Time');
    if (destDate && destTime && contactDate && contactTime) {
      const destination = parseDateTime(destDate.value, destTime.value);
      if (destination) {
        const contact = new Date(destination.getTime() - 5 * 60 * 1000);
        const leftDate = oneVisibleById('29337Date');
        const leftTime = oneVisibleById('29337Time');
        const leftScene = leftDate && leftTime ? parseDateTime(leftDate.value, leftTime.value) : null;
        if (!leftScene || contact >= leftScene) {
          extra.push({id:'25648Date', label:'Receiving Hospital Contacted Date', target:formatDate(contact), mode:'fillBlank', input:true, derived:'Arrived at Destination - 5 min'});
          extra.push({id:'25648Time', label:'Receiving Hospital Contacted Time', target:formatTime(contact), mode:'fillBlank', input:true, derived:'Arrived at Destination - 5 min'});
        }
      }
    }

    // Procedure size/comment on an already-open procedure.
    const procedure = oneVisibleById('02dffd5f-4c68-506b-881d-5b00c78090aa');
    if (procedure) {
      const procedureName = norm(readField(procedure));
      const sizeInput = [...document.querySelectorAll(`${FORM} input[id$="25451"]`)].filter(visible);
      const comment = oneVisibleById('25450');
      const ageYears = currentAgeYears();
      if (sizeInput.length === 1 && ageYears != null) {
        extra.push({element:sizeInput[0], id:sizeInput[0].id, label:'Size of Procedure Equipment', target:ageYears >= 18 ? 'adult' : 'pediatric', mode:'fillBlank', input:true, derived:`Age ${ageYears.toFixed(2)} years`});
      }
      if (comment) {
        const comments = {
          'Neurological assessment': 'MEND',
          'Stroke Assessment': 'FAST',
          'Moving a patient to a stretcher': 'Stand, pivot, sit'
        };
        if (comments[procedureName]) extra.push({id:'25450', label:'Procedure Comments', target:comments[procedureName], mode:'fillBlank', input:true, derived:`Procedure: ${procedureName}`});
      }
    }

    return extra;
  }

  function inspectRule(rule) {
    const el = rule.element || oneVisibleById(rule.id);
    if (!el) return null;
    if (rule.input && isProtectedNumericId(el.id)) return {rule, el, status:'blocked', before:readField(el), note:'Protected clinical numeric field'};

    const before = readField(el);
    const mode = rule.mode || 'preserveConflict';

    if (sameValue(before, rule.target)) return {rule, el, status:'kept', before};

    if (mode === 'procedureRole') {
      if (isBlank(before)) return {rule, el, status:'ready', before};
      if (norm(before) === 'Critical Care Paramedic') return {rule, el, status:'ready', before, note:'Known-value correction: Critical Care Paramedic -> Paramedic'};
      return {rule, el, status:'conflict', before, note:'Preserved; only blank or Critical Care Paramedic is eligible'};
    }

    if (mode === 'fillBlank') {
      if (isBlank(before)) return {rule, el, status:'ready', before};
      return {rule, el, status:'conflict', before, note:'Existing value preserved'};
    }

    if (isBlank(before)) return {rule, el, status:'ready', before};
    return {rule, el, status:'conflict', before, note:'Existing value preserved'};
  }

  function buildPlan() {
    const rules = [...RULES, ...resolveDerivedRules()];
    const results = [];
    for (const rule of rules) {
      try {
        const item = inspectRule(rule);
        if (item) results.push(item);
      } catch (error) {
        results.push({rule, el:null, status:'blocked', before:'', note:error.message});
      }
    }

    // ETCO2 units cleanup is review-only until a reliable ImageTrend clear/deselect primitive is captured.
    const etco2 = [...document.querySelectorAll(`${FORM} input[id$="25352"]`)].filter(visible);
    const units = oneVisibleById('01975843-3408-5a00-b45b-79e64e0db108');
    if (etco2.length === 1 && units && isBlank(etco2[0].value) && sameValue(readField(units), 'mmHg')) {
      results.push({
        rule:{id:units.id, label:'ETCO2 Units', target:'blank'},
        el:units,
        status:'manual',
        before:'mmHg',
        note:'ETCO2 is blank; deselect mmHg manually. Automatic clear is intentionally disabled until its control behavior is captured.'
      });
    }

    return results;
  }

  async function applyItem(item) {
    const {rule, el, before} = item;
    if (!el || item.status !== 'ready') return;
    if (rule.input) {
      if (!sameValue(readField(el), before)) throw new Error(`${rule.label}: changed since review.`);
      nativeSetInput(el, rule.target);
      await sleep(120);
      if (!sameValue(readField(el), rule.target)) throw new Error(`${rule.label}: ImageTrend did not confirm input change.`);
      return;
    }
    await setChoice(el, rule.target, before);
  }

  // --- UI ---
  const host = document.createElement('div');
  host.id = 'it-a15-helper-host';
  host.style.cssText = 'position:fixed;right:16px;top:64px;z-index:2147483645';
  const root = host.attachShadow({mode:'open'});
  root.innerHTML = `
    <style>
      :host{font:13px system-ui;color:#162637}*{box-sizing:border-box}button{font:inherit;border:1px solid #9eacbb;border-radius:7px;padding:8px 11px;background:white;color:#162637;cursor:pointer}button:disabled{opacity:.5;cursor:default}
      #launch,#run{background:#164f78;color:white}section{width:min(520px,92vw);max-height:82vh;overflow:auto;background:#fff;border:1px solid #9eacbb;border-radius:12px;box-shadow:0 10px 34px #0004;padding:16px}header{display:flex;align-items:center;justify-content:space-between;gap:10px}h2{margin:0;font-size:18px}p{line-height:1.4}.actions{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0}.row{display:grid;grid-template-columns:20px 1fr;gap:8px;padding:8px 0;border-top:1px solid #e4e9ef}.meta{font-size:11px;color:#5a6878;margin-top:3px}.ready{color:#155c2b}.kept{color:#4d6073}.conflict{color:#8a4d00}.blocked,.manual{color:#8b1e1e}#log{font:12px/1.45 ui-monospace,SFMono-Regular,monospace;white-space:pre-wrap;max-height:140px;overflow:auto;background:#f5f7f9;padding:8px;border-radius:6px}[hidden]{display:none!important}
    </style>
    <button id="launch" type="button">A15 helper</button>
    <section hidden>
      <header><h2>Routine A15</h2><button id="hide" type="button">Minimize</button></header>
      <p>Scans only the currently open ImageTrend view. Existing conflicting answers are preserved. Measured clinical numbers are never written.</p>
      <div class="actions"><button id="scan" type="button">Scan this view</button><button id="run" type="button" disabled>Apply reviewed fields</button></div>
      <label><input id="ack" type="checkbox"> I reviewed the proposed changes for this chart.</label>
      <div id="rows"></div>
      <p class="meta">No automatic Save/submit. Procedure creation/timing and ETCO2-unit clearing remain manual in this first MVP until those interaction primitives are validated.</p>
      <div id="log" role="status" aria-live="polite"></div>
    </section>`;
  document.body.append(host);

  const $ = selector => root.querySelector(selector);
  let plan = [];
  let busy = false;
  let planUrl = '';

  function log(text) {
    $('#log').textContent += `${text}\n`;
    $('#log').scrollTop = $('#log').scrollHeight;
  }

  function invalidate() {
    plan = [];
    planUrl = '';
    $('#rows').textContent = '';
    $('#ack').checked = false;
    $('#run').disabled = true;
  }

  function renderPlan(items) {
    $('#rows').textContent = '';
    for (const item of items) {
      const row = document.createElement('div');
      row.className = 'row';
      const check = document.createElement('input');
      check.type = 'checkbox';
      check.checked = item.status === 'ready';
      check.disabled = item.status !== 'ready';
      item.check = check;
      const body = document.createElement('div');
      const title = document.createElement('div');
      title.textContent = `${item.rule.label} -> ${item.rule.target}`;
      title.className = item.status;
      const meta = document.createElement('div');
      meta.className = 'meta';
      const current = Array.isArray(item.before) ? item.before.join(', ') : norm(item.before);
      meta.textContent = `${item.status.toUpperCase()} | current: ${current || '(blank)'}${item.rule.derived ? ` | ${item.rule.derived}` : ''}${item.note ? ` | ${item.note}` : ''}`;
      body.append(title, meta);
      row.append(check, body);
      $('#rows').append(row);
    }
  }

  $('#launch').onclick = () => { $('section').hidden = false; $('#launch').hidden = true; };
  $('#hide').onclick = () => { $('section').hidden = true; $('#launch').hidden = false; };
  $('#ack').onchange = () => { $('#run').disabled = busy || !plan.length || !$('#ack').checked || !plan.some(item => item.status === 'ready' && item.check?.checked); };
  window.addEventListener('hashchange', invalidate);

  $('#scan').onclick = () => {
    invalidate();
    $('#log').textContent = '';
    try {
      if (!/\/Incident\d+\/Form42(?:$|[/?])/.test(location.hash)) throw new Error('Open an ImageTrend Form42 incident chart.');
      plan = buildPlan();
      planUrl = location.href;
      renderPlan(plan);
      const ready = plan.filter(item => item.status === 'ready').length;
      const conflicts = plan.filter(item => item.status === 'conflict').length;
      const manual = plan.filter(item => item.status === 'manual' || item.status === 'blocked').length;
      log(`Found ${plan.length} recognized A15 fields in this view.`);
      log(`${ready} ready; ${conflicts} preserved conflicts; ${manual} manual/blocked.`);
      if (!ready) log('Nothing actionable on this view. Move to another chart section and scan again.');
    } catch (error) {
      log(`Scan stopped: ${error.message}`);
    }
  };

  $('#run').onclick = async () => {
    if (busy || !plan.length || !$('#ack').checked) return;
    if (location.href !== planUrl) { log('Stopped: chart/view changed. Scan again.'); invalidate(); return; }
    busy = true;
    $('#scan').disabled = true;
    $('#run').disabled = true;
    $('#ack').disabled = true;
    let changed = 0;
    try {
      const selected = plan.filter(item => item.status === 'ready' && item.check?.checked);
      for (const item of selected) {
        if (location.href !== planUrl) throw new Error('Chart/view changed during run.');
        await applyItem(item);
        changed += 1;
        log(`Set: ${item.rule.label} -> ${item.rule.target}`);
        await sleep(180);
      }
      log(`Complete: ${changed} field(s) changed. Review the chart. Save was not clicked.`);
    } catch (error) {
      log(`STOPPED after ${changed} confirmed change(s): ${error.message}`);
      log('Earlier changes remain in ImageTrend; inspect this chart before continuing.');
    } finally {
      busy = false;
      $('#scan').disabled = false;
      $('#ack').disabled = false;
      invalidate();
    }
  };
})();
