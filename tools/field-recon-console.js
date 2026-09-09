(() => {
  const norm = s => String(s ?? '')
    .replace(/[\u200b\u00ad]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  const visible = el => !!el &&
    el.getClientRects().length > 0 &&
    getComputedStyle(el).visibility !== 'hidden' &&
    getComputedStyle(el).display !== 'none';

  const composer = document.querySelector('#form-composer');
  if (!composer) throw new Error('ImageTrend #form-composer not found.');

  const section = (() => {
    const selected = document.querySelector('#nav-cube .selected, #nav-cube [aria-selected="true"], #nav-cube .active');
    return norm(selected?.textContent) || '(section not resolved)';
  })();

  const containers = [...composer.querySelectorAll('[id]')]
    .filter(visible)
    .filter(el => {
      const hasLabel = !!el.querySelector('label');
      const hasSmartList = !!el.querySelector('button.smart-list-item');
      const hasSingleSelect = !!el.querySelector('kosingleselect, .koSingleselect');
      const hasInput = !!el.querySelector('input, textarea, select');
      const hasAction = !!el.querySelector('button.button-control');
      return hasLabel && (hasSmartList || hasSingleSelect || hasInput || hasAction);
    });

  const seen = new Set();
  const fields = [];

  for (const el of containers) {
    if (seen.has(el.id)) continue;
    seen.add(el.id);

    const label = norm(el.querySelector('label')?.textContent).replace(/:$/, '');
    const selectedSmart = [...el.querySelectorAll('button.smart-list-item.selected')]
      .filter(visible)
      .map(b => norm(b.textContent))
      .filter(Boolean);

    const smartChoices = [...el.querySelectorAll('button.smart-list-item')]
      .map(b => norm(b.textContent))
      .filter(Boolean);

    const dropdownValues = [...el.querySelectorAll('.koSingleselect-selectedItem-value')]
      .map(v => norm(v.textContent))
      .filter(Boolean)
      .filter(v => v !== 'Not Recorded');

    const dropdownChoices = [...el.querySelectorAll('.koSingleselect-dropDownItem')]
      .map(o => norm(o.textContent))
      .filter(Boolean);

    const inputs = [...el.querySelectorAll('input, textarea, select')]
      .filter(visible)
      .map(input => ({
        tag: input.tagName,
        id: input.id || null,
        name: input.getAttribute('name'),
        type: input.getAttribute('type'),
        value: 'value' in input ? input.value : null,
        placeholder: input.getAttribute('placeholder')
      }));

    const actions = [...el.querySelectorAll('button.button-control')]
      .filter(visible)
      .map(b => ({
        id: b.id || null,
        text: norm(b.textContent),
        disabled: !!b.disabled
      }));

    let controlType = 'unknown';
    if (smartChoices.length) controlType = 'smart-list';
    else if (el.querySelector('kosingleselect, .koSingleselect')) controlType = 'koSingleselect';
    else if (actions.length) controlType = 'action-button';
    else if (inputs.length) controlType = 'input';

    fields.push({
      id: el.id,
      label,
      controlType,
      current: selectedSmart[0] ?? dropdownValues[0] ?? inputs[0]?.value ?? '',
      choices: smartChoices.length ? smartChoices : dropdownChoices,
      inputs,
      actions,
      className: typeof el.className === 'string' ? el.className : ''
    });
  }

  const report = {
    capturedAt: new Date().toISOString(),
    url: location.href,
    section,
    fieldCount: fields.length,
    fields
  };

  console.log(report);
  copy(JSON.stringify(report, null, 2));
  console.log(`Copied ${fields.length} ImageTrend fields to clipboard.`);
})();
