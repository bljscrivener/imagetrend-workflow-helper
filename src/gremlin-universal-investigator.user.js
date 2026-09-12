// ==UserScript==
// @name         Gremlin Universal Investigator (GFI)
// @namespace    gremlin.logic.gfi
// @version      0.3.2
// @description  Universal read-only DOM investigator with normalized exports, iPad/Safari element capture, help, and ImageTrend metadata adapter.
// @match        *://*/*
// @grant        none
// @run-at       document-idle
// @noframes
// @updateURL    https://raw.githubusercontent.com/bljscrivener/imagetrend-workflow-helper/gfi-0.3.2/src/gremlin-universal-investigator.user.js
// @downloadURL  https://raw.githubusercontent.com/bljscrivener/imagetrend-workflow-helper/gfi-0.3.2/src/gremlin-universal-investigator.user.js
// ==/UserScript==

(() => {
  'use strict';

  const VERSION = '0.3.2';
  const SCHEMA = 'gfi.capture/1';
  const HOST_ID = 'gfi-control-host';
  const SESSION_KEY = 'gfi.sessionId';

  if (document.getElementById(HOST_ID)) return;

  const norm = value => String(value ?? '').replace(/[\u200b\u00ad]/g, '').replace(/\s+/g, ' ').trim();
  const uuid = () => (crypto?.randomUUID ? crypto.randomUUID() : `gfi-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  const safeText = (el, max = 500) => norm(el?.textContent).slice(0, max);
  const isImageTrend = /imagetrend/i.test(location.hostname) || !!window.imagetrend;
  const sessionId = sessionStorage.getItem(SESSION_KEY) || `gfi-session-${uuid()}`;
  sessionStorage.setItem(SESSION_KEY, sessionId);

  const escapeCss = value => window.CSS?.escape ? CSS.escape(value) : String(value).replace(/([ #;.?+*~':\"!^$[\]()=>|/@])/g, '\\$1');

  function selectorFor(el) {
    if (!el || el.nodeType !== 1) return null;
    if (el.id) return `#${escapeCss(el.id)}`;
    const parts = [];
    let node = el;
    let depth = 0;
    while (node && node.nodeType === 1 && node !== document.body && depth < 5) {
      let part = node.tagName.toLowerCase();
      const cls = [...node.classList].slice(0, 2).map(c => `.${escapeCss(c)}`).join('');
      if (cls) part += cls;
      const parent = node.parentElement;
      if (parent) {
        const same = [...parent.children].filter(x => x.tagName === node.tagName);
        if (same.length > 1) part += `:nth-of-type(${same.indexOf(node) + 1})`;
      }
      parts.unshift(part);
      node = parent;
      depth += 1;
    }
    return parts.join(' > ');
  }

  function attributesOf(el) {
    const out = {};
    for (const attr of [...(el?.attributes || [])]) {
      const name = attr.name.toLowerCase();
      if (['value','srcdoc'].includes(name)) continue;
      if (/password|secret|token|authorization|cookie/i.test(name)) continue;
      out[attr.name] = attr.value;
    }
    return out;
  }

  function eventBindingsOf(el) {
    const attrs = attributesOf(el);
    return Object.fromEntries(Object.entries(attrs).filter(([k]) => k === 'data-bind' || /^on/i.test(k) || /actioncontextual/i.test(k)));
  }

  function rectOf(el) {
    const r = el?.getBoundingClientRect?.();
    return r ? {x:r.x,y:r.y,width:r.width,height:r.height} : null;
  }

  function elementRecord(el, eventType = null) {
    return {
      selector: selectorFor(el),
      tag: el?.tagName || null,
      id: el?.id || null,
      classes: typeof el?.className === 'string' ? el.className : '',
      role: el?.getAttribute?.('role') || null,
      type: el?.getAttribute?.('type') || null,
      name: el?.getAttribute?.('name') || null,
      ariaLabel: el?.getAttribute?.('aria-label') || null,
      text: safeText(el),
      attributes: attributesOf(el),
      eventBindings: eventBindingsOf(el),
      eventType,
      rect: rectOf(el)
    };
  }

  function summarizeValue(value) {
    if (value == null) return value;
    if (['string','number','boolean'].includes(typeof value)) return value;
    if (Array.isArray(value)) return {type:'array', length:value.length};
    if (typeof value === 'object') return {type:'object', keys:Object.keys(value).slice(0,40)};
    return String(value);
  }

  function knockoutContext(el) {
    if (!isImageTrend || !window.ko?.contextFor) return [];
    const out = [];
    let node = el;
    for (let depth = 0; node && depth < 8; depth += 1, node = node.parentElement) {
      try {
        const ctx = ko.contextFor(node);
        const data = ctx?.$data;
        if (!data || typeof data !== 'object') continue;
        const likely = {};
        for (const [k,v] of Object.entries(data)) {
          if (!/(crew|unit|shift|role|level|device|incident|validation|viewer|status|permission|attachment|cad)/i.test(k)) continue;
          try {
            const unwrapped = window.ko?.unwrap ? ko.unwrap(v) : v;
            likely[k] = summarizeValue(unwrapped);
          } catch (_) {}
        }
        if (Object.keys(likely).length) out.push({depth, tag:node.tagName, id:node.id || null, likely});
      } catch (_) {}
    }
    return out;
  }

  function pageInfo() {
    return {
      origin: location.origin,
      pathname: location.pathname,
      title: document.title,
      imageTrend: isImageTrend
    };
  }

  function deviceInfo() {
    return {
      platform: navigator.platform,
      userAgent: navigator.userAgent,
      language: navigator.language,
      touchPoints: navigator.maxTouchPoints,
      viewport: {width:innerWidth,height:innerHeight,dpr:devicePixelRatio}
    };
  }

  function normalizedHeader({captureType,captureMethod,sourceId=null,eventType=null}) {
    const capturedAt = new Date().toISOString();
    const safeTitle = norm(document.title || 'page').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,60) || 'page';
    const stamp = capturedAt.replace(/[:.]/g,'-');
    return {
      schemaVersion: SCHEMA,
      investigatorVersion: VERSION,
      captureId: `gfi-${uuid()}`,
      sessionId,
      parentCaptureId: null,
      friendlyName: '',
      tags: [],
      profileId: 'default',
      captureType,
      captureMethod,
      capturedAt,
      sourceId,
      status: 'raw',
      flags: [],
      relationships: [],
      provenance: {source:'dom',adapter:isImageTrend?'imagetrend':'generic',derived:false,eventType},
      page: pageInfo(),
      device: deviceInfo(),
      exportHints: {
        suggestedFilename: `${captureType}-${safeTitle}-${stamp}.txt`,
        mimeType: 'text/plain',
        reportSection: captureType
      }
    };
  }

  function captureElement(el, eventType = 'manual') {
    return {
      header: normalizedHeader({captureType:'element',captureMethod:'element-pick',sourceId:el?.id || selectorFor(el),eventType}),
      data: {
        element: elementRecord(el,eventType),
        imageTrend: {},
        knockout: knockoutContext(el),
        ancestors: (() => {
          const arr=[]; let node=el; let depth=0;
          while (node && node.nodeType===1 && depth<8) { arr.push(elementRecord(node,eventType)); node=node.parentElement; depth+=1; }
          return arr;
        })()
      },
      notes: [
        'Read-only investigator capture.',
        'Input values are intentionally excluded from exported attributes.',
        'Capture-phase pointer/touch listeners are used for iPad/Safari compatibility.',
        'ImageTrend metadata is added only when ImageTrend/Knockout context is present.',
        'GFI never calls preventDefault, stopPropagation, click, input, change, submit, or setter APIs on the inspected page.'
      ]
    };
  }

  function capturePage() {
    const all = [...document.querySelectorAll('*')];
    const candidates = all.filter(el => {
      const r = el.getBoundingClientRect?.();
      const attr = el.id || el.className || el.getAttribute?.('role') || el.getAttribute?.('data-bind');
      return attr || ['INPUT','BUTTON','SELECT','TEXTAREA','A','FORM'].includes(el.tagName) || (r && r.width && r.height && safeText(el,120));
    });
    return {
      header: normalizedHeader({captureType:'page',captureMethod:'page-scan'}),
      data: {
        counts: {
          candidates:candidates.length,
          buttons:document.querySelectorAll('button').length,
          links:document.querySelectorAll('a').length,
          inputs:document.querySelectorAll('input,textarea,select').length
        },
        elements:candidates.map(el => elementRecord(el,null))
      },
      notes:['Read-only page scan.','Input values are not exported.','Use TXT export for large captures intended for ChatGPT.']
    };
  }

  function reportText(report) {
    return [
      'GFI NORMALIZED CAPTURE',
      `Schema: ${report.header.schemaVersion}`,
      `Investigator: ${report.header.investigatorVersion}`,
      `Capture: ${report.header.captureType}`,
      `Captured: ${report.header.capturedAt}`,
      `Page: ${report.header.page.title}`,
      `Origin: ${report.header.page.origin}`,
      '',
      '--- JSON ---',
      JSON.stringify(report,null,2)
    ].join('\n');
  }

  function downloadReport(report) {
    const text = reportText(report);
    const blob = new Blob([text], {type:'text/plain;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = report.header.exportHints.suggestedFilename;
    a.rel = 'noopener';
    document.documentElement.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function copyReport(report) {
    const text = reportText(report);
    try { await navigator.clipboard.writeText(text); return true; }
    catch (_) {
      const ta = document.createElement('textarea');
      ta.value = text; ta.readOnly = true; ta.style.cssText='position:fixed;left:-9999px;top:-9999px;opacity:0';
      document.documentElement.appendChild(ta); ta.select();
      const ok = document.execCommand?.('copy') || false; ta.remove(); return ok;
    }
  }

  let lastReport = null;
  let inspectArmed = false;
  let lastHover = null;

  const host = document.createElement('div');
  host.id = HOST_ID;
  host.style.cssText = 'position:fixed;right:12px;top:90px;z-index:2147483647;pointer-events:auto';
  const root = host.attachShadow({mode:'open'});
  root.innerHTML = `
    <style>
      :host{all:initial} *{box-sizing:border-box;font-family:system-ui,-apple-system,sans-serif}
      .panel{width:238px;background:#111d29;color:#eef6ff;border:1px solid #52708c;border-radius:12px;box-shadow:0 8px 26px #0006;overflow:hidden}
      .head{display:flex;align-items:center;justify-content:space-between;padding:9px 10px;background:#1a2c3e;font-weight:700}.ver{font-size:11px;opacity:.75}
      .body{padding:8px;display:grid;grid-template-columns:1fr 1fr;gap:7px}button{border:1px solid #6e8ba4;border-radius:8px;background:#243b50;color:#fff;padding:8px 6px;font-size:12px}button:active{transform:translateY(1px)}
      .wide{grid-column:1/-1}.danger{background:#513333}.armed{background:#1c6845}.msg{grid-column:1/-1;font-size:11px;line-height:1.3;background:#0c1620;border-radius:7px;padding:7px;min-height:32px}.help{display:none;padding:9px;font-size:11px;line-height:1.45;border-top:1px solid #3d5266;background:#0d1822}.help.open{display:block}.help b{color:#fff}
    </style>
    <div class="panel">
      <div class="head"><span>GFI</span><span class="ver">v${VERSION} · READ ONLY</span></div>
      <div class="body">
        <button id="pick">Inspect element</button><button id="page">Scan page</button>
        <button id="copy">Copy last</button><button id="export">Export last</button>
        <button id="clear" class="danger">Clear last</button><button id="help">Help</button>
        <div id="msg" class="msg">Ready. GFI does not modify the inspected page.</div>
      </div>
      <div id="helpbox" class="help"><b>Inspect element</b>: arms one read-only pointer/touch capture. Tap the target normally; GFI observes the capture-phase event but does not cancel or synthesize it.<br><br><b>Scan page</b>: inventories DOM metadata across the current page. Field values are excluded.<br><br><b>Copy last</b>: copies the newest capture only, preventing accidental reassessment of stale logs.<br><br><b>Export last</b>: downloads a normalized TXT containing a readable header plus JSON. Use this for large captures in ChatGPT.<br><br><b>Clear last</b>: removes GFI's in-memory capture reference only. It does not alter the site.<br><br><b>Policy</b>: GFI is observational. It never overwrites chart data or invokes site actions.</div>
    </div>`;
  document.documentElement.appendChild(host);

  const $ = id => root.getElementById(id);
  const msg = text => { $('msg').textContent = text; };

  function disarm() {
    inspectArmed = false;
    $('pick').classList.remove('armed');
    $('pick').textContent = 'Inspect element';
  }

  function handleInspectEvent(ev) {
    if (!inspectArmed) return;
    if (ev.composedPath?.().includes(host)) return;
    const target = ev.target instanceof Element ? ev.target : null;
    if (!target) return;
    lastReport = captureElement(target, ev.type);
    disarm();
    msg(`Captured ${lastReport.data.element.selector || lastReport.data.element.tag}. Use Copy or Export.`);
  }

  // Passive capture listeners: observe only. Do not prevent, stop, mutate, or synthesize.
  document.addEventListener('pointerdown', handleInspectEvent, {capture:true, passive:true});
  document.addEventListener('touchstart', handleInspectEvent, {capture:true, passive:true});

  $('pick').addEventListener('click', () => {
    inspectArmed = !inspectArmed;
    $('pick').classList.toggle('armed', inspectArmed);
    $('pick').textContent = inspectArmed ? 'Tap target…' : 'Inspect element';
    msg(inspectArmed ? 'Inspection armed. Tap an element normally.' : 'Inspection cancelled.');
  });

  $('page').addEventListener('click', () => {
    lastReport = capturePage();
    msg(`Page scan captured ${lastReport.data.counts.candidates} candidates. Export recommended for large scans.`);
  });

  $('copy').addEventListener('click', async () => {
    if (!lastReport) return msg('No capture available.');
    const ok = await copyReport(lastReport);
    msg(ok ? 'Newest capture copied.' : 'Clipboard copy failed; use Export.');
  });

  $('export').addEventListener('click', () => {
    if (!lastReport) return msg('No capture available.');
    downloadReport(lastReport);
    msg(`Exported ${lastReport.header.exportHints.suggestedFilename}`);
  });

  $('clear').addEventListener('click', () => {
    lastReport = null;
    disarm();
    msg('GFI in-memory capture cleared. Site unchanged.');
  });

  $('help').addEventListener('click', () => $('helpbox').classList.toggle('open'));

  window.GFI = Object.freeze({
    version: VERSION,
    policy: 'read-only',
    captureElement: el => { lastReport = captureElement(el,'api'); return lastReport; },
    capturePage: () => { lastReport = capturePage(); return lastReport; },
    getLastCapture: () => lastReport,
    clear: () => { lastReport = null; },
    exportLast: () => lastReport && downloadReport(lastReport)
  });
})();
