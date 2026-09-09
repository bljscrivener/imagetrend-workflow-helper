// ==UserScript==
// @name         ImageTrend STAT workflow helper
// @namespace    local.imagetrend.workflow
// @version      1.1.0
// @description  Review and apply the demonstrated STAT Info choices.
// @match        https://pafford.imagetrendelite.com/Elite/Organizationpafford/Agencypmsmsboliv/EmsRunForm*
// @grant        none
// @run-at       document-idle
// @noframes
// ==/UserScript==

(() => {
  'use strict';
  if (location.hostname !== 'pafford.imagetrendelite.com' ||
      !location.pathname.startsWith('/Elite/Organizationpafford/Agencypmsmsboliv/EmsRunForm')) return;
  if (document.getElementById('it-stat-helper')) return;

  const steps = [
    ['95cf67b7-74f0-5a19-b258-08c7b96ef8d6', 'Unit Disposition', 'Patient Contact Made'],
    ['a5db14f5-8f30-5131-937c-912204f5151d', 'Type of Service Requested', 'Emergency Response (Primary Response Area)'],
    ['ffbe72d1-96b3-53c5-a4a1-530b61be4635', "Number of Pt's at Scene", 'Single'],
    ['ccc317e4-c422-592f-b490-2f3d1473be56', 'Cardiac Arrest', 'No'],
    ['57f37db6-1c94-5266-8734-10cc7c7f3903', 'Possible Stroke', 'No'],
    ['a21c0596-9e23-54f5-868e-a3809e80c27f', 'Traumatic Injury', 'No'],
    ['ed8c85c1-75e0-ed11-bfb9-001dd8b72ccf', 'Is a STEMI probable?', 'No'],
    ['66032c95-5556-5d89-a6fc-369c5b53509b', 'Work-Related Illness/Injury', 'No'],
    ['8224dbe2-d85a-5cb1-8108-61264de6dd1b', 'Incident/Pt Disposition', 'Transport - Pt Treated, Transported by this Unit'],
    ['249d37ae-50e7-523e-89a9-99e79c86c69d', 'Patient Evaluation/Care', 'Patient Evaluated and Care Provided'],
    ['e4a449b1-be1e-5803-9ff2-533f42478c13', 'Crew Disposition', 'Initiated and Continued Primary Care'],
    ['cfb7f889-af42-5a1b-8018-a55dfa923e00', 'Transport Disposition', 'Transport by This EMS Unit (This Crew Only)']
  ].map(([id, label, value]) => ({id, label, value}));
  const norm = s => String(s ?? '').replace(/[\u200b\u00ad]/g, '').replace(/\s+/g, ' ').trim();
  const visible = el => !!el && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
  function field(step) {
    const matches = document.querySelectorAll(`[id="${step.id}"]`);
    if (matches.length !== 1) throw Error(`${step.label}: missing or duplicate field. Open STAT Info.`);
    const el = matches[0];
    if (!el.closest('#form-composer') || !visible(el)) throw Error(`${step.label}: field is not available.`);
    const label = norm(el.querySelector('label')?.textContent).replace(/:$/, '');
    if (label !== step.label) throw Error(`${step.label}: field label changed.`);
    if (el.closest('[disabled], [aria-disabled="true"]')) throw Error(`${step.label}: form is read-only.`);
    return el;
  }
  function current(el) {
    const selected = [...el.querySelectorAll('button.smart-list-item.selected')];
    if (selected.length > 1) throw Error('Ambiguous selection.');
    if (selected.length) return norm(selected[0].textContent);
    const values = [...el.querySelectorAll('.koSingleselect-selectedItem-value')];
    if (values.length > 1) throw Error('Ambiguous dropdown value.');
    const value = norm(values[0]?.textContent);
    return value === 'Not Recorded' ? '' : value;
  }
  function target(el, step) {
    const buttons = [...el.querySelectorAll('button.smart-list-item')].filter(b => norm(b.textContent) === step.value);
    if (buttons.length === 1) return {node: buttons[0], dropdown: false};
    if (buttons.length > 1) throw Error(`${step.label}: ambiguous button.`);
    const options = [...el.querySelectorAll('.koSingleselect-dropDownItem')].filter(b => norm(b.textContent) === step.value);
    if (options.length !== 1) throw Error(`${step.label}: expected choice is missing or ambiguous.`);
    return {node: options[0], dropdown: true};
  }
  function inspect(step) {
    const el = field(step);
    const value = current(el);
    if (value && value !== step.value) throw Error(`${step.label}: existing answer differs (${value}). Review it manually or uncheck this step.`);
    const found = target(el, step);
    if (found.node.disabled || found.node.getAttribute('aria-disabled') === 'true') throw Error(`${step.label}: choice is disabled.`);
    return value;
  }

  const host = document.createElement('div');
  host.id = 'it-stat-helper';
  host.style.cssText = 'position:fixed;right:16px;top:64px;z-index:2147483646';
  const root = host.attachShadow({mode: 'open'});
  root.innerHTML = `<style>
    :host{font:14px system-ui;color:#182536}*{box-sizing:border-box}button{font:inherit;cursor:pointer;border:1px solid #aab8c9;border-radius:6px;padding:9px 12px;background:white;color:#182536}button:disabled{opacity:.5;cursor:default}
    #launcher{background:#174f78;color:white;box-shadow:0 3px 12px #0003}section{width:min(430px,90vw);max-height:80vh;overflow:auto;background:#fff;border:1px solid #9aabbd;border-radius:12px;box-shadow:0 8px 32px #0004;padding:18px}h2{font-size:18px;margin:0}header{display:flex;justify-content:space-between;align-items:center;gap:8px}p{line-height:1.45}label.step{display:flex;gap:9px;padding:9px 0;border-bottom:1px solid #e4e9ef}input{accent-color:#174f78}small{display:block;color:#526277;margin-top:3px}.actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}#run{background:#174f78;color:white}#log{white-space:pre-wrap;font:12px/1.5 system-ui;max-height:160px;overflow:auto}#ackrow{display:flex;gap:8px;margin-top:14px}[hidden]{display:none!important}
    </style><button id="launcher" type="button">STAT helper</button><section hidden>
    <header><h2>STAT workflow</h2><button type="button" id="hide">Minimize</button></header>
    <p>Review this chart and include only answers that apply. These choices reproduce your demonstrated workflow.</p>
    <div id="rows"></div>
    <label class="step"><input type="checkbox" id="address" checked><span>Patient address actions<small>1. Pt Address Same as Incident Location<br>2. Pt Address Zip Code Lookup<br>May replace the current patient address. Review lookup results afterward.</small></span></label>
    <label id="ackrow"><input type="checkbox" id="ack">I reviewed these choices for this chart.</label>
    <div class="actions"><button type="button" id="review">Check fields</button><button type="button" id="run" disabled>Run reviewed choices</button><button type="button" id="stop" disabled>Stop</button></div>
    <p><small>Leaves times, other patient details, acuity, and complaints unchanged. Does not click Save or submit. ImageTrend may persist field changes automatically.</small></p>
    <div id="log" role="status" aria-live="polite"></div></section>`;
  document.body.append(host);
  const $ = s => root.querySelector(s);
  const rows = steps.map(step => {
    const row = document.createElement('label'); row.className = 'step';
    const check = document.createElement('input'); check.type = 'checkbox'; check.checked = true;
    const text = document.createElement('span'); text.textContent = step.label;
    const value = document.createElement('small'); value.textContent = step.value; text.append(value);
    row.append(check, text); $('#rows').append(row);
    check.addEventListener('change', invalidate);
    return {...step, check};
  });
  let review = null, busy = false, stopped = false;
  const copyAddress = ['PatientAddressSameAsIncidentAddressButton', 'Pt Address Same as Incident Location'];
  const lookupAddress = ['PatientAddressPostalCodeLookupButton', 'Pt Address Zip Code Lookup'];
  function actionButton([id, text], requireEnabled = true) {
    const containers = document.querySelectorAll(`[id="${id}"]`);
    if (containers.length !== 1 || !containers[0].closest('#form-composer')) throw Error(`${text}: missing or ambiguous control.`);
    const matches = [...containers[0].querySelectorAll('button.button-control')].filter(b => norm(b.textContent) === text);
    if (matches.length !== 1 || !visible(matches[0])) throw Error(`${text}: button unavailable.`);
    const b = matches[0];
    if (requireEnabled && (b.disabled || b.classList.contains('disabled') || b.closest('[disabled], [aria-disabled="true"]'))) throw Error(`${text}: button disabled.`);
    return b;
  }
  function addressValues() {
    return ['24955', '24956', '24960', '24957', '24958', '24959'].map(id => {
      const matches = document.querySelectorAll(`input[id="${id}"]`);
      if (matches.length !== 1 || !matches[0].closest('#form-composer')) throw Error('Patient address fields unavailable.');
      return norm(matches[0].value);
    });
  }
  $('#address').onchange = invalidate;
  function invalidate() {review = null; $('#run').disabled = true; $('#ack').checked = false;}
  function say(message) {$('#log').textContent += `${message}\n`; $('#log').scrollTop = $('#log').scrollHeight;}
  function guard(url) {
    if (stopped) throw Error('Stopped by user.');
    if (location.href !== url) throw Error('Chart changed. Review again.');
  }
  async function until(predicate, url) {
    const end = Date.now() + 4000;
    while (Date.now() < end) {guard(url); if (predicate()) return; await new Promise(r => setTimeout(r, 100));}
    throw Error('Timed out waiting for the chart to confirm the change.');
  }
  $('#launcher').onclick = () => { $('section').hidden = false; $('#launcher').hidden = true; };
  $('#hide').onclick = () => { $('section').hidden = true; $('#launcher').hidden = false; };
  $('#ack').onchange = () => {$('#run').disabled = busy || !review || !$('#ack').checked;};
  $('#stop').onclick = () => {stopped = true;};
  window.addEventListener('hashchange', () => {stopped = true; invalidate();});
  $('#review').onclick = () => {
    invalidate(); $('#log').textContent = '';
    try {
      if (!/\/Incident\d+\/Form42(?:$|[/?])/.test(location.hash)) throw Error('Open the expected Form42 incident chart.');
      const chosen = rows.filter(r => r.check.checked);
      const address = $('#address').checked;
      if (!chosen.length && !address) throw Error('Include at least one step.');
      const snapshots = chosen.map(s => ({step: s, before: inspect(s)}));
      let addressBefore = null;
      if (address) {actionButton(copyAddress); actionButton(lookupAddress, false); addressBefore = JSON.stringify(addressValues());}
      review = {url: location.href, snapshots, address, addressBefore};
      snapshots.forEach(({step, before}) => say(`${before === step.value ? 'Already set' : 'Ready'}: ${step.label} → ${step.value}`));
      if (address) say('Ready: copy incident address to patient, then open ZIP lookup. Existing patient address may be replaced.');
      say('Check the review confirmation, then Run.');
    } catch (e) {say(`Check stopped: ${e.message}`);}
  };
  $('#run').onclick = async () => {
    if (busy || !review || !$('#ack').checked) return;
    const plan = review; busy = true; stopped = false;
    $('#run').disabled = true; $('#review').disabled = true; $('#stop').disabled = false; $('#ack').disabled = true;
    rows.forEach(r => r.check.disabled = true);
    $('#address').disabled = true;
    let changed = 0;
    try {
      guard(plan.url);
      for (const {step, before} of plan.snapshots) if (inspect(step) !== before) throw Error(`${step.label}: answer changed since review.`);
      if (plan.address && JSON.stringify(addressValues()) !== plan.addressBefore) throw Error('Patient address changed since review.');
      for (const {step, before} of plan.snapshots) {
        guard(plan.url);
        const value = inspect(step);
        if (value === step.value) {say(`Kept: ${step.label}`); continue;}
        if (value !== before) throw Error(`${step.label}: answer changed during the run.`);
        let el = field(step), found = target(el, step);
        if (found.dropdown) {
          const toggle = el.querySelector('button.koSingleselect-down-button');
          if (!toggle || toggle.disabled) throw Error(`${step.label}: dropdown unavailable.`);
          if (!visible(found.node)) toggle.click();
          await until(() => visible(target(field(step), step).node), plan.url);
          el = field(step); found = target(el, step);
        }
        guard(plan.url);
        if (!visible(found.node) || found.node.disabled) throw Error(`${step.label}: target is not available.`);
        found.node.click();
        await until(() => current(field(step)) === step.value, plan.url);
        changed++; say(`Set: ${step.label} → ${step.value}`);
        await new Promise(r => setTimeout(r, 250));
      }
      for (const {step} of plan.snapshots) {guard(plan.url); if (current(field(step)) !== step.value) throw Error(`${step.label}: final verification failed.`);}
      if (plan.address) {
        guard(plan.url);
        if (JSON.stringify(addressValues()) !== plan.addressBefore) throw Error('Patient address changed during the run. Review again.');
        actionButton(copyAddress).click();
        say('Clicked: Pt Address Same as Incident Location.');
        await new Promise(r => setTimeout(r, 600));
        await until(() => {const values = addressValues(); return !!values[0] && !!values[2];}, plan.url);
        guard(plan.url);
        actionButton(lookupAddress).click();
        say('Clicked: Pt Address Zip Code Lookup. Review the populated address or any lookup dialog; no lookup result was selected automatically.');
      }
      say(`Complete. ${changed} field(s) changed. Review the chart; Save was not clicked.`);
    } catch (e) {say(`Stopped: ${e.message}\n${changed} field(s) confirmed changed. Earlier changes remain; inspect the chart before continuing.`);}
    finally {busy = false; invalidate(); $('#review').disabled = false; $('#stop').disabled = true; $('#ack').disabled = false; $('#address').disabled = false; rows.forEach(r => r.check.disabled = false);}
  };
})();
