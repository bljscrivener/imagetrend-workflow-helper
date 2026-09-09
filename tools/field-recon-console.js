(() => {
  const norm = s => String(s ?? '')
    .replace(/[\u200b\u00ad]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  const visible = el => !!el &&
    el.getClientRects().length > 0 &&
    getComputedStyle(el).visibility !== 'hidden' &&
    getComputedStyle(el).display !== 'none';

  const escape = value => {
    if (window.CSS?.escape) return CSS.escape(value);
    return String(value).replace(/([ #;.?+*~':"!^$[\]()=>|/@])/g, '\\$1');
  };

  const selectedSection = (() => {
    const el = document.querySelector(
      '#nav-cube .selected, #nav-cube [aria-selected="true"], #nav-cube .active'
    );
    return norm(el?.textContent) || '(nested/section not resolved)';
  })();

  const ignored = el =>
    el.id === 'search-box' ||
    !!el.closest('#incident-status, #nav-cube, header, nav');

  const explicitLabel = el => {
    if (el.labels?.length) {
      const text = norm([...el.labels].map(x => x.textContent).join(' '));
      if (text) return text.replace(/:$/, '');
    }

    if (el.id) {
      const label = document.querySelector(`label[for="${escape(el.id)}"]`);
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

    const text = norm(container.textContent);
    if (!text) return '';

    const colon = text.indexOf(':');
    if (colon > 0 && colon < 140) return text.slice(0, colon).trim();

    return '';
  };

  const contextualLabel = el => {
    const direct = explicitLabel(el);
    if (direct) return direct;

    let node = el.parentElement;
    let depth = 0;

    while (node && node !== document.body && depth < 7) {
      const label = containerLabel(node);
      if (label) return label;
      node = node.parentElement;
      depth += 1;
    }

    return '';
  };

  const meaningfulContainer = el => {
    if (el.matches('button.smart-list-item')) {
      return el.closest('.smart-list-control') || el.parentElement;
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

    // Plain vital/value inputs often carry the only stable ID themselves.
    // Keep the input as the field identity, but infer its label from ancestors.
    return el;
  };

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
      : `${typeKey}:${contextualLabel(control)}:${[...document.querySelectorAll('*')].indexOf(container)}`;

    if (!groups.has(key)) {
      groups.set(key, { container, controls: [], typeKey, stableId });
    }
    groups.get(key).controls.push(control);
  }

  const fields = [];

  for (const { container, controls: groupControls, typeKey, stableId } of groups.values()) {
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

  fields.sort((a, b) => {
    const aEl = a.id ? document.getElementById(a.id) : null;
    const bEl = b.id ? document.getElementById(b.id) : null;
    if (!aEl || !bEl || aEl === bEl) return 0;
    return aEl.compareDocumentPosition(bEl) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
  });

  const report = {
    reconVersion: '2.0.0',
    capturedAt: new Date().toISOString(),
    url: location.href,
    section: selectedSection,
    fieldCount: fields.length,
    fields
  };

  console.log(report);
  copy(JSON.stringify(report, null, 2));
  console.log(`ImageTrend recon v2 copied ${fields.length} grouped fields to clipboard.`);
})();
