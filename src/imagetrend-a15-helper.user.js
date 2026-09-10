// ==UserScript==
// @name         ImageTrend A15 MVP helper
// @namespace    local.imagetrend.workflow
// @version      0.1.10
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
      if (name === 'Moving a patient to a stretcher') {
        const timing = stretcherTime(), fields = procedureTimeInputs(procedureFlyout());
        for (const part of ['date','time']) out.push({element:fields[part],id:fields[part].id,label:'Stretcher procedure '+part,target:timing[part],input:true,mode:'procedureTime',derived:'Depart Scene minus 2 minutes; fallback Arrived on Scene plus 2 minutes; replaces current timestamp after review'});
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
    for (const rule of [...RULES,...derivedRules()]) {
      try { const x=inspect(rule); if (x) results.push(x); }
      catch(e) { results.push({rule,el:null,status:'blocked',before:'',note:e.message}); }
    }
    const et=[...document.querySelectorAll(`${FORM} input[id$="25352"]`)].filter(visible);
    const units=oneVisibleById('01975843-3408-5a00-b45b-79e64e0db108');
    if (et.length===1 && units && blank(et[0].value) && same(readField(units),'mmHg')) results.push({rule:{id:units.id,label:'ETCO2 Units',target:'blank'},el:units,status:'manual',before:'mmHg',note:'ETCO2 blank: deselect mmHg manually for now.'});
    return results;
  }
  async function apply(item) {
    const {rule,el,before}=item;
    if (!el || item.status!=='ready') return;
    if (rule.input) {
      if (rule.mode === 'procedureTime') {
        const timing = stretcherTime(), part = el.id.endsWith('Date') ? 'date' : 'time';
        if (rule.target !== timing[part]) throw new Error('Timeline changed since review. Scan again.');
      }
      if (!unchanged(readField(el),before)) throw new Error(`${rule.label}: changed since review.`);
      nativeSetInput(el,rule.target); await sleep(120);
      if (!same(readField(el),rule.target)) throw new Error(`${rule.label}: ImageTrend did not confirm input change.`);
    } else await setChoice(el,rule.target,before);
  }




  let timelineSnapshot = null;
  const TIMELINE_IDS = ['29337Date','29337Time','29336Date','29336Time','29335Date','29335Time'];
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
    if (name === 'Moving a patient to a stretcher') {
      const currentTiming = stretcherTime();
      if (JSON.stringify(currentTiming) !== JSON.stringify(timing)) throw new Error('Timeline changed during bundle.');
      const inputs = procedureTimeInputs(f);
      nativeSetInput(inputs.date, timing.date);
      nativeSetInput(inputs.time, timing.time);
      await sleep(150);
      if (norm(inputs.date.value) !== timing.date || norm(inputs.time.value) !== timing.time)
        throw new Error('ImageTrend did not confirm stretcher time.');
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
    const timing = stretcherTime();
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

  const host=document.createElement('div');
  host.id='it-a15-helper-host'; host.style.cssText='position:fixed;right:16px;top:64px;z-index:2147483645';
  const root=host.attachShadow({mode:'open'});
  root.innerHTML=`<style>:host{font:13px system-ui;color:#162637}*{box-sizing:border-box}button{font:inherit;border:1px solid #9eacbb;border-radius:7px;padding:8px 11px;background:white;color:#162637;cursor:pointer}button:disabled{opacity:.5}#launch,#run{background:#164f78;color:white}section{width:min(540px,92vw);max-height:82vh;overflow:auto;background:#fff;border:1px solid #9eacbb;border-radius:12px;box-shadow:0 10px 34px #0004;padding:16px}header{display:flex;justify-content:space-between;align-items:center}h2{margin:0}.actions{display:flex;gap:8px;margin:10px 0}.row{display:grid;grid-template-columns:20px 1fr;gap:8px;padding:8px 0;border-top:1px solid #e4e9ef}.meta{font-size:11px;color:#5a6878}.ready{color:#155c2b}.kept{color:#4d6073}.conflict{color:#8a4d00}.blocked,.manual{color:#8b1e1e}#log{font:12px/1.45 ui-monospace,monospace;white-space:pre-wrap;background:#f5f7f9;padding:8px;border-radius:6px}[hidden]{display:none!important}</style><button id="launch">A15 helper</button><section hidden><header><h2>Routine A15 <small>v0.1.10</small></h2><button id="hide">Minimize</button></header><p>Scans this open ImageTrend view only. Conflicts are preserved. Measured clinical numbers are never written.</p><div class="actions"><button id="timeline">Read timeline</button><button id="scan">Scan this view</button><button id="run" disabled>Apply reviewed fields</button></div><label><input id="ack" type="checkbox"> I reviewed the proposed changes for this chart.</label><div id="rows"></div><hr><p><strong>Add four procedures</strong>: Assessment -ALS; Neurological assessment; Adult pain assessment; Moving a patient to a stretcher.</p><p class="meta">Start on Procedures &amp; Medications with an empty procedure list, or a blank Procedure entry. Opens Add automatically, then uses Add Another and OK. Sets role to Paramedic on all four; stretcher time to Depart Scene minus 2 minutes; fallback Arrived on Scene plus 2 minutes. First open Timeline and click Read timeline; then return here. Review other times and clinical details afterward.</p><label><input id="procack" type="checkbox"> These four procedures were performed, are missing from this chart, and I want to add them with Paramedic role and the stated stretcher time.</label><p><button id="procrun" disabled>Add four procedures</button></p><p class="meta">No automatic chart Save/submit. Procedure timing and ETCO2 clearing remain manual.</p><button id="clearlog" type="button">Clear log</button> <button id="resettest" type="button">Reset procedure test</button><div id="log"></div></section>`;
  document.body.append(host);
  const $=s=>root.querySelector(s); let plan=[],busy=false,planUrl='';
  const log=t=>{$('#log').textContent+=`${t}\n`;};
  function invalidate(){plan=[];planUrl='';$('#rows').textContent='';$('#ack').checked=false;$('#run').disabled=true;}
  function render(items){$('#rows').textContent='';for(const item of items){const row=document.createElement('div');row.className='row';const cb=document.createElement('input');cb.type='checkbox';cb.checked=item.status==='ready';cb.disabled=item.status!=='ready';item.check=cb;const body=document.createElement('div');const title=document.createElement('div');title.className=item.status;title.textContent=`${item.rule.label} -> ${item.rule.target}`;const meta=document.createElement('div');meta.className='meta';const cur=Array.isArray(item.before)?item.before.join(', '):norm(item.before);meta.textContent=`${item.status.toUpperCase()} | current: ${cur||'(blank)'}${item.rule.derived?` | ${item.rule.derived}`:''}${item.note?` | ${item.note}`:''}`;body.append(title,meta);row.append(cb,body);$('#rows').append(row);}}
  $('#clearlog').onclick=()=>{$('#log').textContent='';};
  $('#resettest').onclick=()=>{
    if(busy){log('Wait for the current run to finish before resetting.');return;}
    const chart=location.hash.match(/\/Incident\d+\/Form42(?=$|[/?])/);
    if(!chart){log('Open a Form42 chart before resetting.');return;}
    if(!window.confirm('Reset testing for this chart? This clears the log and allows the procedure bundle to run again. It does not delete any procedures. Remove entries from the previous test first to avoid duplicates.'))return;
    const prefix='it-a15-procedure-bundle:';
    for(const key of Object.keys(sessionStorage)){
      if(!key.startsWith(prefix))continue;
      try {
        const stored=new URL(key.slice(prefix.length));
        const match=stored.hash.match(/\/Incident\d+\/Form42(?=$|[/?])/);
        if(stored.origin===location.origin && stored.pathname===location.pathname && match?.[0]===chart[0])sessionStorage.removeItem(key);
      }catch(_){/* Leave unrelated or unrecognized keys intact. */}
    }
    invalidate();
    $('#procack').checked=false;
    $('#procrun').disabled=true;
    $('#log').textContent='';
  };

  $('#timeline').onclick=()=>{
    if(busy)return;
    invalidate();
    try {const t=stretcherTime(true); log('Timeline read for this chart. Stretcher time: '+t.date+' '+t.time+'. Return to Procedures. Valid for 15 minutes; read again after timeline edits.');}
    catch(e){log('Timeline: '+e.message);}
  };
  $('#procack').onchange=()=>{$('#procrun').disabled=busy||!$('#procack').checked;};
  $('#procrun').onclick=async()=>{
    if(busy||!$('#procack').checked)return;
    busy=true; invalidate(); $('#scan').disabled=true; $('#procrun').disabled=true; $('#procack').disabled=true;
    try {
      await addProcedureBundle(name=>log('Procedure entered: '+name));
      log('Four procedure selections entered and flyout closed. Review the procedure list, dates/times, and details. Chart Save was not clicked.');
    } catch(e) { log('Procedure bundle STOPPED: '+e.message); log('Earlier entries may remain. Review the procedure list and open entry.'); }
    finally { busy=false; $('#scan').disabled=false; $('#procack').disabled=false; $('#procack').checked=false; $('#procrun').disabled=true; }
  };
  $('#launch').onclick=()=>{$('section').hidden=false;$('#launch').hidden=true;}; $('#hide').onclick=()=>{$('section').hidden=true;$('#launch').hidden=false;};
  $('#ack').onchange=()=>{$('#run').disabled=busy||!plan.length||!$('#ack').checked||!plan.some(x=>x.status==='ready'&&x.check?.checked);}; window.addEventListener('hashchange',invalidate);
  $('#scan').onclick=()=>{invalidate();$('#log').textContent='';try{if(!/\/Incident\d+\/Form42(?:$|[/?])/.test(location.hash))throw new Error('Open an ImageTrend Form42 incident chart.');plan=buildPlan();planUrl=location.href;render(plan);const r=plan.filter(x=>x.status==='ready').length,c=plan.filter(x=>x.status==='conflict').length,m=plan.filter(x=>x.status==='manual'||x.status==='blocked').length;log(`Found ${plan.length} recognized A15 fields: ${r} ready; ${c} conflicts; ${m} manual/blocked.`);}catch(e){log(`Scan stopped: ${e.message}`);}};
  $('#run').onclick=async()=>{if(busy||!plan.length||!$('#ack').checked)return;if(location.href!==planUrl){log('Stopped: chart/view changed. Scan again.');invalidate();return;}busy=true;$('#scan').disabled=true;$('#run').disabled=true;$('#ack').disabled=true;let changed=0;try{for(const item of plan.filter(x=>x.status==='ready'&&x.check?.checked)){if(location.href!==planUrl)throw new Error('Chart/view changed during run.');await apply(item);changed++;log(`Set: ${item.rule.label} -> ${item.rule.target}`);await sleep(180);}log(`Complete: ${changed} field(s) changed. Review the chart. Save was not clicked.`);}catch(e){log(`STOPPED after ${changed} confirmed change(s): ${e.message}`);log('Earlier changes remain; inspect this chart before continuing.');}finally{busy=false;$('#scan').disabled=false;$('#ack').disabled=false;invalidate();}};
})();
