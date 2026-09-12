// ==UserScript==
// @name         Gremlin Logic A15 Skin
// @namespace    gremlin.logic.a15
// @version      0.2.0
// @description  Interchangeable GUI skin for Gremlin Logic A15. Contains no charting mechanism.
// @match        https://pafford.imagetrendelite.com/Elite/*
// @grant        none
// @run-at       document-idle
// @noframes
// @updateURL    https://raw.githubusercontent.com/bljscrivener/imagetrend-workflow-helper/recon/src/gremlin-a15-skin.user.js
// @downloadURL  https://raw.githubusercontent.com/bljscrivener/imagetrend-workflow-helper/recon/src/gremlin-a15-skin.user.js
// ==/UserScript==

(() => {
  'use strict';

  if (document.getElementById('gremlin-a15-skin-host')) return;

  const waitForAdapter = async (timeoutMs = 10000) => {
    const started = Date.now();
    while (!window.GremlinA15Adapter && Date.now() - started < timeoutMs) {
      await new Promise(r => setTimeout(r, 100));
    }
    return window.GremlinA15Adapter || null;
  };

  const host = document.createElement('div');
  host.id = 'gremlin-a15-skin-host';
  host.style.cssText = 'position:fixed;right:18px;bottom:84px;z-index:2147483646';
  const root = host.attachShadow({ mode: 'open' });

  root.innerHTML = `
    <style>
      :host{all:initial}
      *{box-sizing:border-box}
      .wrap{font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#152334;display:flex;flex-direction:column;align-items:center;gap:6px}
      .orb{width:82px;height:82px;border-radius:50%;border:3px solid #1f5d8f;background:#f7fbff;box-shadow:0 6px 18px #0003;display:flex;align-items:center;justify-content:center;cursor:pointer;position:relative;user-select:none}
      .orb:active{transform:scale(.97)}
      .orb[disabled]{opacity:.55;cursor:default;transform:none}
      .core{width:58px;height:58px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:#183b5d;color:white;font-weight:800;font-size:19px;letter-spacing:.5px}
      .ring{position:absolute;inset:5px;border-radius:50%;border:2px solid #69a8d6;pointer-events:none}
      .profile{max-width:130px;font-size:11px;line-height:1.1;text-align:center;padding:3px 7px;border-radius:999px;background:#fff;border:1px solid #aab9c7;box-shadow:0 2px 8px #0001;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .row{display:flex;gap:5px}
      .mini{border:1px solid #9fb0c0;background:#fff;color:#1c2e40;border-radius:8px;padding:5px 7px;font-size:11px;cursor:pointer;box-shadow:0 2px 7px #0001}
      .mini:disabled{opacity:.55;cursor:default}
      .panel{width:340px;max-height:52vh;overflow:auto;background:#fff;border:1px solid #9fb0c0;border-radius:12px;box-shadow:0 8px 28px #0004;padding:10px;display:none}
      .panel.open{display:block}
      .head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:7px}
      .title{font-size:13px;font-weight:700}
      .status{font-size:11px;color:#52697f}
      .log{font:11px/1.35 ui-monospace,SFMono-Regular,Menlo,monospace;background:#f4f7fa;border:1px solid #d5dde5;border-radius:8px;padding:7px;white-space:pre-wrap;word-break:break-word;max-height:180px;overflow:auto}
      .settings-grid{display:grid;grid-template-columns:auto 1fr;gap:6px 8px;align-items:center;font-size:11px}
      .settings-actions{display:flex;flex-wrap:wrap;gap:5px;margin-top:10px;padding-top:9px;border-top:1px solid #dde4eb}
      .pill{font-size:10px;padding:2px 5px;border-radius:999px;background:#eef3f7}
      .err{color:#a11616}
      .ok{color:#176b34}
      [hidden]{display:none!important}
    </style>
    <div class="wrap">
      <button class="orb" id="run" type="button" title="Go Baby Go">
        <span class="ring"></span>
        <span class="core">A15</span>
      </button>
      <div class="profile" id="profile">profile: …</div>
      <div class="row">
        <button class="mini" id="logs" type="button">Logs</button>
        <button class="mini" id="settings" type="button">Settings</button>
      </div>
      <div class="panel" id="panel">
        <div class="head">
          <div class="title" id="panelTitle">A15</div>
          <div class="status" id="status">waiting</div>
        </div>
        <div id="logsView" hidden>
          <div class="row" style="margin-bottom:7px;flex-wrap:wrap">
            <button class="mini" id="copyLatest" type="button">Copy latest</button>
            <button class="mini" id="copyAll" type="button">Copy all</button>
            <button class="mini" id="copyClear" type="button">Copy all + clear</button>
            <button class="mini" id="clear" type="button">Clear</button>
          </div>
          <div class="log" id="logText">No log entries yet.</div>
        </div>
        <div id="settingsView" hidden>
          <div class="settings-grid">
            <span>Skin</span><span class="pill">A15 default</span>
            <span>Mechanism</span><span id="mechanism">adapter only</span>
            <span>Profile</span><span id="profileDetail">—</span>
            <span>Profiles stored</span><span id="profileCount">0</span>
            <span>Route</span><span id="route">—</span>
            <span>Safety</span><span id="safety">—</span>
          </div>
          <div class="settings-actions">
            <button class="mini" id="migrateProfiles" type="button">Migrate profiles</button>
            <button class="mini" id="exportProfiles" type="button">Copy profiles</button>
            <button class="mini" id="exportData" type="button">Copy all data</button>
            <button class="mini" id="importData" type="button">Import data</button>
            <input id="importFile" type="file" accept="application/json,.json" hidden>
          </div>
        </div>
      </div>
    </div>`;

  document.body.appendChild(host);

  const $ = sel => root.querySelector(sel);
  const runBtn = $('#run');
  const profile = $('#profile');
  const panel = $('#panel');
  const status = $('#status');
  const logText = $('#logText');
  const logsView = $('#logsView');
  const settingsView = $('#settingsView');
  const panelTitle = $('#panelTitle');
  const importFile = $('#importFile');

  let adapter = null;
  let mode = null;

  function setPanel(next) {
    mode = mode === next ? null : next;
    panel.classList.toggle('open', !!mode);
    logsView.hidden = mode !== 'logs';
    settingsView.hidden = mode !== 'settings';
    panelTitle.textContent = mode === 'logs' ? 'A15 Logs' : mode === 'settings' ? 'A15 Settings' : 'A15';
    if (mode === 'logs') refreshLogs();
    if (mode === 'settings') refreshState();
  }

  function summarizeEntry(entry) {
    const time = entry?.at ? new Date(entry.at).toLocaleTimeString() : '--:--:--';
    return `[${time}] ${String(entry?.level || 'info').toUpperCase()} ${entry?.source || 'unknown'}\n${entry?.message || ''}`;
  }

  function refreshLogs() {
    if (!adapter) {
      logText.textContent = 'Adapter not loaded.';
      return;
    }
    const entries = adapter.getLogs({ mode: 'all' });
    logText.textContent = entries.length ? entries.map(summarizeEntry).join('\n\n') : 'No log entries yet.';
    logText.scrollTop = logText.scrollHeight;
  }

  function refreshState() {
    if (!adapter) {
      profile.textContent = 'profile: unavailable';
      $('#mechanism').textContent = 'adapter missing';
      $('#profileDetail').textContent = '—';
      $('#profileCount').textContent = '0';
      $('#route').textContent = location.pathname;
      $('#safety').textContent = 'unknown';
      return;
    }
    const s = adapter.getSnapshot();
    const profileName = s.activeProfileId || 'unknown';
    profile.textContent = `profile: ${profileName}`;
    $('#profileDetail').textContent = profileName;
    $('#profileCount').textContent = String(adapter.getProfiles?.().length ?? 0);
    $('#route').textContent = s.route;
    const blocked = s.readOnly || s.saving || s.posting || s.offline || s.suspended;
    $('#safety').textContent = blocked ? (s.suspendReason || 'blocked') : 'ready';
    $('#safety').className = blocked ? 'err' : 'ok';
    $('#mechanism').textContent = 'decoupled via adapter';
    runBtn.disabled = blocked;
  }

  function flash(text, isError = false) {
    status.textContent = text;
    status.className = `status ${isError ? 'err' : ''}`;
  }

  async function guarded(button, work) {
    if (!adapter) return;
    button.disabled = true;
    try {
      await work();
    } catch (error) {
      flash(error?.message || 'operation failed', true);
    } finally {
      button.disabled = false;
      refreshState();
    }
  }

  $('#logs').addEventListener('click', () => setPanel('logs'));
  $('#settings').addEventListener('click', () => {
    setPanel('settings');
    adapter?.requestSettings?.();
  });

  $('#copyLatest').addEventListener('click', async () => {
    if (!adapter) return;
    const count = await adapter.copyLogs({ mode: 'latest' });
    flash(`copied ${count}`);
  });

  $('#copyAll').addEventListener('click', async () => {
    if (!adapter) return;
    const count = await adapter.copyLogs({ mode: 'all' });
    flash(`copied ${count}`);
  });

  $('#copyClear').addEventListener('click', async () => {
    if (!adapter) return;
    const count = await adapter.copyLogs({ mode: 'all', clearAfterCopy: true });
    refreshLogs();
    flash(`copied ${count}; cleared`);
  });

  $('#clear').addEventListener('click', () => {
    if (!adapter) return;
    const count = adapter.clearLogs();
    refreshLogs();
    flash(`cleared ${count}`);
  });

  $('#migrateProfiles').addEventListener('click', event => guarded(event.currentTarget, async () => {
    const result = await adapter.migrateRuntimeProfiles();
    flash(result.migrated ? `migrated ${result.migrated}` : 'no runtime profiles exposed', !result.migrated);
  }));

  $('#exportProfiles').addEventListener('click', event => guarded(event.currentTarget, async () => {
    const bundle = await adapter.exportProfiles({ copy: true });
    flash(`copied ${bundle.profiles.length} profiles`);
  }));

  $('#exportData').addEventListener('click', event => guarded(event.currentTarget, async () => {
    const payload = await adapter.exportData({ copy: true, includeLogs: true });
    flash(`copied data: ${payload.profileBundle.profiles.length} profiles`);
  }));

  $('#importData').addEventListener('click', () => importFile.click());

  importFile.addEventListener('change', async () => {
    const file = importFile.files?.[0];
    importFile.value = '';
    if (!file || !adapter) return;
    try {
      const payload = JSON.parse(await file.text());
      let result;
      if (payload.schema === 'gremlin-a15-profile-bundle/v1') {
        result = await adapter.importProfiles(payload, { applyToRuntime: true, replace: true });
        flash(`imported ${result.imported} profiles`);
      } else {
        const imported = await adapter.importData(payload, { applyToRuntime: true, replace: true });
        flash(`imported ${imported.profileResult.imported} profiles`);
      }
      refreshState();
    } catch (error) {
      flash(error?.message || 'import failed', true);
    }
  });

  runBtn.addEventListener('click', async () => {
    if (!adapter) {
      flash('adapter missing', true);
      return;
    }
    runBtn.disabled = true;
    flash('running…');
    try {
      await adapter.run();
      flash('complete');
    } catch (error) {
      flash(error?.message || 'run failed', true);
    } finally {
      refreshState();
      setTimeout(() => { if (status.textContent === 'complete') flash('ready'); }, 1800);
    }
  });

  (async () => {
    adapter = await waitForAdapter();
    if (!adapter) {
      flash('adapter not loaded', true);
      refreshState();
      return;
    }

    adapter.on('log', () => {
      if (mode === 'logs') refreshLogs();
    });
    adapter.on('logs-cleared', refreshLogs);
    adapter.on('profiles-changed', refreshState);
    adapter.on('profile-selected', refreshState);
    adapter.on('profiles-imported', refreshState);
    adapter.on('profiles-migration', refreshState);
    adapter.on('run-start', () => flash('running…'));
    adapter.on('run-complete', () => flash('complete'));
    adapter.on('run-error', d => flash(d.error || 'run failed', true));
    adapter.on('run-blocked', d => flash(`blocked: ${d.reason}`, true));

    refreshState();
    flash('ready');
    setInterval(refreshState, 2500);
  })();
})();
