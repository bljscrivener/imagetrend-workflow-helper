// ==UserScript==
// @name         Gremlin Universal Investigator (GFI)
// @namespace    gremlin.logic.gfi
// @version      0.3.5
// @description  Universal DOM investigator with integrated inspect safety lock, file-first iPad handoff, movable mini UI, help, and ImageTrend metadata adapter.
// @match        *://*/*
// @grant        none
// @run-at       document-idle
// @noframes
// @updateURL    https://raw.githubusercontent.com/bljscrivener/imagetrend-workflow-helper/gfi-0.3.5/src/gremlin-universal-investigator.user.js
// @downloadURL  https://raw.githubusercontent.com/bljscrivener/imagetrend-workflow-helper/gfi-0.3.5/src/gremlin-universal-investigator.user.js
// ==/UserScript==

(() => {
  'use strict';

  const VERSION = '0.3.5';
  const SCHEMA = 'gfi.capture/1';
  const HOST_ID = 'gfi-control-host';
  const SESSION_KEY = 'gfi.sessionId';
  const PREF_KEY = 'gfi.ui.v1';
  const RECENT_KEY = 'gfi.recentFiles.v1';
  const MAX_RECENT = 5;
  const BLOCK_MS = 1400;

  if (document.getElementById(HOST_ID)) return;

  const norm = value => String(value ?? '').replace(/[\u200b\u00ad]/g, '').replace(/\s+/g, ' ').trim();
  const uuid = () => (crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);
  const safeText = (el, max = 500) => norm(el?.textContent).slice(0, max);
  const isImageTrend = /imagetrend/i.test(location.hostname) || !!window.imagetrend;
  const sessionId = sessionStorage.getItem(SESSION_KEY) || `gfi-session-${uuid()}`;
  sessionStorage.setItem(SESSION_KEY, sessionId);

  const readJson = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key) || '') ?? fallback; }
    catch (_) { return fallback; }
  };
  const writeJson = (key, value) => {
    try { localStorage.setItem(key, JSON.stringify(value)); }
    catch (_) {}
  };

  const prefs = Object.assign({mode:'mini', x:null, y:null, safety:true}, readJson(PREF_KEY, {}));
  if (typeof prefs.safety !== 'boolean') prefs.safety = true;
  let recentFiles = Array.isArray(readJson(RECENT_KEY, [])) ? readJson(RECENT_KEY, []).slice(0, MAX_RECENT) : [];

  const escapeCss = value => window.CSS?.escape ? CSS.escape(value) : String(value).replace(/([ #;.?+*~':\"!^$[\]()=>|/@])/g, '\\$1');

  function selectorFor(el) {
    if (!el || el.nodeType !== 1) return null;
    if (el.id) return `#${escapeCss(el.id)}`;
    const parts = [];
    let node = el;
    for (let depth = 0; node && node.nodeType === 1 && node !== document.body && depth < 5; depth += 1, node = node.parentElement) {
      let part = node.tagName.toLowerCase();
      const cls = [...node.classList].slice(0, 2).map(c => `.${escapeCss(c)}`).join('');
      if (cls) part += cls;
      const parent = node.parentElement;
      if (parent) {
        const same = [...parent.children].filter(x => x.tagName === node.tagName);
        if (same.length > 1) part += `:nth-of-type(${same.indexOf(node) + 1})`;
      }
      parts.unshift(part);
    }
    return parts.join(' > ');
  }

  function attributesOf(el) {
    const out = {};
    for (const attr of [...(el?.attributes || [])]) {
      const name = attr.name.toLowerCase();
      if (['value','srcdoc'].includes(name)) continue;
      if (/password|secret|token|authorization|cookie/i.test(name)) continue;
      out[attr.name] = String(attr.value).slice(0, 1800);
    }
    return out;
  }

  function eventBindingsOf(el) {
    const attrs = attributesOf(el);
    return Object.fromEntries(Object.entries(attrs).filter(([k]) => k === 'data-bind' || /^on/i.test(k) || /action|event|click|command/i.test(k)));
  }

  function rectOf(el) {
    const r = el?.getBoundingClientRect?.();
    return r ? {x:r.x,y:r.y,width:r.width,height:r.height} : null;
  }

  function elementRecord(el, eventType = null) {
    return {
      selector:selectorFor(el), tag:el?.tagName || null, id:el?.id || null,
      classes:typeof el?.className === 'string' ? el.className : '',
      role:el?.getAttribute?.('role') || null,
      type:el?.getAttribute?.('type') || null,
      name:el?.getAttribute?.('name') || null,
      ariaLabel:el?.getAttribute?.('aria-label') || null,
      text:safeText(el), attributes:attributesOf(el), eventBindings:eventBindingsOf(el), eventType, rect:rectOf(el)
    };
  }

  function summarizeValue(value) {
    if (value == null) return value;
    if (['string','number','boolean'].includes(typeof value)) return value;
    if (Array.isArray(value)) return {type:'array',length:value.length};
    if (typeof value === 'object') return {type:'object',keys:Object.keys(value).slice(0,40)};
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
          if (!/(crew|unit|shift|role|level|device|incident|validation|viewer|status|permission|attachment|cad|control|binding|label|type|provider)/i.test(k)) continue;
          try {
            const unwrapped = window.ko?.unwrap ? ko.unwrap(v) : v;
            likely[k] = summarizeValue(unwrapped);
          } catch (_) {}
        }
        if (Object.keys(likely).length) out.push({depth,tag:node.tagName,id:node.id || null,likely});
      } catch (_) {}
    }
    return out;
  }

  function pageInfo() {
    return {origin:location.origin,pathname:location.pathname,title:document.title,imageTrend:isImageTrend};
  }

  function deviceInfo() {
    return {
      platform:navigator.platform,userAgent:navigator.userAgent,language:navigator.language,
      touchPoints:navigator.maxTouchPoints,viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio}
    };
  }

  function normalizedHeader({captureType,captureMethod,sourceId=null,eventType=null}) {
    const capturedAt = new Date().toISOString();
    const safeTitle = norm(document.title || 'page').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,60) || 'page';
    const stamp = capturedAt.replace(/[:.]/g,'-');
    return {
      schemaVersion:SCHEMA, investigatorVersion:VERSION, captureId:`gfi-${uuid()}`, sessionId,
      parentCaptureId:null, friendlyName:'', tags:[], profileId:'default', captureType, captureMethod,
      capturedAt, sourceId, status:'raw', flags:[], relationships:[],
      provenance:{source:'dom',adapter:isImageTrend?'imagetrend':'generic',derived:false,eventType},
      page:pageInfo(), device:deviceInfo(),
      investigatorPolicy:{
        mode:'read-only', mutationAllowed:false,
        inspectionSafety:prefs.safety ? 'on' : 'off',
        interactionSuppression:!!prefs.safety,
        inspectionMayActivateTarget:!prefs.safety
      },
      exportHints:{
        suggestedFilename:`${captureType}-${safeTitle}-${stamp}.txt`,
        mimeType:'text/plain', reportSection:captureType, primaryHandoff:'file', locatorBridge:'clipboard-filename'
      }
    };
  }

  function captureElement(el, eventType='manual') {
    return {
      header:normalizedHeader({captureType:'element',captureMethod:'element-pick',sourceId:el?.id || selectorFor(el),eventType}),
      data:{
        element:elementRecord(el,eventType), imageTrend:{}, knockout:knockoutContext(el),
        ancestors:(() => { const arr=[]; let node=el; for(let d=0;node&&node.nodeType===1&&d<8;d+=1,node=node.parentElement) arr.push(elementRecord(node,eventType)); return arr; })()
      },
      notes:[
        'Read-only investigator capture.',
        'Input values are intentionally excluded from exported attributes.',
        prefs.safety ? 'Inspect safety was ON: the target interaction was observed and suppressed.' : 'Inspect safety was OFF: the target interaction was allowed to continue.'
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
      header:normalizedHeader({captureType:'page',captureMethod:'page-scan'}),
      data:{
        counts:{candidates:candidates.length,buttons:document.querySelectorAll('button').length,links:document.querySelectorAll('a').length,inputs:document.querySelectorAll('input,textarea,select').length},
        elements:candidates.map(el => elementRecord(el,null))
      },
      notes:['Read-only page scan.','Input values are not exported.','File save is the primary iPad handoff; only the exact filename is copied to the clipboard.']
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
      `Inspect safety: ${report.header.investigatorPolicy.inspectionSafety}`,
      '', '--- JSON ---', JSON.stringify(report,null,2)
    ].join('\n');
  }

  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); return true; }
    catch (_) {
      try {
        const ta=document.createElement('textarea'); ta.value=text; ta.readOnly=true;
        ta.style.cssText='position:fixed;left:-9999px;top:-9999px;opacity:0';
        document.documentElement.appendChild(ta); ta.focus(); ta.select();
        const ok=document.execCommand?.('copy') || false; ta.remove(); return ok;
      } catch (_) { return false; }
    }
  }

  function requestDownload(report) {
    const filename = report.header.exportHints.suggestedFilename;
    const blob = new Blob([reportText(report)], {type:'text/plain;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href=url; a.download=filename; a.rel='noopener'; a.style.display='none';
    document.documentElement.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1500);
    return filename;
  }

  function rememberFile(filename, report) {
    recentFiles = [{filename, savedAt:new Date().toISOString(), captureType:report.header.captureType}, ...recentFiles.filter(x => x.filename !== filename)].slice(0,MAX_RECENT);
    writeJson(RECENT_KEY,recentFiles);
  }

  let lastReport = null;
  let lastSavedFingerprint = null;
  let inspectArmed = false;
  let unsaved = false;
  let blockedTarget = null;
  let blockedUntil = 0;

  const host = document.createElement('div');
  host.id = HOST_ID;
  host.style.cssText = 'position:fixed;z-index:2147483647;pointer-events:auto;touch-action:none';
  const root = host.attachShadow({mode:'open'});
  root.innerHTML = `
    <style>
      :host{all:initial}*{box-sizing:border-box;font-family:system-ui,-apple-system,sans-serif}
      .panel{width:252px;background:#111d29;color:#eef6ff;border:1px solid #52708c;border-radius:12px;box-shadow:0 8px 26px #0006;overflow:hidden;user-select:none}
      .head{display:flex;align-items:center;gap:7px;padding:8px 9px;background:#1a2c3e;font-weight:700;cursor:grab;touch-action:none}.head:active{cursor:grabbing}.title{flex:1}.ver{font-size:10px;opacity:.75}.badge{font-size:10px;padding:2px 5px;border-radius:999px;background:#2a4359}.dirty{background:#8b5e16}.safe{background:#17603d}.unsafe{background:#8b2d2d}
      .body{padding:8px;display:grid;grid-template-columns:1fr 1fr;gap:7px}.mini .body{grid-template-columns:repeat(3,1fr)}
      button{border:1px solid #6e8ba4;border-radius:8px;background:#243b50;color:#fff;padding:8px 6px;font-size:12px}.primary{background:#1c6845}.danger{background:#513333}.armed{background:#8b5e16}.ghost{background:#172736}.safetyOn{background:#17603d}.safetyOff{background:#7a2929}
      .status{grid-column:1/-1;font-size:11px;line-height:1.3;background:#0c1620;border-radius:7px;padding:7px;min-height:31px;word-break:break-word}.fileline{grid-column:1/-1;display:flex;gap:5px;align-items:center}.filename{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:10px;background:#0b141d;padding:6px;border-radius:6px}.filecopy{padding:6px 8px;font-size:10px}
      .fullOnly{display:block}.mini .fullOnly{display:none}.mini .panel{width:270px}.mini .status{min-height:28px}.mini .head{padding:7px 8px}.mini .body{padding:7px}
      .help{display:none;padding:9px;font-size:11px;line-height:1.45;border-top:1px solid #3d5266;background:#0d1822}.help.open{display:block}.help b{color:#fff}.recent{margin-top:6px;padding-top:6px;border-top:1px solid #334155}.recent div{margin:2px 0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    </style>
    <div id="wrap" class="${prefs.mode === 'mini' ? 'mini' : ''}">
      <div class="panel">
        <div id="drag" class="head"><span class="title">GFI</span><span id="typebadge" class="badge">IDLE</span><span id="safebadge" class="badge">SAFE</span><span class="ver">v${VERSION}</span><button id="mode" class="ghost" type="button">${prefs.mode === 'mini' ? 'Full' : 'Mini'}</button></div>
        <div class="body">
          <button id="pick">Inspect</button><button id="page">Scan</button><button id="save" class="primary">Save</button>
          <button id="safety" class="fullOnly" type="button"></button><button id="clear" class="danger fullOnly">Clear</button><button id="help" class="fullOnly">Help</button><button id="reset" class="fullOnly">Reset pos</button>
          <div id="status" class="status">Ready · file-first · read-only.</div>
          <div id="fileline" class="fileline" hidden><span id="filename" class="filename" title="Tap to copy"></span><button id="filecopy" class="filecopy" type="button">Copy</button></div>
        </div>
        <div id="helpbox" class="help">
          <b>Routine:</b> Inspect or Scan → Save. Save requests a TXT download and automatically copies only that exact filename to the clipboard.<br><br>
          <b>Inspect:</b> arms one pointer/touch observation. With Safety ON (default), GFI captures the target and suppresses that same interaction so the website control does not activate.<br><br>
          <b>Safety ON/OFF:</b> available in Full view. ON is the normal/default investigator mode. OFF allows the inspection tap to pass through to the page and may activate buttons, links, fields, or application actions. Use OFF only when you intentionally need live interaction.<br><br>
          <b>Scan:</b> inventories the current DOM and bindings without changing the page.<br><br>
          <b>Save:</b> requests the browser file download and copies the exact filename to the clipboard.<br><br>
          <b>Copy beside filename:</b> manual fallback if automatic clipboard copy fails or is overwritten.<br><br>
          <b>Mini/Full:</b> changes only the shell. Mini keeps the routine three-button workflow; Full exposes Safety, Clear, Help, and position reset.<br><br>
          <b>Move:</b> drag the header. Position, mode, and Safety preference persist locally.<br><br>
          <b>Policy:</b> GFI ${VERSION} never writes chart data. Safety ON additionally suppresses the physical inspection tap from reaching the inspected control.
          <div id="recent" class="recent"></div>
        </div>
      </div>
    </div>`;
  document.documentElement.appendChild(host);

  const $ = id => root.getElementById(id);
  const wrap = $('wrap');
  const status = text => { $('status').textContent = text; };

  function isGfiPath(ev) {
    return !!ev.composedPath?.().includes(host);
  }

  function sameInteractionTarget(target) {
    if (!(target instanceof Element) || !(blockedTarget instanceof Element)) return false;
    return target === blockedTarget || blockedTarget.contains(target) || target.contains(blockedTarget);
  }

  function rememberBlockedTarget(target) {
    blockedTarget = target;
    blockedUntil = performance.now() + BLOCK_MS;
    host.setAttribute('data-gfi-last-blocked-selector', target.id ? `#${target.id}` : target.tagName.toLowerCase());
  }

  // Integrated form of the proven Safety Lock hotfix. This listener is registered
  // before the capture listener. stopPropagation blocks the page path but still
  // permits GFI's later listener on document to observe and record the target.
  function blockInitial(ev) {
    if (!prefs.safety || !inspectArmed || isGfiPath(ev)) return;
    const target = ev.target instanceof Element ? ev.target : null;
    if (!target) return;
    rememberBlockedTarget(target);
    if (ev.cancelable) ev.preventDefault();
    ev.stopPropagation();
  }

  function blockFollowup(ev) {
    if (!prefs.safety || performance.now() > blockedUntil || isGfiPath(ev)) return;
    const target = ev.target instanceof Element ? ev.target : null;
    if (!sameInteractionTarget(target)) return;
    if (ev.cancelable) ev.preventDefault();
    ev.stopImmediatePropagation();
    ev.stopPropagation();
  }

  document.addEventListener('pointerdown',blockInitial,{capture:true,passive:false});
  document.addEventListener('touchstart',blockInitial,{capture:true,passive:false});
  for (const type of ['pointerup','touchend','click','auxclick','contextmenu']) {
    document.addEventListener(type,blockFollowup,{capture:true,passive:false});
  }

  function clampPosition(x,y) {
    const r = host.getBoundingClientRect();
    const pad = 6;
    const maxX = Math.max(pad, innerWidth - r.width - pad);
    const maxY = Math.max(pad, innerHeight - r.height - pad);
    return {x:Math.min(Math.max(pad,x),maxX), y:Math.min(Math.max(pad,y),maxY)};
  }

  function applyPosition(x,y,save=true) {
    const p = clampPosition(x,y);
    host.style.left = `${p.x}px`; host.style.top = `${p.y}px`; host.style.right = 'auto'; host.style.bottom = 'auto';
    if (save) { prefs.x=p.x; prefs.y=p.y; writeJson(PREF_KEY,prefs); }
  }

  function initialPosition() {
    requestAnimationFrame(() => {
      const r = host.getBoundingClientRect();
      const x = Number.isFinite(prefs.x) ? prefs.x : Math.max(8, innerWidth - r.width - 12);
      const y = Number.isFinite(prefs.y) ? prefs.y : 90;
      applyPosition(x,y,false);
    });
  }

  function renderRecent() {
    const el = $('recent');
    if (!el) return;
    el.innerHTML = recentFiles.length ? '<b>Recent files</b>' + recentFiles.map(x => `<div title="${x.filename}">${x.filename}</div>`).join('') : '<b>Recent files</b><div>None yet.</div>';
  }

  function renderCaptureState() {
    const badge = $('typebadge');
    badge.classList.toggle('dirty',unsaved);
    badge.textContent = !lastReport ? 'IDLE' : `${lastReport.header.captureType === 'page' ? 'PAGE' : 'ELM'}${unsaved ? ' •' : ''}`;
  }

  function renderSafety() {
    const badge = $('safebadge');
    const button = $('safety');
    badge.textContent = prefs.safety ? 'SAFE' : 'LIVE';
    badge.classList.toggle('safe',prefs.safety);
    badge.classList.toggle('unsafe',!prefs.safety);
    button.textContent = prefs.safety ? 'Safety ON' : 'Safety OFF';
    button.classList.toggle('safetyOn',prefs.safety);
    button.classList.toggle('safetyOff',!prefs.safety);
    host.setAttribute('data-gfi-readonly-lock', prefs.safety ? 'integrated-0.3.5' : 'off');
    host.setAttribute('data-gfi-interaction-policy', prefs.safety ? 'observe-and-suppress-site-action' : 'observe-only-site-action-allowed');
  }

  function showFilename(filename) {
    $('filename').textContent = filename;
    $('filename').title = filename;
    $('fileline').hidden = false;
  }

  function disarm() {
    inspectArmed=false; $('pick').classList.remove('armed'); $('pick').textContent='Inspect';
  }

  function handleInspectEvent(ev) {
    if (!inspectArmed || isGfiPath(ev)) return;
    const target = ev.target instanceof Element ? ev.target : null;
    if (!target) return;
    lastReport = captureElement(target,ev.type); unsaved=true; lastSavedFingerprint=null; disarm(); renderCaptureState();
    status(`Captured ${lastReport.data.element.selector || lastReport.data.element.tag} · Safety ${prefs.safety ? 'ON' : 'OFF'} · Save when ready.`);
  }

  document.addEventListener('pointerdown',handleInspectEvent,{capture:true,passive:true});
  document.addEventListener('touchstart',handleInspectEvent,{capture:true,passive:true});

  $('pick').addEventListener('click',() => {
    inspectArmed=!inspectArmed;
    $('pick').classList.toggle('armed',inspectArmed);
    $('pick').textContent=inspectArmed?'Tap target…':'Inspect';
    status(inspectArmed ? `Inspection armed · Safety ${prefs.safety ? 'ON — target action blocked' : 'OFF — target may activate'}.` : 'Inspection cancelled.');
  });

  $('safety').addEventListener('click',() => {
    prefs.safety = !prefs.safety;
    writeJson(PREF_KEY,prefs);
    blockedTarget = null; blockedUntil = 0;
    renderSafety();
    status(prefs.safety ? 'Safety ON · inspection taps are captured and blocked from activating the page.' : 'Safety OFF · inspection taps may activate the target.');
  });

  $('page').addEventListener('click',() => {
    lastReport=capturePage(); unsaved=true; lastSavedFingerprint=null; renderCaptureState();
    const n=lastReport.data.counts.candidates;
    status(`${n > 500 ? 'Large capture · ' : ''}${n} candidates ready · Save capture.`);
  });

  async function saveCurrent() {
    if (!lastReport) return status('No capture available.');
    const fingerprint = lastReport.header.captureId;
    if (lastSavedFingerprint === fingerprint && !unsaved) return status(`Already saved · ${lastReport.header.exportHints.suggestedFilename}`);
    const filename = requestDownload(lastReport);
    rememberFile(filename,lastReport); renderRecent(); showFilename(filename);
    const copied = await copyText(filename);
    lastSavedFingerprint=fingerprint; unsaved=false; renderCaptureState();
    status(`Download requested · ${copied ? 'filename copied' : 'clipboard failed'} · ${filename}`);
  }
  $('save').addEventListener('click',saveCurrent);

  async function copyFilename() {
    const filename = $('filename').textContent;
    if (!filename) return status('No saved filename available.');
    const ok = await copyText(filename);
    status(ok ? `Filename copied · ${filename}` : `Clipboard failed · ${filename}`);
  }
  $('filecopy').addEventListener('click',copyFilename);
  $('filename').addEventListener('click',copyFilename);

  $('clear').addEventListener('click',() => {
    lastReport=null; unsaved=false; lastSavedFingerprint=null; disarm(); renderCaptureState();
    status('In-memory capture cleared. Saved files unchanged.');
  });

  $('mode').addEventListener('click',() => {
    prefs.mode = wrap.classList.toggle('mini') ? 'mini' : 'full';
    $('mode').textContent = prefs.mode === 'mini' ? 'Full' : 'Mini';
    writeJson(PREF_KEY,prefs);
    requestAnimationFrame(() => applyPosition(host.getBoundingClientRect().left,host.getBoundingClientRect().top));
  });

  $('help').addEventListener('click',() => $('helpbox').classList.toggle('open'));
  $('reset').addEventListener('click',() => {
    prefs.x=null; prefs.y=null; writeJson(PREF_KEY,prefs); initialPosition(); status('Inspector position reset.');
  });

  let drag = null;
  $('drag').addEventListener('pointerdown',ev => {
    if (ev.target.closest?.('button')) return;
    const r = host.getBoundingClientRect();
    drag={id:ev.pointerId,dx:ev.clientX-r.left,dy:ev.clientY-r.top};
    try { $('drag').setPointerCapture(ev.pointerId); } catch (_) {}
  });
  $('drag').addEventListener('pointermove',ev => {
    if (!drag || ev.pointerId !== drag.id) return;
    applyPosition(ev.clientX-drag.dx,ev.clientY-drag.dy,false);
  });
  const endDrag = ev => {
    if (!drag || (ev.pointerId != null && ev.pointerId !== drag.id)) return;
    const r=host.getBoundingClientRect(); drag=null; applyPosition(r.left,r.top,true);
  };
  $('drag').addEventListener('pointerup',endDrag);
  $('drag').addEventListener('pointercancel',endDrag);

  addEventListener('resize',() => {
    const r=host.getBoundingClientRect(); applyPosition(r.left,r.top,true);
  },{passive:true});
  addEventListener('orientationchange',() => setTimeout(() => {
    const r=host.getBoundingClientRect(); applyPosition(r.left,r.top,true);
  },150),{passive:true});

  renderRecent(); renderCaptureState(); renderSafety(); initialPosition();

  window.GFI = Object.freeze({
    version:VERSION,
    policy:'read-only',
    captureElement:el => { lastReport=captureElement(el,'api'); unsaved=true; renderCaptureState(); return lastReport; },
    capturePage:() => { lastReport=capturePage(); unsaved=true; renderCaptureState(); return lastReport; },
    getLastCapture:() => lastReport,
    getRecentFiles:() => [...recentFiles],
    getSafety:() => prefs.safety,
    setSafety:value => { prefs.safety=!!value; writeJson(PREF_KEY,prefs); renderSafety(); return prefs.safety; },
    saveLast:() => saveCurrent(),
    copyLastFilename:() => copyFilename(),
    clear:() => { lastReport=null; unsaved=false; renderCaptureState(); }
  });
})();
