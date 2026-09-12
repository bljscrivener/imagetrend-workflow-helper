// ==UserScript==
// @name         Gremlin Logic A15 Execution Adapter
// @namespace    gremlin.logic.a15
// @version      0.1.0
// @description  GUI-neutral bridge between Gremlin Logic A15 mechanism and interchangeable skins.
// @match        https://pafford.imagetrendelite.com/Elite/*
// @grant        none
// @run-at       document-start
// @noframes
// @updateURL    https://raw.githubusercontent.com/bljscrivener/imagetrend-workflow-helper/recon/src/gremlin-a15-adapter.user.js
// @downloadURL  https://raw.githubusercontent.com/bljscrivener/imagetrend-workflow-helper/recon/src/gremlin-a15-adapter.user.js
// ==/UserScript==

(() => {
  'use strict';

  if (window.GremlinA15Adapter?.version) return;

  const VERSION = '0.1.0';
  const BUS = new EventTarget();
  const LOG_LIMIT = 500;
  const logs = [];

  const now = () => new Date().toISOString();
  const norm = value => String(value ?? '').replace(/\s+/g, ' ').trim();

  function emit(type, detail = {}) {
    const payload = { type, at: now(), ...detail };
    BUS.dispatchEvent(new CustomEvent(type, { detail: payload }));
    window.dispatchEvent(new CustomEvent(`gremlin:a15:${type}`, { detail: payload }));
    return payload;
  }

  function pushLog(level, message, data = null, source = 'adapter') {
    const entry = {
      id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      at: now(),
      level: norm(level || 'info').toLowerCase(),
      source: norm(source || 'adapter'),
      message: norm(message),
      data
    };
    logs.push(entry);
    if (logs.length > LOG_LIMIT) logs.splice(0, logs.length - LOG_LIMIT);
    emit('log', { entry });
    return entry;
  }

  function getRuntimeSnapshot() {
    const explicit = window.GremlinA15Runtime || window.GremlinLogicA15Runtime || null;
    const legacy = window.GremlinLogicA15 || window.GremlinA15 || null;

    let state = null;
    try {
      if (explicit && typeof explicit.getState === 'function') state = explicit.getState();
      else if (legacy && typeof legacy.getState === 'function') state = legacy.getState();
      else if (explicit?.state) state = explicit.state;
      else if (legacy?.state) state = legacy.state;
    } catch (error) {
      pushLog('warn', 'Runtime state probe failed', { message: error?.message }, 'adapter');
    }

    const runtime = state?.runtime || state || {};
    const profile =
      runtime?.activeProfileId ??
      runtime?.settings?.activeProfileId ??
      explicit?.activeProfileId ??
      legacy?.activeProfileId ??
      'adult';

    const safety = runtime?.capabilities?.['gremlin.safetyGuard'] || runtime?.safety || {};

    return {
      at: now(),
      route: location.pathname,
      href: location.href,
      activeProfileId: profile,
      supportedRoute: runtime?.supportedRoute ?? true,
      readOnly: !!safety?.readOnly,
      saving: !!safety?.saving,
      posting: !!safety?.posting,
      offline: !!safety?.offline,
      suspended: !!safety?.suspended,
      suspendReason: safety?.suspendReason ?? null,
      runtimeState: runtime
    };
  }

  function findCallable(target, names) {
    if (!target) return null;
    for (const name of names) {
      if (typeof target[name] === 'function') return { target, name, fn: target[name] };
    }
    return null;
  }

  function resolveRunCallable() {
    const targets = [
      window.GremlinA15Runtime,
      window.GremlinLogicA15Runtime,
      window.GremlinLogicA15,
      window.GremlinA15
    ].filter(Boolean);
    const names = ['goBabyGo', 'runActiveProfile', 'runProfile', 'run', 'execute', 'start'];
    for (const target of targets) {
      const hit = findCallable(target, names);
      if (hit) return hit;
    }
    return null;
  }

  async function run(options = {}) {
    const before = getRuntimeSnapshot();
    if (before.readOnly || before.saving || before.posting || before.offline || before.suspended) {
      const reason = before.suspendReason ||
        (before.readOnly ? 'read-only' : before.saving ? 'saving' : before.posting ? 'posting' : before.offline ? 'offline' : 'suspended');
      const error = new Error(`A15 execution blocked: ${reason}`);
      pushLog('warn', error.message, { before }, 'adapter');
      emit('run-blocked', { reason, before });
      throw error;
    }

    const call = resolveRunCallable();
    if (!call) {
      const error = new Error('No A15 execution function is exposed yet. Mechanism is loaded, but adapter binding is unresolved.');
      pushLog('error', error.message, null, 'adapter');
      emit('run-error', { error: error.message });
      throw error;
    }

    emit('run-start', { profile: before.activeProfileId, method: call.name });
    pushLog('info', `Run requested for profile ${before.activeProfileId}`, { method: call.name }, 'adapter');

    try {
      const result = await call.fn.call(call.target, options);
      const after = getRuntimeSnapshot();
      pushLog('info', 'Run completed', { method: call.name }, 'adapter');
      emit('run-complete', { result, after, method: call.name });
      return result;
    } catch (error) {
      pushLog('error', `Run failed: ${error?.message || error}`, null, 'adapter');
      emit('run-error', { error: error?.message || String(error), method: call.name });
      throw error;
    }
  }

  function getLogs({ mode = 'all', limit = null } = {}) {
    let result = logs.slice();
    if (mode === 'latest') result = result.length ? [result[result.length - 1]] : [];
    if (Number.isInteger(limit) && limit >= 0) result = result.slice(-limit);
    return result;
  }

  function clearLogs() {
    const count = logs.length;
    logs.length = 0;
    emit('logs-cleared', { count });
    return count;
  }

  async function copyLogs({ mode = 'all', clearAfterCopy = false } = {}) {
    const payload = {
      header: {
        schema: 'gremlin-a15-log-export/v1',
        exportedAt: now(),
        mode,
        route: location.pathname,
        activeProfileId: getRuntimeSnapshot().activeProfileId
      },
      logs: getLogs({ mode })
    };
    const text = JSON.stringify(payload, null, 2);
    try {
      await navigator.clipboard.writeText(text);
    } catch (_) {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;left:-9999px;top:-9999px';
      document.documentElement.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    if (clearAfterCopy) clearLogs();
    emit('logs-copied', { mode, count: payload.logs.length, clearAfterCopy });
    return payload.logs.length;
  }

  function requestSettings() {
    return emit('settings-requested', { snapshot: getRuntimeSnapshot() });
  }

  window.addEventListener('gremlin:a15:mechanism-log', event => {
    const d = event.detail || {};
    pushLog(d.level || 'info', d.message || '', d.data ?? null, d.source || 'mechanism');
  });

  const api = Object.freeze({
    version: VERSION,
    on(type, handler) {
      const wrapped = e => handler(e.detail);
      BUS.addEventListener(type, wrapped);
      return () => BUS.removeEventListener(type, wrapped);
    },
    emit,
    log: pushLog,
    run,
    getSnapshot: getRuntimeSnapshot,
    getLogs,
    clearLogs,
    copyLogs,
    requestSettings
  });

  Object.defineProperty(window, 'GremlinA15Adapter', {
    value: api,
    writable: false,
    configurable: false,
    enumerable: false
  });

  pushLog('info', 'A15 execution adapter ready', { version: VERSION }, 'adapter');
  emit('adapter-ready', { version: VERSION, snapshot: getRuntimeSnapshot() });
})();
