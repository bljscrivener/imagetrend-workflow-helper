// ==UserScript==
// @name         ImageTrend Field Recon
// @namespace    local.imagetrend.workflow
// @version      0.1.0
// @description  Read-only ImageTrend field reconnaissance helper. Copies grouped visible field metadata to the clipboard.
// @match        https://pafford.imagetrendelite.com/Elite/Organizationpafford/Agencypmsmsboliv/EmsRunForm*
// @grant        none
// @run-at       document-idle
// @noframes
// @updateURL    https://raw.githubusercontent.com/bljscrivener/imagetrend-workflow-helper/bljscrivener/gre-36-build-imagetrend-field-reconnaissance-registry/src/imagetrend-recon.user.js
// @downloadURL  https://raw.githubusercontent.com/bljscrivener/imagetrend-workflow-helper/bljscrivener/gre-36-build-imagetrend-field-reconnaissance-registry/src/imagetrend-recon.user.js
// ==/UserScript==

(() => {
  'use strict';

  if (document.getElementById('it-field-recon-host')) return;

  const norm = s => String(s ?? '')
    .replace(/[\u200b\u00ad]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  const visible = el => !!el &&
    el.getClientRects().length > 0 &&
    getComputedStyle(el).visibility !== 'hidden' &&
    getComputedStyle(el).display !== 'none';

  const escapeCss = value => {
    if (window.CSS?.escape) return CSS.escape(value);
    return String(value).replace(/([ #;.?+*~':"!^$[\]()=>|/@])/g, '\\$1');
  };

  const selectedSection = () => {
    const el = document.querySelector(
      '#nav-cube .selected, #nav-cube [aria-selected="true"], #nav-cube .active'
    );
    return norm(el?.textContent) || '(nested/section not resolved)';
  };

  const ignored = el =>
    !el ||
    el.id === 'search-box' ||
    !!el.closest('#incident-status, #nav-cube, header, nav, #it-field-recon-host, #it-stat-helper');

  const explicitLabel = el => {
    if (el.labels?.length) {
      const text = norm([...el.labels].map(x => x.textContent).join(' '));
      if (text) return text.replace(/:$/, '');
    }

    if (el.id) {
      const label = document.querySelector(`label[for="${escapeCss(el.id)}"]`);
      const text = norm(label?.textContent);
      if (text) return text.replace(/:$/, '');
    }

    return '';
  };

  const containerLabel = container => {
    if (!container) return '';

    const labels = [...container.querySelectorAll('label')]
      .filter(visible)
      .map(x => norm(x.textContent).replace(/:$/, ''))
      .filter(Boolean);

    if (labels.length) return labels[0];

    const ownText = [...container.childNodes]
      .filter(node => node.nodeType === Node.TEXT_NODE)
      .map(node => norm(node.textContent))
      .filter(Boolean)
      .join(' ');

    if (ownText) {
      const colon = ownText.indexOf(':');
      if (colon > 0 && colon < 140) return ownText.slice(0, colon).trim();
    }

    const text = norm(container.textContent);
    const colon = text.indexOf(':');
    if (colon > 0 && colon < 140) return text.slice(0, colon).trim();

    return '';
  };

  const contextualLabel = el => {
    const direct = explicitLabel(el);
    if (direct) return direct;

    let node = el.parentElement;
    let depth = 0;
    while (node && node !== document.body && depth < 8) {
      const label = containerLabel(node);
      if (label) return label;
      node = node.parentElement;
      depth += 1;
    }
    return '';
  };

  const meaningfulContainer = el => {
    if (el.matches('button.smart-list-item')) {
      return el.closest('.smart-list-control') || el.closest('[id]') || el.parentElement;
    }

    if (el.matches('kosingleselect, .koSingleselect, .koSingleselect-selectedItem-value')) {
      return el.closest('.single-row-control') || el.closest('[id]') || el.parentElement;
    }

    if (el.matches('.koMultiselect-searchbar-input, komultiselect, .koMultiselect')) {
      return el.closest('.single-row-control') || el.closest('[id]') || el.parentElement;
    }

    if (el.matches('button.button-control')) {
      return el.closest('.single-row-control, .smart-list-control') || el.closest('[id]') || el.parentElement;
    }

    return el;
  };

  function buildReport() {
    const controls = [...document.querySelectorAll([
      'button.smart-list-item',
      'kosingleselect',
      '.koSingleselect',
      '.koMultiselect-searchbar-input',
      'komultiselect',
      '.koMultiselect',
      'input:not(.koSingleselect-searchbar-input):not(.koMultiselect-searchbar-input)',
      'textarea',
      'select',
      'button.button-control'
    ].join(','))]
      .filter(visible)
      .filter(el => !ignored(el));

    const groups = new Map();

    for (const control of controls) {
      const container = meaningfulContainer(control);
      if (!container || ignored(container)) continue;

      const stableId = container.id || control.id || '';
      const typeKey = control.matches('button.smart-list-item') ? 'smart-list' :
        control.matches('kosingleselect, .koSingleselect, .koSingleselect-selectedItem-value') ? 'koSingleselect' :
        control.matches('.koMultiselect-searchbar-input, komultiselect, .koMultiselect') ? 'koMultiselect' :
        control.matches('button.button-control') ? 'action-button' :
        control.matches('textarea') ? 'textarea' :
        control.matches('select') ? 'select' : 'input';

      const key = stableId
        ? `${typeKey}:${stableId}`
        : `${typeKey}:${contextualLabel(control)}:${controls.indexOf(control)}`;

      if (!groups.has(key)) {
        groups.set(key, {container, controls: [], typeKey, stableId});
      }
      groups.get(key).controls.push(control);
    }

    const fields = [];

    for (const {container, controls: groupControls, typeKey, stableId} of groups.values()) {
      const label = containerLabel(container) || contextualLabel(groupControls[0]);

      const smartChoices = typeKey === 'smart-list'
        ? [...container.querySelectorAll('button.smart-list-item')]
            .filter(visible)
            .map(b => ({
              text: norm(b.textContent),
              selected: b.classList.contains('selected') || b.getAttribute('aria-pressed') === 'true',
              disabled: !!b.disabled || b.getAttribute('aria-disabled') === 'true'
            }))
            .filter(x => x.text)
        : [];

      const selectedSmart = smartChoices.filter(x => x.selected).map(x => x.text);

      const singleCurrent = typeKey === 'koSingleselect'
        ? norm(container.querySelector('.koSingleselect-selectedItem-value')?.textContent)
        : '';

      const singleChoices = typeKey === 'koSingleselect'
        ? [...container.querySelectorAll('.koSingleselect-dropDownItem')]
            .map(o => norm(o.textContent))
            .filter(Boolean)
        : [];

      const multiSelected = typeKey === 'koMultiselect'
        ? [...container.querySelectorAll(
            '.koMultiselect-selectedItem, .koMultiselect-selected-item, [class*="koMultiselect"][class*="selected"]'
          )]
            .filter(visible)
            .map(x => norm(x.textContent))
            .filter(Boolean)
        : [];

      const multiChoices = typeKey === 'koMultiselect'
        ? [...container.querySelectorAll(
            '.koMultiselect-dropDownItem, .koMultiselect-dropdown-item, [class*="koMultiselect"][class*="dropDownItem"]'
          )]
            .map(x => norm(x.textContent))
            .filter(Boolean)
        : [];

      const inputs = groupControls
        .filter(x => x.matches('input, textarea, select'))
        .map(input => ({
          tag: input.tagName,
          id: input.id || '',
          type: input.getAttribute('type') || '',
          value: 'value' in input ? input.value : '',
          placeholder: input.getAttribute('placeholder') || '',
          ariaLabel: input.getAttribute('aria-label') || '',
          disabled: !!input.disabled
        }));

      const actions = typeKey === 'action-button'
        ? groupControls.map(b => ({
            id: b.id || '',
            text: norm(b.textContent),
            disabled: !!b.disabled || b.getAttribute('aria-disabled') === 'true'
          }))
        : [];

      let current = '';
      let choices = [];

      if (typeKey === 'smart-list') {
        current = selectedSmart.length === 1 ? selectedSmart[0] : selectedSmart;
        choices = smartChoices.map(x => x.text);
      } else if (typeKey === 'koSingleselect') {
        current = singleCurrent === 'Not Recorded' ? '' : singleCurrent;
        choices = singleChoices;
      } else if (typeKey === 'koMultiselect') {
        current = multiSelected;
        choices = multiChoices;
      } else if (inputs.length) {
        current = inputs.length === 1 ? inputs[0].value : inputs.map(x => x.value);
      }

      fields.push({
        id: stableId,
        label,
        controlType: typeKey,
        current,
        choices,
        inputs,
        actions,
        containerClass: typeof container.className === 'string' ? container.className : ''
      });
    }

    return {
      reconVersion: '2.1.0',
      capturedAt: new Date().toISOString(),
      url: location.href,
      section: selectedSection(),
      fieldCount: fields.length,
      fields
    };
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (_) {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;left:-9999px;top:-9999px';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    }
  }

  const host = document.createElement('div');
  host.id = 'it-field-recon-host';
  host.style.cssText = 'position:fixed;right:16px;top:112px;z-index:2147483647';

  const root = host.attachShadow({mode: 'open'});
  root.innerHTML = `
    <style>
      button{font:13px system-ui;border:1px solid #9fb2c7;border-radius:7px;padding:8px 11px;background:#263b4f;color:#fff;cursor:pointer;box-shadow:0 3px 12px #0003}
      button:disabled{opacity:.6;cursor:default}
      #msg{margin-top:6px;padding:5px 7px;max-width:280px;background:#fff;color:#182536;border:1px solid #b7c3d0;border-radius:6px;font:12px system-ui;box-shadow:0 3px 12px #0002}
      [hidden]{display:none!important}
    </style>
    <button id="recon" type="button" title="Read visible ImageTrend fields and copy JSON. Does not alter the chart.">Recon this view</button>
    <div id="msg" hidden></div>`;

  document.body.appendChild(host);

  const button = root.querySelector('#recon');
  const msg = root.querySelector('#msg');
  let timer = null;

  const show = text => {
    clearTimeout(timer);
    msg.textContent = text;
    msg.hidden = false;
    timer = setTimeout(() => { msg.hidden = true; }, 5000);
  };

  button.addEventListener('click', async () => {
    button.disabled = true;
    try {
      const report = buildReport();
      const json = JSON.stringify(report, null, 2);
      const copied = await copyText(json);
      console.log('ImageTrend recon report:', report);
      if (!copied) throw new Error('Clipboard copy failed. The report is in DevTools Console.');
      show(`Copied ${report.fieldCount} grouped fields. Paste them into ChatGPT.`);
    } catch (error) {
      console.error('ImageTrend recon failed:', error);
      show(`Recon failed: ${error.message}`);
    } finally {
      button.disabled = false;
    }
  });
})();
