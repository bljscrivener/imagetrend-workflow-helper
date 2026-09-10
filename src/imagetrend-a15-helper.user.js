// ==UserScript==
// @name         ImageTrend A15 MVP helper
// @namespace    local.imagetrend.workflow
// @version      0.2.0
// @description  Review/apply vetted routine A15 ImageTrend defaults on the currently open form view. Never saves/submits.
// @match        https://pafford.imagetrendelite.com/Elite/Organizationpafford/Agencypmsmsboliv/EmsRunForm*
// @grant        GM_getResourceURL
// @resource     clearArtwork https://raw.githubusercontent.com/bljscrivener/imagetrend-workflow-helper/a15-mvp/assets/clear-warning.png
// @run-at       document-idle
// @noframes
// ==/UserScript==

(() => {
  'use strict';
  if (document.getElementById('it-a15-helper-host')) return;
  if (location.hostname !== 'pafford.imagetrendelite.com') return;

  const FORM = '#form-composer';
  const norm = v => String(v ?? '').replace(/[\u200b\u00ad]/g, '').replace(/\s+/g, ' ').trim();
  const visible = el => !!el && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden' && getComputedStyle(el).display !== 'none';
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const protectedNumericSuffixes = ['25341','30193','25345','25349','25347','25352','25355f','25355c','25358','25357'];
  const isProtectedNumericId = id => protectedNumericSuffixes.some(s => String(id || '').endsWith(s));

  function allById(id) {
    return [...document.querySelectorAll(`[id="${CSS.escape(id)}"]`)].filter(el => el.closest(FORM));
  }
  function oneVisibleById(id) {
    const m = allById(id).filter(visible);
    if (!m.length) return null;
    if (m.length !== 1) throw new Error(`${id}: duplicate visible fields.`);
    return m[0];
  }
  function containerOf(el) {
    return el?.closest('.single-row-control, .smart-list-control, .date-time, [id]') || el;
  }

  function currentSmart(c) {
    const vals = [...c.querySelectorAll('button.smart-list-item')]
      .filter(b => b.classList.contains('selected') || b.getAttribute('aria-pressed') === 'true')
      .map(b => norm(b.querySelector('.smart-list-button-label')?.textContent || b.textContent))
      .filter(Boolean);
    const u = [...new Set(vals)];
    return u.length === 0 ? '' : u.length === 1 ? u[0] : u;
  }
  function currentSingle(c) {
    const v = norm(c.querySelector('.koSingleselect-selectedItem-value')?.textContent);
    return v === 'Not Recorded' ? '' : v;
  }
  function currentMulti(c) {
    // ImageTrend's actual selected-value element is .koMultiselect-selectedItem-value.
    // Prefer that exact leaf node so parent/child matches do not duplicate one selected item.
    let nodes = [...c.querySelectorAll('.koMultiselect-selectedItem-value')].filter(visible);
    if (!nodes.length) {
      nodes = [...c.querySelectorAll('.koMultiselect-selectedItem, .koMultiselect-selected-item')].filter(visible);
    }
    const vals = nodes.map(n => norm(n.textContent)).filter(Boolean);
    const special = [...c.querySelectorAll('.mod-value-watermark,.overlay-label')].filter(visible).map(n=>norm(n.textContent)).filter(v=>v==='Not Applicable'||v==='Not Recorded');
    if (!vals.length && special.length) return [...new Set(special)];
    return [...new Set(vals)];
  }
  function readField(el) {
    if (!el) return '';
    const c = containerOf(el);
    if (c.querySelector('button.smart-list-item')) return currentSmart(c);
    if (c.querySelector('.koSingleselect-selectedItem-value')) return currentSingle(c);
    if (c.querySelector('.koMultiselect-selectedItem-value, .koMultiselect-searchbar-input, komultiselect, .koMultiselect')) return currentMulti(c);
    if ('value' in el) return norm(el.value);
    const input = c.querySelector('input, textarea, select');
    return input && 'value' in input ? norm(input.value) : '';
  }
  const blank = v => Array.isArray(v) ? v.length === 0 : norm(v) === '';
  const same = (a,b) => Array.isArray(a) ? a.length === 1 && norm(a[0]) === norm(b) : norm(a) === norm(b);

  // Snapshot comparison is distinct from matching one requested choice.
  function unchanged(a, b) {
    if (Array.isArray(a) || Array.isArray(b)) {
      return Array.isArray(a) && Array.isArray(b) &&
        a.length === b.length && a.every((v, i) => norm(v) === norm(b[i]));
    }
    return norm(a) === norm(b);
  }

  function optionNodes(c, targetText) {
    const target = norm(targetText);
    const nodes = [...c.querySelectorAll([
      'button.smart-list-item',
      '.koSingleselect-dropDownItem',
      '.koMultiselect-dropDownItem',
      '.koMultiselect-dropdown-item',
      '[class*="koMultiselect"][class*="dropDownItem"]',
      '[data-bind*="getOptionDisplay"]',
      '.not-value-label'
    ].join(','))].filter(n => norm(n.textContent) === target);
    return [...new Set(nodes)];
  }
  function clickable(node, c) {
    // Stay inside this field. Never guess an arbitrary div/li or invoke KO directly.
    for (let n = node; n && n !== c && c.contains(n); n = n.parentElement) {
      if (n.matches('button,[role="option"],.koSingleselect-dropDownItem,.koMultiselect-dropDownItem,.koMultiselect-dropdown-item') ||
          /(?:^|,)\s*click\s*:/.test(n.getAttribute('data-bind') || '')) return n;
    }
    return null;
  }
  function disabledChoice(node, c) {
    for (let n = node; n && c.contains(n); n = n.parentElement) {
      if (n.classList.contains('disabled') || n.disabled || n.matches(':disabled') || n.getAttribute('aria-disabled') === 'true' ||
          n.getAttribute('aria-readonly') === 'true') return true;
      if (n === c) break;
    }
    return false;
  }
  async function expose(c) {
    const s = c.querySelector('button.koSingleselect-down-button');
    if (s && !s.disabled) { s.click(); await sleep(120); return; }
    const ms = c.querySelector('.koMultiselect-searchbar-input');
    if (ms && !ms.disabled) { ms.focus(); ms.click(); await sleep(120); return; }
    const mt = c.querySelector('button.koMultiselect-down-button,button[class*="koMultiselect"][class*="down"]');
    if (mt && !mt.disabled) { mt.click(); await sleep(120); }
  }
  async function setChoice(el, target, before) {
    const c = containerOf(el);
    if (!unchanged(readField(el), before)) throw new Error('Field changed since review.');
    if (target === 'Not Applicable') { await setSpecialChoice(el,target,before); return; }
    let nodes = optionNodes(c, target);
    if (!nodes.some(visible)) { await expose(c); nodes = optionNodes(c, target); }
    const usable = [...new Set(nodes.filter(visible).map(n => clickable(n, c)).filter(Boolean).filter(visible))];
    if (usable.length !== 1) throw new Error(`Choice "${target}" missing or ambiguous.`);
    const node = usable[0];
    if (norm(node.textContent) !== norm(target)) throw new Error('Option click target contains unrelated content.');
    if (disabledChoice(node, c)) throw new Error(`Choice "${target}" is disabled.`);
    if (!el.isConnected || !visible(el) || !unchanged(readField(el), before))
      throw new Error('Field changed since review.');
    const chartUrl = location.href;
    node.click();
    const end = Date.now() + 3500;
    while (Date.now() < end) {
      if (location.href !== chartUrl || !el.isConnected || !visible(el))
        throw new Error('Chart/view changed during selection.');
      if (same(readField(el), target)) return;
      await sleep(100);
    }
    throw new Error(`ImageTrend did not confirm "${target}".`);
  }
  function nativeSetInput(el, value) {
    if (!el || !('value' in el)) throw new Error('Writable input not found.');
    if (el.disabled || el.readOnly) throw new Error('Input disabled/read-only.');
    if (isProtectedNumericId(el.id)) throw new Error('Protected clinical numeric field blocked.');
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto,'value')?.set;
    if (!setter) throw new Error('Native input setter unavailable.');
    setter.call(el,String(value));
    for (const type of ['input','change','blur']) el.dispatchEvent(new Event(type,{bubbles:true}));
  }

  function currentAgeYears() {
    const age = oneVisibleById('24949') || allById('24949')[0];
    if (!age) return null;
    const n = Number.parseFloat(age.value);
    if (!Number.isFinite(n)) return null;
    const ue = oneVisibleById('081ba95f-6c1e-57f7-b5cb-9585b308f268') || allById('081ba95f-6c1e-57f7-b5cb-9585b308f268')[0];
    const u = norm(ue ? readField(ue) : 'Years');
    if (!u || /^year/i.test(u)) return n;
    if (/month/i.test(u)) return n/12;
    if (/day/i.test(u)) return n/365.25;
    if (/hour/i.test(u)) return n/8766;
    return null;
  }
  function parseDT(d,t) {
    const dm = norm(d).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    const tm = norm(t).match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
    if (!dm || !tm) return null;
    const x = new Date(+dm[3],+dm[1]-1,+dm[2],+tm[1],+tm[2],+(tm[3]||0));
    return Number.isNaN(x.getTime()) ? null : x;
  }
  const fmtDate = d => `${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}/${d.getFullYear()}`;
  const fmtTime = d => [d.getHours(),d.getMinutes(),d.getSeconds()].map(v=>String(v).padStart(2,'0')).join(':');

  const RULES = [
    {id:'95cf67b7-74f0-5a19-b258-08c7b96ef8d6',label:'Unit Disposition',target:'Patient Contact Made'},
    {id:'a5db14f5-8f30-5131-937c-912204f5151d',label:'Type of Service Requested',target:'Emergency Response (Primary Response Area)'},
    {id:'ffbe72d1-96b3-53c5-a4a1-530b61be4635',label:"Number of Pt's at Scene",target:'Single'},
    {id:'ccc317e4-c422-592f-b490-2f3d1473be56',label:'Cardiac Arrest',target:'No'},
    {id:'57f37db6-1c94-5266-8734-10cc7c7f3903',label:'Possible Stroke',target:'No'},
    {id:'a21c0596-9e23-54f5-868e-a3809e80c27f',label:'Traumatic Injury',target:'No'},
    {id:'ed8c85c1-75e0-ed11-bfb9-001dd8b72ccf',label:'Is a STEMI probable?',target:'No'},
    {id:'66032c95-5556-5d89-a6fc-369c5b53509b',label:'Work-Related Illness/Injury',target:'No'},
    {id:'8224dbe2-d85a-5cb1-8108-61264de6dd1b',label:'Incident/Pt Disposition',target:'Transport - Pt Treated, Transported by this Unit'},
    {id:'249d37ae-50e7-523e-89a9-99e79c86c69d',label:'Patient Evaluation/Care',target:'Patient Evaluated and Care Provided'},
    {id:'e4a449b1-be1e-5803-9ff2-533f42478c13',label:'Crew Disposition',target:'Initiated and Continued Primary Care'},
    {id:'cfb7f889-af42-5a1b-8018-a55dfa923e00',label:'Transport Disposition',target:'Transport by This EMS Unit (This Crew Only)'},

    {id:'3cf8b9c0-7cf5-5581-a1b4-0a6ec9de735e',label:'Primary Role of Unit',target:'Ground Transport (ALS Equipped)',mode:'fillBlank'},
    {id:'2538b000-9d1a-52ab-9082-14aaa092730c',label:'Barriers to Patient Care',target:'None Noted',mode:'fillBlank'},

    {id:'25089',label:'Number of Pts Transported in this Unit',target:'1',input:true,mode:'fillBlank'},
    {id:'12e06449-632f-5f97-b454-ec747e814719',label:'EMS Transport Method',target:'Ground-Ambulance',mode:'fillBlank'},
    {id:'62dd5264-cd67-56ec-a3d3-f35e00818537',label:'Transport Mode from Scene',target:'Without Lights and Sirens',mode:'fillBlank'},
    {id:'c05db124-d7cf-542c-a7bd-dbd12066f73d',label:'Transport from Scene Type',target:'No Lights or Sirens',mode:'fillBlank'},
    {id:'0bf28da1-6fc8-5cb0-a49f-9541aef01cae',label:'How Pt Was Moved to Ambulance',target:'Stretcher',mode:'fillBlank'},
    {id:'fca2bbb8-e1de-56ec-973e-7f6f1a597a03',label:'Patient Secured By',target:'Cot- 5 straps, Including Shoulders',mode:'fillBlank'},
    {id:'fa166830-90f8-5671-8e1d-3e729c9779ec',label:'Position of Pt During Transport',target:'Semi-Fowlers',mode:'fillBlank'},
    {id:'fe9abea5-c339-5375-a38c-3c9f8cbc6e54',label:'How Pt Was Moved From Ambulance',target:'Stretcher',mode:'fillBlank'},
    {id:'969e7423-2a24-5d5c-b47b-a1331eb124d9',label:'Final Pt Acuity',target:'Lower Acuity (Green)',mode:'fillBlank'},
    {id:'50ac60ee-31b5-5836-b004-25def8d05ae7',label:'Accepting Hospital Notified',target:'Yes',mode:'fillBlank'},
    {id:'fe38276c-e64c-5d82-b377-fed71bb7023e',label:'Facility Notified By',target:'Phone',mode:'fillBlank'},
    {id:'16ccfb92-ef4d-5527-a0ee-39639fd222f4',label:'Destination Team Pre-Arrival Alert or Activation',target:'No',mode:'fillBlank'},
    {id:'ae3afe47-5b10-5761-8ee0-db6094b90b5c',label:'Type of Destination',target:'Hospital',mode:'fillBlank'},

    {id:'7f5c88af-a3be-5947-b47b-ffe6cc957102',label:'AVPU',target:'Alert',mode:'fillBlank'},
    {id:'94f6e43f-139c-5eda-bd46-bdb95d7111bd',label:'GCS Eye',target:'4- Opens Eyes spontaneously (All Age Groups)',mode:'fillBlank'},
    {id:'30b5cc8f-c8c4-5446-a140-df8017828842',label:'GCS Verbal',target:'5- Oriented (>2 Years); Smiles, oriented to sounds, follows objects, interacts',mode:'fillBlank'},
    {id:'de69b8e0-ea97-5898-af28-163665df5d03',label:'GCS Motor',target:'6- Obeys commands (>2Years); Appropriate response to stimulation',mode:'fillBlank'},
    {id:'d6db496e-fd74-5d8a-a016-e324072dcb9c',label:'GCS Qualifier',target:'Initial GCS has legitimate values without interventions such as intubation and sedation',mode:'fillBlank'},
    {id:'0dcf3d4f-f98d-53c9-a042-3bd73e6104d9',label:'BP Method',target:'Cuff-Automated',mode:'fillBlank'},
    {id:'189b8c3d-3285-5066-b469-296a5c87d922',label:'HR Method',target:'Electronic Monitor - Pulse Oximeter',mode:'fillBlank'},
    {id:'1ac08c15-b252-5b17-bdd5-990dfb81b475',label:'Respiratory Effort',target:'Normal',mode:'fillBlank'},
    {id:'98cd8d07-762f-5665-9bef-e9b908b6d9dd',label:'Pulse Oximetry Qualifier',target:'Room Air',mode:'fillBlank'},
    {id:'37a26280-090a-5d8d-b95d-c6c950839a6f',label:'Pain Scale Type',target:'Numeric (0-10)',mode:'fillBlank'},
    {id:'10388fca-facb-5673-87e2-e109f28bd064',label:'Stroke Scale Score',target:'Negative',mode:'fillBlank'},
    {id:'408ab322-147e-5539-afaf-2062d143a55c',label:'Stroke Scale Type',target:'FAST',mode:'fillBlank'},
    {id:'fc93d071-9efc-5ce9-a393-3507852a8e19',label:'ECG Interpretation',target:'Not Applicable',mode:'fillBlank'},

    {id:'c07c1d8b-c7d4-5a5a-8ec1-01bf67f882e0',label:"Procedure Performed Prior to this Unit's EMS Care",target:'No',mode:'fillBlank'},
    {id:'d0c37cfb-ac96-5c0e-9eb6-d21aeb3f57d7',label:'Role/Type of Person Performing the Procedure',target:'Paramedic',mode:'procedureRole'},
    {id:'6a3cd763-c562-574c-b209-bbced74d73c1',label:'Procedure Authorization',target:'Protocol (Standing Order)',mode:'fillBlank'},
    {id:'adcc71b8-0b92-5387-8b9f-cb94b729e4ac',label:'Procedure Successful',target:'Yes',mode:'fillBlank'}
  ];

  function derivedRules() {
    const out = [];
    const p = oneVisibleById('cd7b3bdc-ae84-5312-aacc-89fa5caea2b5');
    const response = oneVisibleById('c1aa0ea5-0ad9-52d7-9170-4f0a725c2699');
    if (p && response) {
      const pv = norm(readField(p));
      const target = /^1-Immediate\/Warning Devices$/i.test(pv) ? 'With Lights and Sirens' : /^[2-5]-/.test(pv) ? 'Without Lights and Sirens' : '';
      if (target) out.push({id:response.id,label:'Response Mode to Scene',target,mode:'fillBlank',derived:`Dispatch Priority: ${pv}`});
    }
    const loc = oneVisibleById('1e967d09-1081-5f71-bcfc-871d7b1f69dc');
    if (p && loc) {
      const pv = norm(readField(p));
      if (/^[34]-/.test(pv)) out.push({id:loc.id,label:'Incident Location Type',target:'Hospital',mode:'fillBlank',derived:`Dispatch Priority: ${pv}`});
    }

    const dd=oneVisibleById('29338Date'), dt=oneVisibleById('29338Time'), cd=oneVisibleById('25648Date'), ct=oneVisibleById('25648Time');
    if (dd && dt && cd && ct) {
      const destination = parseDT(dd.value,dt.value);
      if (destination) {
        const contact = new Date(destination.getTime()-5*60000);
        const ld=oneVisibleById('29337Date'), lt=oneVisibleById('29337Time');
        const left = ld && lt ? parseDT(ld.value,lt.value) : null;
        if (!left || contact >= left) {
          out.push({id:'25648Date',label:'Receiving Hospital Contacted Date',target:fmtDate(contact),mode:'fillBlank',input:true,derived:'Destination arrival - 5 min'});
          out.push({id:'25648Time',label:'Receiving Hospital Contacted Time',target:fmtTime(contact),mode:'fillBlank',input:true,derived:'Destination arrival - 5 min'});
        }
      }
    }

    const proc = oneVisibleById('02dffd5f-4c68-506b-881d-5b00c78090aa');
    if (proc) {
      const name = norm(readField(proc));
      if (PROCEDURE_NAMES.includes(name)) {
        const timing = name === 'Moving a patient to a stretcher' ? stretcherTime() : patientArrivalTime(), fields = procedureTimeInputs(procedureFlyout());
        for (const part of ['date','time']) out.push({element:fields[part],id:fields[part].id,label:name+' '+part,target:timing[part],input:true,mode:'procedureTime',derived:(name === 'Moving a patient to a stretcher' ? 'Depart Scene − 2 min; fallback Scene Arrival + 2 min' : 'Arrived at Patient')+'; reviewed timestamp correction',procedureName:name});
      }
      const size = [...document.querySelectorAll(`${FORM} input[id$="25451"]`)].filter(visible);
      const comment = oneVisibleById('25450');
      const age = currentAgeYears();
      if (size.length === 1 && age != null) out.push({element:size[0],id:size[0].id,label:'Size of Procedure Equipment',target:age>=18?'adult':'pediatric',mode:'fillBlank',input:true,derived:`Age ${age.toFixed(2)} years`});
      const comments = {'Neurological assessment':'MEND','Stroke Assessment':'FAST','Moving a patient to a stretcher':'Stand, pivot, sit'};
      if (comment && comments[name]) out.push({id:'25450',label:'Procedure Comments',target:comments[name],mode:'fillBlank',input:true,derived:`Procedure: ${name}`});
    }
    return out;
  }

  function inspect(rule) {
    const el = rule.element || oneVisibleById(rule.id);
    if (!el) return null;
    if (rule.input && isProtectedNumericId(el.id)) return {rule,el,status:'blocked',before:readField(el),note:'Protected clinical numeric field'};
    const before = readField(el);
    if (Array.isArray(rule.target)) {
      const vals=listValue(before);
      const status=sameSet(vals,rule.target)?'kept':vals.every(v=>rule.target.includes(v))?'ready':'conflict';
      return {rule,el,status,before,note:status==='conflict'?'Existing value preserved':''};
    }
    if (same(before,rule.target)) return {rule,el,status:'kept',before};
    if (rule.mode === 'procedureTime') return {rule,el,status:'ready',before,note:'Reviewed timestamp correction'};
    if (rule.mode === 'procedureRole') {
      if (blank(before) || norm(before)==='Critical Care Paramedic') return {rule,el,status:'ready',before,note:blank(before)?'':'Known correction: Critical Care Paramedic -> Paramedic'};
      return {rule,el,status:'conflict',before,note:'Existing value preserved'};
    }
    if (blank(before)) return {rule,el,status:'ready',before};
    return {rule,el,status:'conflict',before,note:'Existing value preserved'};
  }
  function buildPlan() {
    const results=[];
    for (const rule of [...RULES,...derivedRules(),...delayRules()]) {
      try { const x=inspect(rule); if (x) results.push(x); }
      catch(e) { results.push({rule,el:null,status:'blocked',before:'',note:e.message}); }
    }
    const et=[...document.querySelectorAll(`${FORM} input[id$="25352"]`)].filter(visible);
    const units=oneVisibleById('01975843-3408-5a00-b45b-79e64e0db108');
    if (et.length===1 && units && blank(et[0].value) && same(readField(units),'mmHg')) results.push({rule:{id:units.id,label:'ETCO2 Units',target:'blank'},el:units,status:'manual',before:'mmHg',note:'ETCO2 blank: deselect mmHg manually for now.'});
    const activation=activationPlan(); if(activation) results.push(activation);
    return results;
  }
  async function apply(item) {
    const {rule,el,before}=item;
    if (item.status!=='ready') return;
    if (rule.action==='activation') { await addHospitalActivation(); return; }
    if (!el) return;
    if (!el.isConnected || !visible(el)) throw new Error('Field is no longer visible. Review again.');
    if (rule.delay) {
      const fresh=delayRules().find(r=>r.id===rule.id);
      if(!fresh||!sameSet(fresh.target,rule.target))throw new Error('Delay timeline changed. Review again.');
    }
    if (Array.isArray(rule.target)) { await setChoiceSet(el,rule.target,before); recordChange(item); return; }
    if (rule.input) {
      if (rule.mode === 'procedureTime') {
        const timing = rule.procedureName === 'Moving a patient to a stretcher' ? stretcherTime() : patientArrivalTime(), part = el.id.endsWith('Date') ? 'date' : 'time';
        if (rule.target !== timing[part]) throw new Error('Timeline changed since review. Scan again.');
      }
      if (!unchanged(readField(el),before)) throw new Error(`${rule.label}: changed since review.`);
      nativeSetInput(el,rule.target); await sleep(120);
      if (!same(readField(el),rule.target)) throw new Error(`${rule.label}: ImageTrend did not confirm input change.`);
    } else await setChoice(el,rule.target,before);
    recordChange(item);
  }




  let timelineSnapshot = null;
  const TIMELINE_IDS = ['29337Date','29337Time','29336Date','29336Time','29335Date','29335Time','29331Date','29331Time','29332Date','29332Time','29338Date','29338Time','29342Date','29342Time'];
  function timelineChartKey() {
    const match = location.hash.match(/\/Incident\d+\/Form42(?:$|[/?])/);
    return match ? location.origin + location.pathname + match[0].replace(/[/?]$/, '') : null;
  }
  function readTimelineSnapshot(requireLive = false) {
    const key = timelineChartKey();
    if (!key || timelineSnapshot?.key !== key) timelineSnapshot = null;
    // Timeline may be rendered outside #form-composer.
    const groups = TIMELINE_IDS.map(id => [...document.querySelectorAll('[id="' + id + '"]')]);
    if (groups.some(nodes => nodes.length)) {
      const values = groups.map(nodes => {
        const shown = nodes.filter(visible);
        const candidates = shown.length ? shown : nodes;
        return !candidates.length ? '' : candidates.length === 1 && 'value' in candidates[0] ? norm(candidates[0].value) : null;
      });
      timelineSnapshot = null;
      if (values.some(v => v === null)) throw new Error('Timeline is incomplete or ambiguous. Open Timeline and click Read timeline.');
      timelineSnapshot = {key, values, captured: Date.now()};
    } else if (requireLive) {
      timelineSnapshot = null;
      throw new Error('Open Timeline first, then click Read timeline.');
    }
    if (!timelineSnapshot || Date.now() - timelineSnapshot.captured > 15 * 60000) {
      timelineSnapshot = null;
      throw new Error('Open Timeline and click Read timeline, then return to Procedures. Timeline values are needed for stretcher timing.');
    }
    return timelineSnapshot.values;
  }
  window.addEventListener('hashchange', () => {
    if (timelineSnapshot?.key !== timelineChartKey()) timelineSnapshot = null;
  });
  document.addEventListener('input', e => {
    if (TIMELINE_IDS.includes(e.target.id)) timelineSnapshot = null;
  }, true);
  document.addEventListener('change', e => {
    if (TIMELINE_IDS.includes(e.target.id)) timelineSnapshot = null;
  }, true);
  function stretcherTime(requireLive = false) {
    const values = readTimelineSnapshot(requireLive);
    const read = offset => {
      const d = values[offset], t = values[offset + 1];
      if (!d || !t) return null;
      const parsed = parseDT(d, t);
      if (!parsed || fmtDate(parsed) !== d || !/^(?:[01]?\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(t)) {
        timelineSnapshot = null;
        throw new Error('Invalid timeline date/time. Correct it and click Read timeline.');
      }
      return parsed;
    };
    const departure = read(0), contact = read(2);
    const scene = departure ? null : read(4);
    if (!departure && !scene) {
      timelineSnapshot = null;
      throw new Error('Need Depart Scene or Arrived on Scene date/time. Open Timeline and click Read timeline.');
    }
    const target = new Date(departure ? departure.getTime() - 120000 : scene.getTime() + 120000);
    if (contact && target < contact) {
      timelineSnapshot = null;
      throw new Error('Stretcher time precedes patient arrival. Review the timeline.');
    }
    return {date: fmtDate(target), time: fmtTime(target)};
  }
  function procedureTimeInputs(f) {
    const one = suffix => {
      const nodes = [...f.querySelectorAll('input[id$="' + suffix + '"]')].filter(visible);
      if (nodes.length !== 1 || nodes[0].disabled || nodes[0].readOnly) throw new Error('Writable procedure time fields unavailable.');
      return nodes[0];
    };
    return {date: one('25443Date'), time: one('25443Time')};
  }
  async function applyBundleDetails(f, name, timing) {
    const roles = [...f.querySelectorAll('[id="d0c37cfb-ac96-5c0e-9eb6-d21aeb3f57d7"]')].filter(visible);
    if (roles.length !== 1) throw new Error('Procedure role missing or ambiguous.');
    const role = roles[0], before = readField(role);
    if (!same(before, 'Paramedic')) {
      if (!blank(before) && !same(before, 'Critical Care Paramedic')) throw new Error('Unexpected procedure role; existing value preserved.');
      await setChoice(role, 'Paramedic', before);
    }
    {
      const currentTiming = name === 'Moving a patient to a stretcher' ? stretcherTime() : patientArrivalTime();
      const plannedTime = name === 'Moving a patient to a stretcher' ? timing.stretcher : timing.arrival;
      if (JSON.stringify(currentTiming) !== JSON.stringify(plannedTime)) throw new Error('Timeline changed during bundle.');
      const inputs = procedureTimeInputs(f);
      nativeSetInput(inputs.date, plannedTime.date);
      nativeSetInput(inputs.time, plannedTime.time);
      await sleep(150);
      if (norm(inputs.date.value) !== plannedTime.date || norm(inputs.time.value) !== plannedTime.time)
        throw new Error('ImageTrend did not confirm procedure time.');
    }
    for (const id of ['c07c1d8b-c7d4-5a5a-8ec1-01bf67f882e0','6a3cd763-c562-574c-b209-bbced74d73c1','adcc71b8-0b92-5387-8b9f-cb94b729e4ac']) {
      const rule=RULES.find(r=>r.id===id), el=scopedField(f,id), value=readField(el);
      if (blank(value)) await setChoice(el,rule.target,value);
      else if (!same(value,rule.target)) throw new Error(rule.label+': existing conflict preserved.');
    }
    if (!same(readField(role), 'Paramedic')) throw new Error('ImageTrend did not retain Paramedic.');
  }

  const PROCEDURE_NAMES = ['Assessment -ALS', 'Neurological assessment', 'Adult pain assessment', 'Moving a patient to a stretcher'];
  const PROCEDURE_ID = '02dffd5f-4c68-506b-881d-5b00c78090aa';
  function procedureFlyout() {
    const found = [...document.querySelectorAll('.grid-flyout-overlay.grid-flyout-active')]
      .filter(visible).filter(f => [...f.querySelectorAll('.grid-label')].some(n => norm(n.textContent) === 'Procedure'));
    if (found.length !== 1) throw new Error('Open one blank Procedure entry with ImageTrend Add first.');
    return found[0];
  }
  function procedureField(f) {
    const fields = [...f.querySelectorAll('[id]')].filter(n => n.id === PROCEDURE_ID && visible(n));
    if (fields.length !== 1) throw new Error('Procedure selector missing or ambiguous.');
    return fields[0];
  }
  function procedureKey(f) {
    const dates = [...f.querySelectorAll('input[id$="25443Date"]')].filter(visible);
    if (dates.length !== 1) throw new Error('Procedure entry identity missing or ambiguous.');
    return dates[0].id;
  }
  function procedureButton(f, handler, label) {
    const buttons = [...f.querySelectorAll('button.grid-button')].filter(visible)
      .filter(b => norm(b.textContent) === label && (b.getAttribute('data-bind') || '').includes('grid.' + handler + '($context)'));
    if (buttons.length !== 1 || disabledChoice(buttons[0], f)) throw new Error(label + ' unavailable or disabled.');
    return buttons[0];
  }

  async function openProcedureEntry() {
    const active = [...document.querySelectorAll('.grid-flyout-overlay.grid-flyout-active')].filter(visible);
    if (active.length) return procedureFlyout();
    const grids = [...document.querySelectorAll('[id="aa6d315f-ccbc-58c0-950e-2e0932ee67b6"]')].filter(visible);
    if (grids.length !== 1) throw new Error('Open Treatment → Procedures & Medications first.');
    const grid = grids[0];
    if (norm(grid.querySelector('.grid-label')?.textContent) !== 'Procedures') throw new Error('Procedures grid identity did not match.');
    const lists = grid.querySelectorAll('.grid-item-display');
    if (lists.length !== 1 || lists[0].children.length || norm(lists[0].textContent))
      throw new Error('Procedures already exist or list is unavailable. Open an existing entry to review; automatic Add requires an empty list.');
    if ([...grid.querySelectorAll('button.grid-filter')].some(b => !b.classList.contains('grid-button-highlighted')))
      throw new Error('Show all procedure filters before adding.');
    const buttons = [...grid.querySelectorAll('.grid-actions button.grid-button')].filter(visible)
      .filter(b => norm(b.textContent) === 'Add' && (b.getAttribute('data-bind') || '').includes('grid.openSubformSelectionModal($context)'));
    if (buttons.length !== 1 || disabledChoice(buttons[0], grid)) throw new Error('Procedure Add unavailable or disabled.');
    const url = location.href;
    buttons[0].click();
    const end = Date.now() + 5000;
    while (Date.now() < end) {
      if (location.href !== url) throw new Error('Chart changed while opening procedure.');
      try { return procedureFlyout(); } catch (_) { /* wait for native flyout */ }
      await sleep(100);
    }
    throw new Error('Procedure entry did not open. Review any ImageTrend dialog before continuing.');
  }

  async function addProcedureBundle(onProgress) {
    const url = location.href;
    if (!/\/Incident\d+\/Form42(?:$|[/?])/.test(location.hash)) throw new Error('Open a Form42 chart.');
    const storageKey = 'it-a15-procedure-bundle:' + url;
    if (sessionStorage.getItem(storageKey)) throw new Error('Bundle already attempted in this tab. Review existing procedures before adding anything manually.');
    const timing = {stretcher:stretcherTime(),arrival:patientArrivalTime()};
    let f = await openProcedureEntry();
    if (!blank(readField(procedureField(f)))) throw new Error('The open procedure is populated. Open a blank entry first.');
    procedureKey(f);
    procedureButton(f, 'addAnotherButtonClickHandler', 'Add Another');
    procedureButton(f, 'okButtonClickHandler', 'OK');
    // Persist before the first mutation: failed/partial runs must not be blindly repeated.
    sessionStorage.setItem(storageKey, 'started');
    for (let i = 0; i < PROCEDURE_NAMES.length; i++) {
      if (location.href !== url) throw new Error('Chart changed during bundle.');
      f = procedureFlyout();
      const field = procedureField(f), key = procedureKey(f);
      if (!blank(readField(field))) throw new Error('Expected a new blank procedure. Stopped to preserve it.');
      // The captured single-select can filter its resource list through searchTerm.
      await expose(field);
      if (!optionNodes(field, PROCEDURE_NAMES[i]).some(visible)) {
        const searches = [...field.querySelectorAll('input.koSingleselect-searchbar-input')].filter(visible);
        if (searches.length === 1) {
          nativeSetInput(searches[0], PROCEDURE_NAMES[i]);
          const searchDeadline = Date.now() + 2000;
          while (Date.now() < searchDeadline && !optionNodes(field, PROCEDURE_NAMES[i]).some(visible)) await sleep(100);
        }
      }
      if (location.href !== url || procedureFlyout() !== f || procedureKey(f) !== key || !blank(readField(field)))
        throw new Error('Procedure changed while finding option.');
      await setChoice(field, PROCEDURE_NAMES[i], readField(field));
      recordChange({el:field,before:'',rule:{id:field.id,label:PROCEDURE_NAMES[i],target:PROCEDURE_NAMES[i]}});
      if (location.href !== url || procedureFlyout() !== f || procedureKey(f) !== key ||
          !same(readField(field), PROCEDURE_NAMES[i])) throw new Error('Procedure changed before confirmation.');
      await applyBundleDetails(f, PROCEDURE_NAMES[i], timing);
      if (location.href !== url || procedureFlyout() !== f || procedureKey(f) !== key || !same(readField(field), PROCEDURE_NAMES[i])) throw new Error('Procedure changed before acceptance.');
      const last = i === PROCEDURE_NAMES.length - 1;
      procedureButton(f, last ? 'okButtonClickHandler' : 'addAnotherButtonClickHandler', last ? 'OK' : 'Add Another').click();
      const deadline = Date.now() + 5000;
      let advanced = false;
      while (Date.now() < deadline) {
        if (location.href !== url) throw new Error('Chart changed during bundle.');
        if (last) {
          if (![...document.querySelectorAll('.grid-flyout-overlay.grid-flyout-active')].some(visible)) { advanced = true; break; }
        } else {
          try {
            const next = procedureFlyout();
            if (procedureKey(next) !== key && blank(readField(procedureField(next)))) { advanced = true; break; }
          } catch (_) { /* transient flyout replacement */ }
        }
        await sleep(100);
      }
      if (!advanced) throw new Error('ImageTrend did not advance after ' + PROCEDURE_NAMES[i] + '. Inspect the open entry; do not rerun blindly.');
      onProgress(PROCEDURE_NAMES[i]);
    }
    sessionStorage.setItem(storageKey, 'completed');
  }

  // Native DOM adapters only. No Knockout view-model evaluation or direct writes.
  function scopedField(scope,id) {
    const found=[...scope.querySelectorAll('[id="'+CSS.escape(id)+'"]')].filter(visible);
    if(found.length!==1)throw new Error('Field '+id+' missing or ambiguous.');
    return found[0];
  }
  async function until(check,message,timeout=4000) {
    const chart=timelineChartKey(), end=Date.now()+timeout;
    while(Date.now()<end) {
      if(chart!==timelineChartKey())throw new Error('Chart changed.');
      const result=check(); if(result)return result;
      await sleep(80);
    }
    throw new Error(message);
  }
  function selectedSpecial(c,target) {
    return [...c.querySelectorAll('.mod-value-watermark,.overlay-label')].filter(visible)
      .some(n=>norm(n.textContent)===target);
  }
  async function setSpecialChoice(el,target,before) {
    const c=containerOf(el);
    if(!unchanged(readField(el),before))throw new Error('Field changed since review.');
    const choices=[...c.querySelectorAll('.not-value')].filter(n=>norm(n.querySelector('.not-value-label')?.textContent)===target);
    if(choices.length!==1)throw new Error('Special value '+target+' missing or ambiguous.');
    const choice=choices[0], opener=choice.closest('.mod-value-action');
    if(!opener || !/(?:^|,)\s*click\s*:\s*toggleOpen(?:,|$)/.test(opener.getAttribute('data-bind')||''))throw new Error('Special-value menu opener not recognized.');
    if(disabledChoice(opener,c)||disabledChoice(choice,c))throw new Error('Special-value menu is disabled.');
    if(!visible(choice)) {opener.click();await until(()=>visible(choice),'Special-value menu did not open.');}
    if(!unchanged(readField(el),before))throw new Error('Field changed while opening special values.');
    choice.click();
    await until(()=>el.isConnected && (same(readField(el),target)||selectedSpecial(c,target)),'ImageTrend did not confirm '+target+'.');
    // Close only this menu, without toggling the selected special value.
    if(visible(choice)) {
      const close=opener.parentElement.querySelector('.close-overlay[data-bind*="isOpen(false)"]');
      if(close&&visible(close))close.click();
    }
  }
  const listValue=v=>Array.isArray(v)?v.map(norm):blank(v)?[]:[norm(v)];
  const sameSet=(a,b)=>{a=listValue(a);b=listValue(b);return a.length===b.length&&a.every(v=>b.includes(v));};
  async function setChoiceSet(el,targets,before) {
    if(!unchanged(readField(el),before))throw new Error('Field changed since review.');
    const existing=listValue(before);
    if(existing.some(v=>!targets.includes(v)))throw new Error('Existing delay value preserved.');
    const c=containerOf(el);
    for(const target of targets) {
      const snapshot=readField(el);
      if(listValue(snapshot).includes(target))continue;
      let nodes=optionNodes(c,target).filter(visible);
      if(!nodes.length){await expose(c);nodes=optionNodes(c,target).filter(visible);}
      const buttons=[...new Set(nodes.map(n=>clickable(n,c)).filter(Boolean))];
      if(buttons.length!==1||disabledChoice(buttons[0],c)||norm(buttons[0].textContent)!==norm(target))throw new Error('Delay choice '+target+' missing, disabled or ambiguous.');
      if(!unchanged(readField(el),snapshot))throw new Error('Delay changed during review.');
      buttons[0].click();
      const expected=[...listValue(snapshot),target];
      await until(()=>sameSet(readField(el),expected),'Delay selection did not confirm.');
    }
  }
  function timelineDate(prefix,required=false) {
    const values=readTimelineSnapshot(), i=TIMELINE_IDS.indexOf(prefix+'Date');
    const d=values[i], t=values[i+1];
    if(i<0||!d||!t){if(required)throw new Error('Missing timeline '+prefix+'.');return null;}
    const parsed=parseDT(d,t);
    if(!parsed||fmtDate(parsed)!==d||!/^(?:[01]?\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(t))throw new Error('Invalid timeline '+prefix+'.');
    return parsed;
  }
  function patientArrivalTime() {
    const d=timelineDate('29336',true);
    return {date:fmtDate(d),time:fmtTime(d)};
  }
  function fieldByLabel(label,scope=document) {
    const labels=[...scope.querySelectorAll('label')].filter(visible).filter(n=>norm(n.textContent).replace(/:$/,'').toLowerCase()===label.toLowerCase());
    if(labels.length!==1)return null;
    return labels[0].closest('.single-row-control,.smart-list-control');
  }
  function delayRules() {
    const out=[];
    const delayField=kind=>{
      const fields=[kind+' Delay',kind+' Delays','Type of '+kind+' Delay','Type of '+kind+' Delays'].map(label=>fieldByLabel(label)).filter(Boolean);
      const unique=[...new Set(fields)];
      if(unique.length>1)throw new Error(kind+' delay field is ambiguous.');
      return unique[0]||null;
    };
    const push=(label,target,derived)=>{
      const el=delayField(label.replace(' Delay','')); if(!el)return;
      const canonical=value=>{
        const options=[...el.querySelectorAll('.koMultiselect-dropDownItem,.koSingleselect-dropDownItem,button.smart-list-item,[data-bind*="getOptionDisplay"]')]
          .map(n=>norm(n.textContent)).filter(v=>v.toLowerCase()===value.toLowerCase());
        const unique=[...new Set(options)];return unique.length===1?unique[0]:value;
      };
      out.push({id:el.id,element:el,label,target:Array.isArray(target)?target.map(canonical):canonical(target),mode:'fillBlank',derived,delay:true});
    };
    push('Transport Delay','None','Routine transport default');
    const response=delayField('Response'), destination=delayField('Destination');
    if(!response&&!destination)return out;
    const duration=(a,b)=>{
      const start=timelineDate(a),end=timelineDate(b);
      if(!start||!end)return null;
      if(end<start)throw new Error('Delay timeline is out of order.');
      return (end-start)/1000;
    };
    if(response&&duration('29331','29332')>120)push('Response Delay','Staff delay','Unit Notified by Dispatch → Unit En Route > 120 seconds');
    if(destination&&duration('29338','29342')>1200)push('Destination Delay',['Documentation','ED crowding/transfer of care'],'Destination → Unit Back in Service > 20 minutes');
    return out; // Scene delays are always manual.
  }
  function namedGrid(name) {
    const grids=[...document.querySelectorAll('.grid-control')].filter(visible)
      .filter(g=>norm(g.querySelector('.grid-header .grid-label')?.textContent)===name);
    if(grids.length>1)throw new Error(name+' grid is ambiguous.');
    return grids[0]||null;
  }
  function activationPlan() {
    const g=namedGrid('Hospital Team Activations'); if(!g)return null;
    const lists=g.querySelectorAll('.grid-item-display');
    if(lists.length!==1)return {rule:{label:'Hospital Team Activations',target:'No'},status:'blocked',before:'',note:'List not recognized'};
    if(lists[0].children.length||norm(lists[0].textContent))return null; // Existing entry is handled by normal field rules.
    return {rule:{label:'Hospital Team Activations',target:'No',action:'activation'},el:g,status:'ready',before:'',note:'Add one missing entry; no timestamp is invented'};
  }
  async function addHospitalActivation() {
    const item=activationPlan();
    if(!item||item.status!=='ready')throw new Error('Hospital activation list changed. Review again.');
    const g=item.el, choices=[...g.querySelectorAll('.grid-actions button')].filter(visible)
      .filter(b=>norm(b.textContent)==='Add'&&(b.getAttribute('data-bind')||'').includes('grid.addGridItemWithoutSubformSelection($context)'));
    if(choices.length!==1||disabledChoice(choices[0],g))throw new Error('Hospital activation Add unavailable.');
    choices[0].click();
    const el=await until(()=>{
      const matches=[...g.querySelectorAll('[id="16ccfb92-ef4d-5527-a0ee-39639fd222f4"]')].filter(visible);
      return matches.length===1?matches[0]:null;
    },'Hospital activation entry did not appear.');
    const before=readField(el);
    if(!blank(before)&&!same(before,'No'))throw new Error('Existing activation answer preserved.');
    if(blank(before)){await setChoice(el,'No',before);recordChange({el,before,rule:{id:el.id,label:'Destination Team Pre-Arrival Alert or Activation',target:'No'}});}
  }
  function panelName(){return norm(document.querySelector('#panel-header')?.textContent);}
  function sectionKind() {
    const title=panelName();
    if(/vital/i.test(title)||[...document.querySelectorAll('input[id$="25333Date"]')].some(visible))return 'Vitals';
    if(/procedure|medication|treatment|ventilator|blood product/i.test(title)||[...document.querySelectorAll('.grid-flyout-active .grid-label')].some(n=>norm(n.textContent)==='Procedure'))return 'Treatment';
    if(/transport|destination|flight|refusal/i.test(title))return 'Transport';
    if(/delay/i.test(title))return 'Delays';
    return 'Chart';
  }
  function textAction(scope,text) {
    if(!scope)return null;
    const nodes=[...scope.querySelectorAll('button,a,[role="button"],[data-bind]')].filter(visible);
    const matches=nodes.filter(n=>{
      const content=norm(n.textContent), aria=norm(n.getAttribute('aria-label')||n.getAttribute('title'));
      return (content===text||aria===text)&&(n.matches('button,a,[role="button"]')||/(?:^|,)\s*click\s*:/.test(n.getAttribute('data-bind')||''));
    });
    // A nested caption and its clickable parent represent one action.
    const leaves=matches.filter(n=>!matches.some(other=>other!==n&&n.contains(other)));
    if(leaves.length!==1)return null;
    if(disabledChoice(leaves[0],scope))throw new Error(text+' is disabled.');
    return leaves[0];
  }
  async function automaticTimeline() {
    const visibleTimes=()=>TIMELINE_IDS.some(id=>[...document.querySelectorAll('[id="'+id+'"]')].some(visible));
    const capture=()=>{
      const values=readTimelineSnapshot(true);
      if(values.every(v=>!v)){timelineSnapshot=null;throw new Error('Timeline has no timestamps yet.');}
      for(const prefix of ['29337','29336','29335','29331','29332','29338','29342'])timelineDate(prefix);
    };
    if(visibleTimes()){capture();return;}
    const side=document.querySelector('#right-pane')||document.querySelector('#right-side-pane');
    const opener=textAction(side,'Times')||textAction(side,'Timeline');
    if(!opener)throw new Error('Timeline navigation unavailable. Open Times once and click Read timeline.');
    const chart=timelineChartKey(), previous=panelName();
    opener.click();
    let readError=null;
    try {await until(visibleTimes,'Timeline did not open.');capture();}
    catch(e){readError=e;}
    // The right-pane Times/Timeline control is a toggle. Never click chart Save/OK.
    if(chart===timelineChartKey()&&opener.isConnected&&visibleTimes()) {
      opener.click();
      await until(()=>!visibleTimes() && panelName()===previous,'Timeline did not close. Close it before continuing.');
    }
    if(readError)throw readError;
  }
  async function ensureSection(name) {
    if(panelName()===name)return;
    if([...document.querySelectorAll('.grid-flyout-active')].some(visible))throw new Error('Close the open entry before chart-wide navigation.');
    const nav=document.querySelector('#left-pane');
    let action=textAction(nav,name);
    if(!action) {
      const parent={'Transport Info':'Transport/Refusal','Procedures & Medications':'Treatment','Vital Signs':'Assessment'}[name];
      const group=parent&&textAction(nav,parent);
      if(group){group.click();await sleep(150);action=textAction(nav,name);}
    }
    if(!action)throw new Error('Navigation to '+name+' unavailable.');
    action.click();
    await until(()=>panelName()===name,'Could not open '+name+'.');
  }
  const VITAL_IDS=new Set(RULES.slice(RULES.findIndex(r=>r.label==='AVPU'),RULES.findIndex(r=>r.label==="Procedure Performed Prior to this Unit's EMS Care")).map(r=>r.id));
  function vitalGrid() {
    const candidates=[...document.querySelectorAll('.grid-control')].filter(visible).filter(g=>/^(Vital Signs|Vitals)$/.test(norm(g.querySelector('.grid-header .grid-label')?.textContent)));
    if(candidates.length!==1)throw new Error('Open the multiple-vitals list first.');
    return candidates[0];
  }
  function vitalRows() {
    const g=vitalGrid(), lists=g.querySelectorAll('.grid-item-display');
    if(lists.length!==1)throw new Error('Vital list not recognized.');
    if([...g.querySelectorAll('.grid-filter')].some(b=>!b.classList.contains('grid-button-highlighted')))throw new Error('Show all vital sets before reviewing.');
    return [...lists[0].children].filter(visible);
  }
  function vitalScope() {
    const dates=[...document.querySelectorAll('input[id$="25333Date"]')].filter(visible);
    if(dates.length!==1)throw new Error('Expected one vital entry.');
    return dates[0].closest('.grid-flyout-overlay')||dates[0].closest('.grid-item')||null;
  }
  function vitalPlan(scope) {
    if(!scope)throw new Error('Vital entry container unavailable.');
    const items=[];
    for(const rule of RULES.filter(r=>VITAL_IDS.has(r.id))) {
      const found=[...scope.querySelectorAll('[id="'+rule.id+'"]')].filter(visible);
      if(found.length>1)throw new Error('Duplicate vital control.');
      if(!found.length)continue;
      items.push(inspect({...rule,element:found[0]}));
    }
    return items;
  }
  async function openVitalRow(row) {
    const inline=row.querySelector('input[id$="25333Date"]');
    if(inline&&visible(inline))return {scope:row,modal:false};
    const buttons=[row,...row.querySelectorAll('[data-bind],button')].filter(visible).filter(n=>{
      const binding=n.getAttribute('data-bind')||'';
      return /click\s*:/.test(binding)&&/grid\.(?:open|edit)\w*\s*\(/i.test(binding)&&!/delete|remove|add/i.test(binding);
    });
    const targets=buttons.filter(n=>!buttons.some(x=>x!==n&&n.contains(x)));
    if(targets.length!==1)throw new Error('Vital-row edit control not recognized. A full vitals-list capture is needed.');
    targets[0].click();
    const scope=await until(()=>{try{return vitalScope();}catch(_){return null;}},'Vital entry did not open.');
    return {scope,modal:true};
  }
  async function closeVital(scope,accept) {
    const handler=accept?'okButtonClickHandler':'cancelButtonClickHandler', label=accept?'OK':'Cancel';
    procedureButton(scope,handler,label).click();
    await until(()=>!scope.isConnected||!visible(scope),'Vital entry did not return to the list.');
  }
  async function reviewVitals() {
    const rows=vitalRows(), result=[];
    for(let i=0;i<rows.length;i++) {
      const row=rows[i], fingerprint=norm(row.textContent), opened=await openVitalRow(row);
      try {
        const items=vitalPlan(opened.scope);
        if(!items.length)throw new Error('No known vital metadata controls found.');
        result.push({index:i,fingerprint,items:items.map(x=>({...x,el:null,rule:{...x.rule,element:undefined}}))});
      } finally {if(opened.modal)await closeVital(opened.scope,false);}
    }
    return result;
  }
  async function applyVitalSet(set) {
    const rows=vitalRows(), row=rows[set.index];
    if(!row||norm(row.textContent)!==set.fingerprint)throw new Error('Vital list changed since review.');
    const opened=await openVitalRow(row);
    try {
      for(const item of set.items.filter(x=>x.status==='ready'&&x.selected!==false)) {
        const el=scopedField(opened.scope,item.rule.id);
        await apply({...item,el,rule:{...item.rule,element:el}});
      }
      if(opened.modal)await closeVital(opened.scope,true);
    } catch(e) {throw new Error(e.message+' Review the open vital entry; earlier changes may remain.');}
  }
  const changeJournal=[];
  function recordChange(item) {
    if(!blank(item.before)||item.rule.input&&isProtectedNumericId(item.el.id))return;
    if(changeJournal.some(x=>x.el===item.el&&x.key===timelineChartKey()))return;
    const scope=item.el.closest('.grid-flyout-overlay,.grid-item');
    const entryKey=scope?.querySelector('input[id$="25443Date"],input[id$="25333Date"]')?.id||null;
    changeJournal.push({key:timelineChartKey(),el:item.el,id:item.el.id,entryKey,label:item.rule.label,after:readField(item.el)});
  }
  function clearCandidate(entry) {
    if(entry.key!==timelineChartKey())return false;
    const candidates=[...document.querySelectorAll('[id="'+CSS.escape(entry.id)+'"]')].filter(visible).filter(el=>{
      if(!entry.entryKey)return true;
      const scope=el.closest('.grid-flyout-overlay,.grid-item');
      return !!scope?.querySelector('[id="'+CSS.escape(entry.entryKey)+'"]');
    });
    if(candidates.length!==1)return false;
    entry.el=candidates[0];
    const c=containerOf(entry.el);
    const supported=('value' in entry.el&&!isProtectedNumericId(entry.el.id))||
      [...c.querySelectorAll('.koSingleselect-selectedItem-unselect,.koMultiselect-selectedItem-unselect,.close-container[data-bind*="deselectCurrentModValue"]')].some(visible);
    return supported&&entry.key===timelineChartKey()&&entry.el.isConnected&&visible(entry.el)&&unchanged(readField(entry.el),entry.after);
  }
  async function clearAddedValue(entry) {
    if(!clearCandidate(entry))throw new Error(entry.label+': changed or unavailable; preserved.');
    const el=entry.el,c=containerOf(el);
    if('value' in el&&!isProtectedNumericId(el.id)){nativeSetInput(el,'');}
    else {
      const selectors='.koSingleselect-selectedItem-unselect,.koMultiselect-selectedItem-unselect,.close-container[data-bind*="deselectCurrentModValue"]';
      let removers=[...c.querySelectorAll(selectors)].filter(visible);
      if(!removers.length)throw new Error(entry.label+': clear control not recognized; preserved.');
      for(const remover of removers) {
        if(disabledChoice(remover,c))throw new Error('Clear control disabled.');
        remover.click();await sleep(100);
      }
    }
    await until(()=>blank(readField(el)),entry.label+': clearing did not confirm.');
    changeJournal.splice(changeJournal.indexOf(entry),1);
  }

  const host=document.createElement('div');
  host.id='it-a15-helper-host';
  host.style.cssText='position:fixed;right:16px;top:60px;z-index:2147483645';
  const root=host.attachShadow({mode:'open'});
  root.innerHTML='<style>'+
    ':host{font:13px/1.4 system-ui;color:#182a3d}*{box-sizing:border-box}button{font:inherit;cursor:pointer;padding:8px 11px;border:1px solid #a7b4c0;border-radius:7px;background:#fff;color:#182a3d}button:disabled{opacity:.48;cursor:default}button:focus-visible,input:focus-visible{outline:3px solid #2878b7;outline-offset:2px}#launch,#run{background:#165c88;color:white}section{width:430px;min-width:350px;max-width:94vw;max-height:83vh;overflow:auto;resize:horizontal;background:#fff;border:1px solid #a7b4c0;border-radius:12px;padding:14px;box-shadow:0 10px 30px #0004}header{display:flex;align-items:center;gap:8px;cursor:move}h2{font-size:17px;margin:0;flex:1}small,.meta{font-size:11px;color:#586b7a}nav{display:flex;gap:4px;margin:12px 0;flex-wrap:wrap}nav button{font-size:12px;padding:5px 8px}nav button[aria-selected=true]{background:#183f5b;color:white}.actions{display:flex;align-items:stretch;gap:7px;margin:10px 0}#scan{flex:1;font-weight:700;font-size:15px;padding:12px}#timeline{margin-left:auto;min-width:110px}button[data-state=pending]{background:#ffdf80;color:#49370c}button[data-state=ready]{background:#bde6c7;color:#154424}button[data-state=error]{background:#f6b9b9;color:#721a1a}.row{display:flex;gap:8px;border-top:1px solid #e4e9ed;padding:9px 0}.row input{margin-top:4px}.ready{color:#195a30}.conflict,.manual{color:#8a5400}.blocked{color:#9c2323}#status{padding:9px;background:#edf3f7;border-radius:6px;margin:8px 0}#status[data-error=true]{background:#fce2df;color:#84221a}#log{white-space:pre-wrap;overflow-wrap:anywhere;font:11px/1.5 ui-monospace,monospace;max-height:190px;overflow:auto;background:#f3f5f7;padding:8px}details{margin-top:12px}summary{cursor:pointer;font-weight:600}.danger{background:#b6252b;color:white;border-color:#a51c23}.footer{display:flex;gap:6px;flex-wrap:wrap;margin:8px 0}.modal{position:fixed;inset:0;background:#071524ba;display:flex;align-items:center;justify-content:center;z-index:2147483647}.dialog{width:420px;max-width:92vw;max-height:88vh;overflow:auto;background:#fff6dc;border:3px solid #193d55;border-radius:16px;padding:18px;box-shadow:0 12px 50px #0008}.art{height:195px;overflow:hidden;margin:-18px -18px 15px;background:#193d55}.art img{width:100%;display:block;transform:translateY(-26px)}.dialog h3{font-size:20px;margin:8px 0}.dialog .footer{justify-content:space-between}.dialog button{font-size:15px;font-weight:700}#clearlist{max-height:260px;overflow:auto}[hidden]{display:none!important}'+
    '</style><button id="launch">A15 helper</button><section hidden><header><h2>Routine A15 <small>v0.2.0</small></h2><button id="hide">Minimize</button></header>'+
    '<nav aria-label="Helper sections"></nav><div id="context" class="meta"></div>'+
    '<div class="actions"><button id="scan" data-state="pending">Scan this view</button><button id="timeline" data-state="pending">Read timeline</button></div>'+
    '<button id="whole">Review whole chart</button><div id="status" role="status">Choose Routine A15, then review the proposed changes.</div>'+
    '<div id="rows"></div><label id="acklabel"><input id="ack" type="checkbox"> These selections match the care provided. I reviewed the changes.</label>'+
    '<div class="actions"><button id="run" disabled>Apply selected changes</button></div>'+
    '<div id="cleararea" hidden><p>Clear selected values added by this helper since this page loaded. Existing answers and measured vital values are excluded. Open the relevant entry to make its fields available.</p><div id="clearlist"></div><button id="clearvalues" class="danger" disabled>Clear selected values</button></div>'+
    '<details><summary>Log &amp; testing</summary><div class="footer"><button id="clearlog">Clear log</button><button id="resettest">Reset procedure test</button></div><div id="log"></div></details>'+
    '<p class="meta">Chart Save/submit is never clicked. Missing controls and conflicts stay for review.</p></section>'+
    '<div id="confirm" class="modal" hidden role="dialog" aria-modal="true" aria-labelledby="confirmtitle"><div class="dialog"><div class="art"><img id="artwork" alt="Retro vault mascot giving a thumbs-up beside a cartoon mushroom cloud"></div><h3 id="confirmtitle">Clear selected data?</h3><p>This will nuke the selected chart data. You good with that?</p><p id="clearsummary"></p><div class="footer"><button id="cancelclear">Cancel</button><button id="yesclear" class="danger">Yes, clear it</button></div></div></div>';
  document.body.append(host);
  const $=s=>root.querySelector(s);
  let plan=[],busy=false,planKey='',tab=sectionKind(),lastPanel=panelName(),lastChart=timelineChartKey();
  let timelineState='pending', scanState='pending', clearSelection=[],confirmResolve=null;
  const tabs=['Chart','Treatment','Vitals','Transport','Delays','Clear'];
  const log=t=>{const el=$('#log');el.textContent+=t+'\n';el.scrollTop=el.scrollHeight;};
  function status(text,error=false){$('#status').textContent=text;$('#status').dataset.error=String(error);log(text);}
  function invalidate(){plan=[];planKey='';scanState='pending';$('#rows').replaceChildren();$('#ack').checked=false;updateUI();}
  function updateUI(){
    $('#scan').dataset.state=scanState;$('#timeline').dataset.state=timelineState;
    $('#timeline').textContent=timelineState==='ready'?'Timeline ready':timelineState==='error'?'Timeline error':'Read timeline';
    $('#context').textContent=(panelName()||'Current chart')+' · '+tab;
    $('#cleararea').hidden=tab!=='Clear';
    $('#scan').hidden=tab==='Clear';$('#rows').hidden=tab==='Clear';$('#acklabel').hidden=tab==='Clear';$('#run').hidden=tab==='Clear';
    $('#whole').hidden=tab!=='Chart';
    for(const b of root.querySelectorAll('nav button')){b.setAttribute('aria-selected',String(b.textContent===tab));b.disabled=busy;}
    for(const id of ['scan','timeline','whole','resettest','ack'])$('#'+id).disabled=busy;
    $('#run').disabled=busy||!$('#ack').checked||!plan.some(x=>x.selected&&x.status==='ready');
    $('#clearvalues').disabled=busy||!clearSelection.some(x=>x.selected&&clearCandidate(x.entry));
  }
  function row(label,detail,state,checked,onchange,scope=$('#rows')){
    const div=document.createElement('div');div.className='row';
    const cb=document.createElement('input');cb.type='checkbox';cb.checked=checked;cb.disabled=state!=='ready';
    cb.onchange=()=>{onchange(cb.checked);updateUI();};
    const body=document.createElement('div'), title=document.createElement('div'),meta=document.createElement('div');
    title.className=state;title.textContent=label;meta.className='meta';meta.textContent=detail;body.append(title,meta);div.append(cb,body);scope.append(div);
  }
  function render(){
    $('#rows').replaceChildren();
    for(const item of plan){
      item.selected=item.selected??(item.status==='ready'&&item.kind!=='bundle');
      const label=item.kind==='bundle'?'Add four routine procedures':item.kind==='vitalset'?'Vital set '+(item.index+1):item.rule.label+' → '+(Array.isArray(item.rule.target)?item.rule.target.join(' + '):item.rule.target);
      let detail=item.note||((item.section?item.section+' · ':'')+item.status.toUpperCase()+' · Current: '+(listValue(item.before).join(', ')||'(blank)')+(item.rule.derived?' · '+item.rule.derived:''));
      if(item.kind==='vitalset')detail=item.items.filter(i=>i.status==='ready').length+' metadata changes; '+item.items.filter(i=>i.status==='conflict').length+' conflicts preserved. Measured values untouched.';
      row(label,detail,item.status,item.selected,v=>item.selected=v);
      if(item.kind==='vitalset')for(const child of item.items) {
        const meta=document.createElement('div');meta.className='meta';meta.style.margin='0 0 4px 26px';
        meta.textContent=child.rule.label+': '+(listValue(child.before).join(', ')||'(blank)')+' → '+child.rule.target+' ['+child.status+']';$('#rows').append(meta);
      }
    }
    scanState='ready';$('#ack').checked=false;updateUI();
  }
  function refreshClear(){
    $('#clearlist').replaceChildren();
    clearSelection=changeJournal.filter(e=>e.key===timelineChartKey()).map(entry=>({entry,selected:clearCandidate(entry)}));
    for(const item of clearSelection)row(item.entry.label,listValue(item.entry.after).join(', ')+(clearCandidate(item.entry)?'':' · Open original entry; changed values are preserved'),clearCandidate(item.entry)?'ready':'blocked',item.selected,v=>item.selected=v,$('#clearlist'));
    if(!clearSelection.length)$('#clearlist').textContent='No helper-added values are available to clear in this run.';
    updateUI();
  }
  for(const name of tabs){
    const b=document.createElement('button');b.textContent=name;b.setAttribute('role','tab');
    b.onclick=async()=>{
      if(busy)return;
      if(name==='Clear'){tab=name;refreshClear();return;}
      const target={'Treatment':'Procedures & Medications','Vitals':'Vital Signs','Transport':'Transport Info','Delays':'Delays'}[name];
      if(target&&sectionKind()!==name){
        await task(async()=>{await ensureSection(target);tab=name;invalidate();status('Opened '+target+'.');});
      }else {tab=name;updateUI();}
    };
    root.querySelector('nav').append(b);
  }
  async function task(fn){
    if(busy)return;
    busy=true;updateUI();
    try{await fn();}
    catch(e){status(e.message,true);}
    finally{busy=false;lastPanel=panelName();lastChart=timelineChartKey();updateUI();}
  }
  async function prepareTimeline(force=false) {
    if(!force&&timelineSnapshot&&timelineSnapshot.key===timelineChartKey()&&Date.now()-timelineSnapshot.captured<15*60000){timelineState='ready';return;}
    try{await automaticTimeline();timelineState='ready';}
    catch(e){timelineSnapshot=null;timelineState='error';throw e;}
  }
  function bundleItem(){
    if(sectionKind()!=='Treatment')return null;
    try{
      const timing={arrival:patientArrivalTime(),stretcher:stretcherTime()};
      const fly=[...document.querySelectorAll('.grid-flyout-active')].filter(visible);
      if(fly.length&&!blank(readField(procedureField(procedureFlyout()))))return null;
      if(!fly.length){
        const g=namedGrid('Procedures'), list=g?.querySelector('.grid-item-display');
        if(!g||!list)return null;
        if(list.children.length)return {kind:'bundle',status:'manual',note:'Existing procedures found. Review them individually to avoid duplicates.'};
      }
      return {kind:'bundle',status:'ready',note:'Select only if all four were performed and are missing. Assessments: '+timing.arrival.date+' '+timing.arrival.time+'. Stretcher: '+timing.stretcher.date+' '+timing.stretcher.time+'. Paramedic role.',timing};
    }catch(e){return {kind:'bundle',status:'blocked',note:e.message};}
  }
  async function scanCurrent(){
    invalidate();const section=panelName();
    try{await prepareTimeline();}catch(e){log('Timeline pending: '+e.message);}
    if(sectionKind()==='Vitals'&&!document.querySelector('.grid-flyout-active')){
      plan=(await reviewVitals()).map(x=>({...x,kind:'vitalset',section,status:x.items.some(i=>i.status==='ready')?'ready':'kept'}));
    }else{
      plan=buildPlan().map(x=>({...x,section}));
      const bundle=bundleItem();if(bundle)plan.push({...bundle,section});
    }
    planKey=timelineChartKey();render();status('Review ready: '+plan.filter(x=>x.status==='ready').length+' actions; '+plan.filter(x=>['blocked','manual','conflict'].includes(x.status)).length+' need attention.');
  }
  async function scanWhole(){
    invalidate();const origin=panelName(), all=[];
    try{await prepareTimeline();}catch(e){all.push({rule:{label:'Timeline',target:'read required'},status:'blocked',note:e.message});}
    for(const section of ['STAT Info','Dispatch','History','Vital Signs','Procedures & Medications','Transport Info','Delays']){
      try{
        await ensureSection(section);
        if(section==='Vital Signs'){
          const sets=await reviewVitals();all.push(...sets.map(x=>({...x,kind:'vitalset',section,status:x.items.some(i=>i.status==='ready')?'ready':'kept'})));
        }else{
          all.push(...buildPlan().map(x=>({...x,section,el:null,rule:{...x.rule,element:undefined}})));
          if(section==='Procedures & Medications'){const b=bundleItem();if(b)all.push({...b,section});}
        }
      }catch(e){all.push({rule:{label:section,target:'manual review'},section,status:'blocked',note:e.message});}
    }
    if(origin)try{await ensureSection(origin);}catch(e){log(e.message);}
    plan=all;planKey=timelineChartKey();tab='Chart';render();status('Chart review ready. Unavailable sections are listed for attention; no values have been applied.');
  }
  async function applyPlan(){
    if(planKey!==timelineChartKey())throw new Error('Chart changed. Scan again.');
    const selected=plan.filter(x=>x.selected&&x.status==='ready'), origin=panelName();
    let count=0;
    for(const item of selected){
      if(planKey!==timelineChartKey())throw new Error('Chart changed during apply.');
      if(item.section&&panelName()!==item.section)await ensureSection(item.section);
      if(item.kind==='bundle'){
        const current={arrival:patientArrivalTime(),stretcher:stretcherTime()};
        if(JSON.stringify(current)!==JSON.stringify(item.timing))throw new Error('Procedure timeline changed since review.');
        await addProcedureBundle(name=>log('Added: '+name));
      }else if(item.kind==='vitalset')await applyVitalSet(item);
      else {
        const el=item.rule.action==='activation'?namedGrid('Hospital Team Activations'):oneVisibleById(item.rule.id);
        if(!el)throw new Error('Reviewed field disappeared: '+item.rule.label);
        await apply({...item,el});
      }
      count++;item.status='kept';item.selected=false;
    }
    if(origin&&panelName()!==origin)try{await ensureSection(origin);}catch(e){log(e.message);}
    invalidate();status('Applied '+count+' reviewed actions. Inspect the chart before saving.');
  }
  $('#scan').onclick=()=>task(async()=>{try{await scanCurrent();}catch(e){scanState='error';throw e;}});
  $('#whole').onclick=()=>task(scanWhole);
  $('#timeline').onclick=()=>task(async()=>{invalidate();await prepareTimeline(true);status('Timeline read and previous view restored. Ready for review.');});
  $('#ack').onchange=updateUI;
  $('#run').onclick=()=>{if($('#ack').checked)task(applyPlan);};
  $('#clearlog').onclick=()=>{$('#log').textContent='';};
  $('#resettest').onclick=()=>{
    if(busy)return;
    if(!timelineChartKey())return;
    if(!window.confirm('Reset procedure testing for this chart? Remove previous test entries first. This clears the log and retry lock, not chart entries.'))return;
    for(const key of Object.keys(sessionStorage)){
      if(!key.startsWith('it-a15-procedure-bundle:'))continue;
      try{const u=new URL(key.slice('it-a15-procedure-bundle:'.length));if(u.origin===location.origin&&u.pathname===location.pathname&&u.hash.split('?')[0]===location.hash.split('?')[0])sessionStorage.removeItem(key);}catch(_){}
    }
    invalidate();$('#log').textContent='';status('Procedure test reset. Review before retrying.');
  };
  try{$('#artwork').src=typeof GM_getResourceURL==='function'?GM_getResourceURL('clearArtwork'):'';}catch(_){$('#artwork').hidden=true;}
  function secondWarning(count){
    $('#clearsummary').textContent=count+' selected helper-added values will be cleared. Chart entries themselves will not be deleted.';
    $('#confirm').hidden=false;$('#cancelclear').focus();
    return new Promise(resolve=>confirmResolve=resolve);
  }
  function dismissClear(value){$('#confirm').hidden=true;const resolve=confirmResolve;confirmResolve=null;if(resolve)resolve(value);}
  $('#cancelclear').onclick=()=>dismissClear(false);$('#yesclear').onclick=()=>dismissClear(true);
  $('#confirm').onkeydown=e=>{
    if(e.key==='Escape'){e.preventDefault();dismissClear(false);}
    if(e.key==='Tab'){e.preventDefault();(root.activeElement===$('#cancelclear')?$('#yesclear'):$('#cancelclear')).focus();}
  };
  $('#clearvalues').onclick=()=>task(async()=>{
    const chosen=clearSelection.filter(x=>x.selected).map(x=>x.entry), chart=timelineChartKey();
    if(!chosen.length)return;
    if(!window.confirm('Clear these helper-added values?\n\n'+chosen.map(e=>e.label+' = '+listValue(e.after).join(', ')).join('\n')))return;
    if(!await secondWarning(chosen.length))return;
    if(chart!==timelineChartKey())throw new Error('Chart changed. Nothing cleared.');
    for(const entry of chosen)await clearAddedValue(entry);
    refreshClear();invalidate();status('Cleared '+chosen.length+' selected helper-added values.');
  });
  $('#launch').onclick=()=>{$('section').hidden=false;$('#launch').hidden=true;};
  $('#hide').onclick=()=>{$('section').hidden=true;$('#launch').hidden=false;};
  let drag=null;
  root.querySelector('header').onpointerdown=e=>{
    if(e.target.closest('button'))return;
    const rect=host.getBoundingClientRect();drag={x:e.clientX-rect.left,y:e.clientY-rect.top};e.target.setPointerCapture(e.pointerId);
  };
  root.querySelector('header').onpointermove=e=>{
    if(!drag)return;host.style.right='auto';host.style.left=Math.max(0,Math.min(innerWidth-350,e.clientX-drag.x))+'px';host.style.top=Math.max(0,Math.min(innerHeight-50,e.clientY-drag.y))+'px';
  };
  root.querySelector('header').onpointerup=()=>drag=null;
  document.addEventListener('input',e=>{if(!busy&&!e.composedPath().includes(host)){invalidate();timelineState=timelineSnapshot?'ready':'pending';}},true);
  document.addEventListener('change',e=>{if(!busy&&!e.composedPath().includes(host))invalidate();},true);
  setInterval(()=>{
    if(busy)return;
    const current=panelName(), chart=timelineChartKey();
    if(chart!==lastChart||current!==lastPanel){
      lastChart=chart;lastPanel=current;tab=sectionKind();invalidate();
      if(chart!==planKey)$('#clearlist').replaceChildren();
    }
    if(!timelineSnapshot||Date.now()-timelineSnapshot.captured>15*60000){if(timelineState==='ready')timelineState='pending';}
    if(plan.some(x=>x.el&&(!x.el.isConnected||!unchanged(readField(x.el),x.before))))invalidate();
    updateUI();
  },700);
  updateUI();

})();
