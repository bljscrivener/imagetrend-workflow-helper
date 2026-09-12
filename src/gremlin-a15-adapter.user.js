// ==UserScript==
// @name         Gremlin Logic A15 Execution Adapter
// @namespace    gremlin.logic.a15
// @version      0.2.0
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

  const VERSION = '0.2.0';
  const BUS = new EventTarget();
  const LOG_LIMIT = 500;
  const PROFILE_SCHEMA = 'gremlin-a15-profile-bundle/v1';
  const DATA_SCHEMA = 'gremlin-a15-data-export/v1';
  const PROFILE_STORAGE_KEY = 'gremlin.a15.profiles.v1';
  const logs = [];

  const now = () => new Date().toISOString();
  const norm = value => String(value ?? '').replace(/\s+/g, ' ').trim();
  const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));

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

  function getRuntimeTargets() {
    return [
      window.GremlinA15Runtime,
      window.GremlinLogicA15Runtime,
      window.GremlinLogicA15,
      window.GremlinA15
    ].filter(Boolean);
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
    const stored = readProfileBundle();
    const profile =
      runtime?.activeProfileId ??
      runtime?.settings?.activeProfileId ??
      explicit?.activeProfileId ??
      legacy?.activeProfileId ??
      stored?.activeProfileId ??
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
    const names = ['goBabyGo', 'runActiveProfile', 'runProfile', 'run', 'execute', 'start'];
    for (const target of getRuntimeTargets()) {
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

  async function writeClipboard(text) {
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
    await writeClipboard(JSON.stringify(payload, null, 2));
    if (clearAfterCopy) clearLogs();
    emit('logs-copied', { mode, count: payload.logs.length, clearAfterCopy });
    return payload.logs.length;
  }

  function normalizeProfiles(raw) {
    if (!raw) return [];
    if (Array.isArray(raw)) return clone(raw);
    if (raw.profiles) return normalizeProfiles(raw.profiles);
    if (typeof raw === 'object') {
      return Object.entries(raw).map(([id, value]) => {
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          return { id: value.id ?? id, ...clone(value) };
        }
        return { id, value: clone(value) };
      });
    }
    return [];
  }

  function readProfileBundle() {
    try {
      const raw = localStorage.getItem(PROFILE_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed?.schema !== PROFILE_SCHEMA || !Array.isArray(parsed?.profiles)) return null;
      return parsed;
    } catch (error) {
      pushLog('warn', 'Stored profile bundle could not be read', { message: error?.message }, 'adapter');
      return null;
    }
  }

  function saveProfileBundle(bundle) {
    const normalized = {
      schema: PROFILE_SCHEMA,
      version: 1,
      savedAt: now(),
      activeProfileId: bundle?.activeProfileId ?? null,
      profiles: normalizeProfiles(bundle?.profiles)
    };
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(normalized));
    emit('profiles-changed', { count: normalized.profiles.length, activeProfileId: normalized.activeProfileId });
    return clone(normalized);
  }

  async function readRuntimeProfiles() {
    for (const target of getRuntimeTargets()) {
      const exporter = findCallable(target, ['exportProfiles', 'getProfiles', 'listProfiles']);
      if (exporter) {
        try {
          const raw = await exporter.fn.call(exporter.target);
          const profiles = normalizeProfiles(raw);
          if (profiles.length) return { profiles, method: exporter.name };
        } catch (error) {
          pushLog('warn', 'Runtime profile export failed', { method: exporter.name, message: error?.message }, 'adapter');
        }
      }
      const direct = target.profiles ?? target.profileRegistry ?? target.state?.profiles ?? null;
      const profiles = normalizeProfiles(direct);
      if (profiles.length) return { profiles, method: 'property' };
    }

    const stateProfiles = getRuntimeSnapshot()?.runtimeState?.profiles;
    const profiles = normalizeProfiles(stateProfiles);
    return profiles.length ? { profiles, method: 'state' } : { profiles: [], method: null };
  }

  async function migrateRuntimeProfiles({ overwrite = false } = {}) {
    const runtime = await readRuntimeProfiles();
    const existing = readProfileBundle();
    if (!runtime.profiles.length) {
      const result = { migrated: 0, source: null, reason: 'No runtime profiles exposed' };
      emit('profiles-migration', result);
      return result;
    }

    const byId = new Map();
    if (!overwrite) {
      for (const p of existing?.profiles || []) byId.set(String(p?.id ?? p?.name ?? byId.size), p);
    }
    for (const p of runtime.profiles) byId.set(String(p?.id ?? p?.name ?? byId.size), p);

    const activeProfileId = getRuntimeSnapshot().activeProfileId ?? existing?.activeProfileId ?? null;
    const saved = saveProfileBundle({ activeProfileId, profiles: [...byId.values()] });
    const result = { migrated: runtime.profiles.length, total: saved.profiles.length, source: runtime.method };
    pushLog('info', `Migrated ${result.migrated} runtime profile(s) into adapter storage`, result, 'adapter');
    emit('profiles-migration', result);
    return result;
  }

  function getProfiles() {
    return clone(readProfileBundle()?.profiles || []);
  }

  function getProfileBundle() {
    return clone(readProfileBundle() || {
      schema: PROFILE_SCHEMA,
      version: 1,
      savedAt: null,
      activeProfileId: getRuntimeSnapshot().activeProfileId,
      profiles: []
    });
  }

  async function setActiveProfile(profileId) {
    const id = norm(profileId);
    if (!id) throw new Error('Profile id is required');

    for (const target of getRuntimeTargets()) {
      const setter = findCallable(target, ['setActiveProfile', 'selectProfile', 'loadProfile', 'activateProfile']);
      if (setter) {
        await setter.fn.call(setter.target, id);
        const bundle = getProfileBundle();
        bundle.activeProfileId = id;
        saveProfileBundle(bundle);
        emit('profile-selected', { profileId: id, method: setter.name });
        return true;
      }
    }

    const bundle = getProfileBundle();
    bundle.activeProfileId = id;
    saveProfileBundle(bundle);
    emit('profile-selected', { profileId: id, method: 'adapter-only' });
    pushLog('warn', `Profile ${id} selected in adapter storage, but runtime exposes no profile-selection hook`, null, 'adapter');
    return false;
  }

  async function importProfiles(bundle, { applyToRuntime = true, replace = true } = {}) {
    if (!bundle || (bundle.schema && bundle.schema !== PROFILE_SCHEMA)) {
      throw new Error('Unsupported A15 profile bundle');
    }
    const incoming = normalizeProfiles(bundle.profiles ?? bundle);
    if (!incoming.length) throw new Error('Profile bundle contains no profiles');

    let profiles = incoming;
    if (!replace) {
      const byId = new Map(getProfiles().map(p => [String(p?.id ?? p?.name), p]));
      for (const p of incoming) byId.set(String(p?.id ?? p?.name), p);
      profiles = [...byId.values()];
    }

    const saved = saveProfileBundle({
      activeProfileId: bundle.activeProfileId ?? getRuntimeSnapshot().activeProfileId,
      profiles
    });

    let runtimeApplied = false;
    let runtimeMethod = null;
    if (applyToRuntime) {
      for (const target of getRuntimeTargets()) {
        const importer = findCallable(target, ['importProfiles', 'setProfiles', 'replaceProfiles']);
        if (!importer) continue;
        await importer.fn.call(importer.target, clone(saved));
        runtimeApplied = true;
        runtimeMethod = importer.name;
        break;
      }
    }

    const result = { imported: incoming.length, total: saved.profiles.length, runtimeApplied, runtimeMethod };
    pushLog('info', `Imported ${result.imported} profile(s)`, result, 'adapter');
    emit('profiles-imported', result);
    return result;
  }

  async function exportProfiles({ copy = true } = {}) {
    const bundle = getProfileBundle();
    bundle.exportedAt = now();
    if (copy) await writeClipboard(JSON.stringify(bundle, null, 2));
    emit('profiles-exported', { count: bundle.profiles.length, copy });
    return clone(bundle);
  }

  async function exportData({ copy = true, includeLogs = true } = {}) {
    const payload = {
      schema: DATA_SCHEMA,
      version: 1,
      exportedAt: now(),
      adapterVersion: VERSION,
      route: location.pathname,
      snapshot: getRuntimeSnapshot(),
      profileBundle: getProfileBundle(),
      logs: includeLogs ? getLogs({ mode: 'all' }) : []
    };
    if (copy) await writeClipboard(JSON.stringify(payload, null, 2));
    emit('data-exported', { profiles: payload.profileBundle.profiles.length, logs: payload.logs.length, copy });
    return clone(payload);
  }

  async function importData(payload, options = {}) {
    if (!payload || payload.schema !== DATA_SCHEMA) throw new Error('Unsupported A15 data export');
    const profileResult = payload.profileBundle
      ? await importProfiles(payload.profileBundle, options)
      : { imported: 0, total: getProfiles().length, runtimeApplied: false, runtimeMethod: null };
    emit('data-imported', { profileResult });
    return { profileResult };
  }

  function requestSettings() {
    return emit('settings-requested', { snapshot: getRuntimeSnapshot(), profiles: getProfileBundle() });
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
    getProfiles,
    getProfileBundle,
    migrateRuntimeProfiles,
    importProfiles,
    exportProfiles,
    setActiveProfile,
    exportData,
    importData,
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
