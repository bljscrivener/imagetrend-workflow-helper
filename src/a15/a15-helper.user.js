// ==UserScript==
// @name         Gremlin Logic A15 Helper
// @namespace    gremlinlogic.a15
// @version      0.1.0
// @description  Stable compatibility boundary between A15 mechanism modules and replaceable clients such as the standalone GUI.
// @match        https://*.imagetrendelite.com/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(() => {
  'use strict';

  const VERSION = '0.1.0';
  const API_VERSION = 'a15.helper/1';
  const root = window;

  // Helper is deliberately policy-free: no field targets, clinical rules,
  // chart mutation logic, or safety bypasses belong here.
  const resolve = () => root.GremlinLogicA15 || root.gremlinLogicA15 || root.A15 || null;

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
      diagnostics: !!(mechanism && (mechanism.exportDiagnostics || mechanism.diagnostics))
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
    exportDiagnostics(mode = 'recent') { return call(['exportDiagnostics', 'diagnostics'], mode); }
  });

  // Single public seam for GUI/future clients.
  root.GremlinLogicA15Helper = api;
  root.dispatchEvent(new CustomEvent('gremlin:a15-helper-ready', { detail: { version: VERSION, apiVersion: API_VERSION } }));
})();
