// ==UserScript==
// @name         Gremlin Logic A15 Helper — Chicken Fetcher
// @namespace    gremlinlogic.a15
// @version      0.2.0
// @description  Stable A15 compatibility boundary plus read-only boot/handshake diagnostics for modular clients.
// @match        https://*.imagetrendelite.com/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(() => {
  'use strict';

  const VERSION = '0.2.0';
  const API_VERSION = 'a15.helper/1';
  const DIAGNOSTIC_VERSION = 'chicken-fetcher/1';
  const root = window;
  const startedAt = new Date().toISOString();
  const observations = [];

  // Chicken Fetcher is deliberately non-invasive. It observes published seams,
  // DOM mount points, and readiness events. It does not mutate ImageTrend data,
  // invoke A15 execution, or synthesize missing mechanism objects.
  const resolve = () => root.GremlinLogicA15 || root.gremlinLogicA15 || root.A15 || null;

  function safeVersion(value) {
    if (!value) return null;
    try {
      return value.version || value.VERSION || value.apiVersion || null;
    } catch (_) {
      return null;
    }
  }

  function visibleObject(names) {
    for (const name of names) {
      try {
        if (root[name]) return { name, value: root[name] };
      } catch (_) {}
    }
    return null;
  }

  function domMatch(selectors) {
    for (const selector of selectors) {
      try {
        const node = document.querySelector(selector);
        if (node) return selector;
      } catch (_) {}
    }
    return null;
  }

  const STAGES = [
    { id: 'compatibility-guard', label: 'Compatibility Guard', globals: ['GremlinLogicA15CompatibilityGuard', 'GremlinA15CompatibilityGuard'], selectors: ['#gremlin-a15-compatibility-guard', '[data-gremlin-a15="compatibility-guard"]'] },
    { id: 'runtime-core', label: 'Runtime Core', globals: ['GremlinLogicA15Runtime', 'GremlinA15Runtime', 'GremlinLogicA15', 'gremlinLogicA15', 'A15'], selectors: ['#gremlin-a15-runtime', '[data-gremlin-a15="runtime-core"]'] },
    { id: 'legacy-bridge', label: 'Legacy Bridge', globals: ['GremlinLogicA15LegacyBridge', 'GremlinA15LegacyBridge'], selectors: ['#gremlin-a15-legacy-bridge', '[data-gremlin-a15="legacy-bridge"]'] },
    { id: 'control-center', label: 'Control Center', globals: ['GremlinLogicA15ControlCenter', 'GremlinA15ControlCenter'], selectors: ['#gremlin-a15-control-center', '[data-gremlin-a15="control-center"]'] },
    { id: 'gui', label: 'GUI', globals: ['GremlinLogicA15GUI', 'GremlinA15GUI'], selectors: ['#gremlin-a15-gui', '#a15-gui', '[data-gremlin-a15="gui"]'] }
  ];

  function stageStatus(stage) {
    const published = visibleObject(stage.globals);
    const selector = domMatch(stage.selectors);
    const mechanism = stage.id === 'runtime-core' ? resolve() : null;
    const value = published?.value || mechanism;
    return Object.freeze({
      id: stage.id,
      label: stage.label,
      loaded: !!value || !!selector,
      pageVisible: !!published || !!mechanism,
      bridgeVisible: stage.id === 'runtime-core' ? !!resolve() : !!published,
      mounted: !!selector,
      global: published?.name || (mechanism ? 'A15 mechanism seam' : null),
      selector,
      version: safeVersion(value),
      error: null
    });
  }

  function snapshot(reason = 'manual') {
    const snap = Object.freeze({
      schema: DIAGNOSTIC_VERSION,
      helperVersion: VERSION,
      apiVersion: API_VERSION,
      reason,
      startedAt,
      capturedAt: new Date().toISOString(),
      page: { origin: location.origin, pathname: location.pathname, title: document.title },
      stages: STAGES.map(stageStatus)
    });
    observations.push(snap);
    if (observations.length > 25) observations.shift();
    return snap;
  }

  function capabilities() {
    const mechanism = resolve();
    return Object.freeze({
      helperVersion: VERSION,
      apiVersion: API_VERSION,
      mechanismAvailable: !!mechanism,
      run: !!(mechanism && (mechanism.run || mechanism.start)),
      stop: !!(mechanism && (mechanism.stop || mechanism.cancel)),
      getState: !!(mechanism && (mechanism.getState || mechanism.state)),
      profiles: !!(mechanism && (mechanism.getProfiles || mechanism.profiles)),
      findings: !!(mechanism && (mechanism.getFindings || mechanism.findings)),
      diagnostics: true
    });
  }

  function requireMechanism() {
    const mechanism = resolve();
    if (!mechanism) throw new Error('A15 mechanism unavailable');
    return mechanism;
  }

  function call(names, ...args) {
    const mechanism = requireMechanism();
    for (const name of names) {
      if (typeof mechanism[name] === 'function') return mechanism[name](...args);
    }
    throw new Error(`A15 capability unavailable: ${names.join('/')}`);
  }

  const api = Object.freeze({
    version: VERSION,
    apiVersion: API_VERSION,
    diagnosticVersion: DIAGNOSTIC_VERSION,
    getCapabilities: capabilities,
    getState() {
      const mechanism = requireMechanism();
      if (typeof mechanism.getState === 'function') return mechanism.getState();
      if ('state' in mechanism) return mechanism.state;
      return { available: true };
    },
    run(profile) { return call(['run', 'start'], profile); },
    stop() { return call(['stop', 'cancel']); },
    getProfiles() {
      const mechanism = requireMechanism();
      return typeof mechanism.getProfiles === 'function' ? mechanism.getProfiles() : (mechanism.profiles || []);
    },
    setProfile(id) { return call(['setProfile', 'selectProfile'], id); },
    getFindings() {
      const mechanism = requireMechanism();
      return typeof mechanism.getFindings === 'function' ? mechanism.getFindings() : (mechanism.findings || []);
    },
    getBootDiagnostics() { return snapshot('api'); },
    getDiagnosticHistory() { return observations.slice(); },
    exportDiagnostics(mode = 'recent') {
      const mechanism = resolve();
      let mechanismDiagnostics = null;
      if (mechanism) {
        try {
          const fn = mechanism.exportDiagnostics || mechanism.diagnostics;
          if (typeof fn === 'function') mechanismDiagnostics = fn.call(mechanism, mode);
        } catch (error) {
          mechanismDiagnostics = { error: String(error?.message || error) };
        }
      }
      return Object.freeze({ chickenFetcher: snapshot(`export:${mode}`), mechanism: mechanismDiagnostics });
    }
  });

  root.GremlinLogicA15Helper = api;
  root.GremlinLogicChickenFetcher = Object.freeze({
    version: VERSION,
    snapshot: () => snapshot('chicken-fetcher'),
    history: () => observations.slice()
  });

  const readinessEvents = [
    'gremlin:a15-compatibility-ready',
    'gremlin:a15-runtime-ready',
    'gremlin:a15-legacy-bridge-ready',
    'gremlin:a15-control-center-ready',
    'gremlin:a15-gui-ready'
  ];
  readinessEvents.forEach(name => root.addEventListener(name, () => snapshot(`event:${name}`), { passive: true }));

  const takeInitialSnapshots = () => {
    snapshot('document-start');
    setTimeout(() => snapshot('250ms'), 250);
    setTimeout(() => snapshot('1000ms'), 1000);
    setTimeout(() => snapshot('3000ms'), 3000);
  };
  takeInitialSnapshots();

  root.dispatchEvent(new CustomEvent('gremlin:a15-helper-ready', {
    detail: { version: VERSION, apiVersion: API_VERSION, diagnosticVersion: DIAGNOSTIC_VERSION }
  }));
})();
