// ==UserScript==
// @name         Gremlin Universal Investigator — Read-Only Safety Lock
// @namespace    gremlin.logic.gfi
// @version      0.1.0
// @description  Prevents an armed GFI Inspect tap from activating the underlying website control. Temporary hotfix for iPad/Safari until folded into GFI core.
// @match        *://*/*
// @grant        none
// @run-at       document-start
// @noframes
// @updateURL    https://raw.githubusercontent.com/bljscrivener/imagetrend-workflow-helper/gfi-0.3.5/src/gfi-readonly-safety-lock.user.js
// @downloadURL  https://raw.githubusercontent.com/bljscrivener/imagetrend-workflow-helper/gfi-0.3.5/src/gfi-readonly-safety-lock.user.js
// ==/UserScript==

(() => {
  'use strict';

  const VERSION = '0.1.0';
  const HOST_ID = 'gfi-control-host';
  const BLOCK_MS = 1400;
  let blockedTarget = null;
  let blockedUntil = 0;

  const getHost = () => document.getElementById(HOST_ID);
  const getPick = () => getHost()?.shadowRoot?.getElementById('pick') || null;
  const isArmed = () => {
    const pick = getPick();
    return !!pick && (pick.classList.contains('armed') || /tap target/i.test(pick.textContent || ''));
  };

  const isGfiPath = ev => {
    const host = getHost();
    return !!host && !!ev.composedPath?.().includes(host);
  };

  const sameInteractionTarget = target => {
    if (!(target instanceof Element) || !(blockedTarget instanceof Element)) return false;
    return target === blockedTarget || blockedTarget.contains(target) || target.contains(blockedTarget);
  };

  const rememberBlockedTarget = target => {
    blockedTarget = target;
    blockedUntil = performance.now() + BLOCK_MS;
    const host = getHost();
    if (host) {
      host.setAttribute('data-gfi-readonly-lock', VERSION);
      host.setAttribute('data-gfi-last-blocked-selector', target.id ? `#${target.id}` : target.tagName.toLowerCase());
    }
  };

  function blockInitial(ev) {
    if (!isArmed() || isGfiPath(ev)) return;
    const target = ev.target instanceof Element ? ev.target : null;
    if (!target) return;

    rememberBlockedTarget(target);

    // Do NOT use stopImmediatePropagation here. GFI's own document-level
    // capture listener still needs to observe this event and record the target.
    if (ev.cancelable) ev.preventDefault();
    ev.stopPropagation();
  }

  function blockFollowup(ev) {
    if (performance.now() > blockedUntil) return;
    if (isGfiPath(ev)) return;
    const target = ev.target instanceof Element ? ev.target : null;
    if (!sameInteractionTarget(target)) return;

    if (ev.cancelable) ev.preventDefault();
    ev.stopImmediatePropagation();
    ev.stopPropagation();
  }

  document.addEventListener('pointerdown', blockInitial, {capture:true, passive:false});
  document.addEventListener('touchstart', blockInitial, {capture:true, passive:false});

  // Safari may synthesize click after the touch/pointer sequence. Suppress the
  // remainder of that one interaction so an Inspect tap cannot invoke the site.
  for (const type of ['pointerup','touchend','click','auxclick','contextmenu']) {
    document.addEventListener(type, blockFollowup, {capture:true, passive:false});
  }

  const exposeMarker = () => {
    const host = getHost();
    if (!host) return false;
    host.setAttribute('data-gfi-readonly-lock', VERSION);
    host.setAttribute('data-gfi-interaction-policy', 'observe-and-suppress-site-action');
    return true;
  };

  if (!exposeMarker()) {
    const observer = new MutationObserver(() => {
      if (exposeMarker()) observer.disconnect();
    });
    observer.observe(document.documentElement, {childList:true, subtree:true});
    setTimeout(() => observer.disconnect(), 15000);
  }

  window.GFIReadOnlySafetyLock = Object.freeze({
    version: VERSION,
    policy: 'observe-and-suppress-site-action',
    armed: isArmed
  });
})();
