// ==UserScript==
// @name         Gremlin Logic A15 GUI
// @namespace    gremlinlogic.a15
// @version      0.1.0
// @description  Standalone movable presentation skin for A15. Contains no mechanism or chart-mutation logic.
// @match        https://*.imagetrendelite.com/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(() => {
  'use strict';
  if (document.getElementById('gl-a15-gui')) return;

  const KEY = 'gremlin.a15.gui.v1';
  const saved = (() => { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; } })();
  const host = document.createElement('div');
  host.id = 'gl-a15-gui';
  host.style.cssText = `position:fixed;z-index:2147483000;left:${saved.x ?? 24}px;top:${saved.y ?? 180}px;touch-action:none;font-family:-apple-system,BlinkMacSystemFont,sans-serif;user-select:none`;
  const shadow = host.attachShadow({ mode: 'open' });
  shadow.innerHTML = `<style>
    .wrap{display:flex;flex-direction:column;align-items:center;gap:5px}.go{width:74px;height:74px;border-radius:50%;border:3px solid #7f8c99;background:#13283a;color:white;font-weight:800;font-size:20px;box-shadow:0 5px 18px #0005}.go:active{transform:scale(.97)}.name{max-width:120px;padding:3px 7px;border-radius:9px;background:#101820dd;color:#fff;font-size:11px;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.status{font-size:9px;color:#fff;background:#101820bb;padding:2px 5px;border-radius:7px}.bad{border-color:#b44}
  </style><div class="wrap"><button class="go" type="button">A15</button><div class="name">No profile</div><div class="status">connecting…</div></div>`;
  document.documentElement.appendChild(host);

  const go = shadow.querySelector('.go');
  const name = shadow.querySelector('.name');
  const status = shadow.querySelector('.status');
  let dragged = false, start = null;

  function helper() { return window.GremlinLogicA15Helper || null; }
  function refresh() {
    const h = helper();
    if (!h) { status.textContent = 'A15 unavailable'; go.classList.add('bad'); return; }
    go.classList.remove('bad');
    try {
      const state = h.getState() || {};
      name.textContent = state.profileName || state.profile?.name || state.profileId || 'Default';
      status.textContent = state.running ? 'RUNNING' : 'READY';
    } catch { status.textContent = 'Helper ready'; }
  }

  go.addEventListener('click', async () => {
    if (dragged) { dragged = false; return; }
    const h = helper();
    if (!h) return refresh();
    try { await h.run(); } catch (e) { status.textContent = e?.message || 'Run unavailable'; }
    refresh();
  });

  host.addEventListener('pointerdown', e => {
    start = { px:e.clientX, py:e.clientY, x:parseFloat(host.style.left), y:parseFloat(host.style.top) };
    dragged = false;
    try { host.setPointerCapture(e.pointerId); } catch {}
  });
  host.addEventListener('pointermove', e => {
    if (!start) return;
    const dx=e.clientX-start.px, dy=e.clientY-start.py;
    if (Math.abs(dx)+Math.abs(dy)>8) dragged=true;
    if (!dragged) return;
    host.style.left = Math.max(0, Math.min(innerWidth-host.offsetWidth, start.x+dx))+'px';
    host.style.top = Math.max(0, Math.min(innerHeight-host.offsetHeight, start.y+dy))+'px';
  });
  host.addEventListener('pointerup', e => {
    if (dragged) localStorage.setItem(KEY, JSON.stringify({x:parseFloat(host.style.left),y:parseFloat(host.style.top)}));
    start=null;
    try { host.releasePointerCapture(e.pointerId); } catch {}
  });

  window.addEventListener('gremlin:a15-helper-ready', refresh);
  setInterval(refresh, 2000);
  refresh();
})();
