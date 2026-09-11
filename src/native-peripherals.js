  // Optional UI and diagnostics. No clinical rules or chart writes belong here.
  const settingsKey='gremlin-ui-v1';
  let preferences={compact:false,animations:true,observe:false,reverse:false};
  try{preferences={...preferences,...JSON.parse(localStorage.getItem(settingsKey)||'{}')};}catch(_){}
  const diagnostics=[],observations=[];
  const savePreferences=()=>{try{localStorage.setItem(settingsKey,JSON.stringify(preferences));}catch(_){status.textContent='Settings could not be saved.';}};
  const toolsPanel=document.createElement('div');toolsPanel.id='gremlin-tools';toolsPanel.hidden=true;
  const tabs=document.createElement('nav');tabs.setAttribute('aria-label','Gremlin views');
  const workflowTab=document.createElement('button'),toolsTab=document.createElement('button');
  workflowTab.textContent='Workflow';toolsTab.textContent='Tools / Settings';
  tabs.append(workflowTab,toolsTab);controls.before(tabs);
  toolsPanel.append($('#preview'),timelineButton,footer);tally.after(toolsPanel);
  function selectView(tools){toolsPanel.hidden=!tools;controls.hidden=tools;tally.hidden=tools;workflowTab.setAttribute('aria-pressed',String(!tools));toolsTab.setAttribute('aria-pressed',String(tools));}
  workflowTab.onclick=()=>selectView(false);toolsTab.onclick=()=>selectView(true);selectView(false);
  const settings=document.createElement('fieldset');settings.innerHTML='<legend>Settings</legend>';
  function setting(label,key,apply){const row=document.createElement('label'),input=document.createElement('input');input.type='checkbox';input.checked=preferences[key];row.append(input,document.createTextNode(' '+label));settings.append(row);input.onchange=()=>{preferences[key]=input.checked;savePreferences();apply();};apply();}
  setting('Compact panel','compact',()=>host.toggleAttribute('data-compact',preferences.compact));
  setting('Celebration animations','animations',()=>host.toggleAttribute('data-no-animation',!preferences.animations));
  setting('Swap timestamp button positions','reverse',()=>shortcuts.style.flexDirection=preferences.reverse?'row-reverse':'row');
  setting('Observe field sequence locally (no values)','observe',()=>{});
  toolsPanel.prepend(settings);
  const about=document.createElement('small');about.textContent='Gremlin Logic A15 0.2.4.13 · Updates are managed by Tampermonkey. Observation is limited to field IDs and order in this tab.';settings.append(about);
  const resetLayout=document.createElement('button');resetLayout.textContent='Reset panel position';resetLayout.onclick=()=>{host.style.left='';host.style.right='24px';host.style.top='90px';};settings.append(resetLayout);
  const header=$('h3');header.style.cursor='move';
  header.onpointerdown=e=>{if(e.target.closest('button')||e.button!==0)return;const box=host.getBoundingClientRect(),dx=e.clientX-box.left,dy=e.clientY-box.top;header.setPointerCapture(e.pointerId);const move=p=>{host.style.right='auto';host.style.left=Math.max(0,Math.min(innerWidth-80,p.clientX-dx))+'px';host.style.top=Math.max(0,Math.min(innerHeight-60,p.clientY-dy))+'px';};const end=()=>{header.removeEventListener('pointermove',move);header.removeEventListener('pointerup',end);header.removeEventListener('pointercancel',end);};header.addEventListener('pointermove',move);header.addEventListener('pointerup',end);header.addEventListener('pointercancel',end);};
  function record(action,outcome){diagnostics.push({sequence:diagnostics.length+1,action,outcome});if(diagnostics.length>200)diagnostics.shift();}
  for(const [button,action] of [[$('#apply'),'apply'],[clearButton,'clear'],[timelineButton,'timeline'],...Array.from(shortcuts.children,b=>[b,b.textContent==='At Pt'?'patient-time':'departure-time'])]){
    const run=button.onclick;button.onclick=async e=>{record(action,'started');try{await run(e);record(action,'finished; inspect issues for result');}catch(error){record(action,'failed');throw error;}};
  }
  // Never copy free-form error text: it may contain a chart answer or timestamp.
  async function copyReport(payload){const value=JSON.stringify(payload,null,2);try{await navigator.clipboard.writeText(value);status.textContent='Report copied.';}catch(_){const text=document.createElement('textarea');text.value=value;text.readOnly=true;text.setAttribute('aria-label','Diagnostic report to copy');toolsPanel.append(text);text.select();}}
  const copyLog=document.createElement('button');copyLog.id='copy-diagnostic-log';copyLog.textContent='Copy diagnostic log';copyLog.onclick=()=>copyReport({version:'0.2.4.13',events:diagnostics,issueCount:$('#issues').children.length});toolsPanel.insertBefore(copyLog,footer);
  let lastField=null;
  document.addEventListener('focusin',e=>{
    if(!preferences.observe||!e.target.closest?.('#form-composer'))return;
    let node=e.target.closest('[id]'),id=null;
    while(node&&node.id!=='form-composer'){if(/^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(node.id)){id=node.id;break;}node=node.parentElement;}
    if(!id||id===lastField)return;lastField=id;observations.push({from:observations.at(-1)?.field||null,field:id});if(observations.length>200)observations.shift();
  });
  const copyObservation=document.createElement('button');copyObservation.textContent='Review / copy observed sequence';copyObservation.onclick=()=>copyReport({schema:1,kind:'field-focus-sequence',events:observations});
  const clearObservation=document.createElement('button');clearObservation.textContent='Clear observed sequence';clearObservation.onclick=()=>{observations.length=0;lastField=null;};settings.append(copyObservation,clearObservation);
  window.addEventListener('hashchange',()=>{target=null;reviewed=null;times={};learnedDefinitions.clear();observations.length=0;lastField=null;record('context','changed');});
  ui.querySelectorAll('button').forEach(b=>b.type='button');
  effects.textContent+='[hidden]{display:none!important}nav{display:flex;gap:8px}#gremlin-tools{overflow:auto;min-height:0}fieldset{border:1px solid #65576f;border-radius:8px}fieldset label{display:block;margin:8px 0}fieldset small{display:block}textarea{width:95%;min-height:180px}:host([data-compact]) section{width:320px}:host([data-no-animation]) .confetti{display:none}';
  // Keep routine actions separate from experimental and developer tools.
  $('#profile').hidden=true;
  clearButton.textContent='Nukacharta';
  clearButton.title='Clear the reviewed chart entries. Two confirmations are required.';
  toolsTab.textContent='Tools';
  const advanced=document.createElement('details');advanced.id='advanced-tools';
  const advancedTitle=document.createElement('summary');advancedTitle.textContent='Troubleshooting';
  const shortcutNote=document.createElement('small');shortcutNote.textContent='Legacy timestamp shortcuts: not yet reliable. Use Timestamp Lab until its replacement is integrated.';
  advanced.append(advancedTitle,$('#preview'),timelineButton,shortcutNote,shortcuts,settings,capture);
  toolsPanel.prepend(advanced);
  const help=document.createElement('details');help.id='quick-help';
  help.innerHTML='<summary>Help me</summary><p><b>Go, baby, go</b> applies the supported A15 rules. Review the resulting chart; you control Save.</p><p><b>Needs attention</b> links open fields the helper could not resolve. Expand details for the run report.</p><p><b>Tools</b> contains Copy diagnostic log, troubleshooting and settings.</p><p><b>Nukacharta</b> clears only its reviewed inventory after two confirmations. It is not Undo.</p><p>Drag the heading to move this panel. The corner button hides it; the A15 tab brings it back.</p>';
  tabs.after(help);
  const updateStop=()=>{stop.hidden=stop.disabled;};updateStop();
  new MutationObserver(updateStop).observe(stop,{attributes:true,attributeFilter:['disabled']});
  effects.textContent+=`section{width:350px;border-radius:16px;padding:14px;background:#f6f7f9;color:#202832;border-color:#087db5;box-shadow:0 8px 30px #0004}h3{color:#165779;font-size:16px}button,select{background:#fff;color:#253340;border:1px solid #bbc9d2;border-radius:9px}button:hover{background:#eaf3f9;border-color:#087db5}nav button{flex:1}nav button[aria-pressed="true"]{background:#087db5;color:white;border-color:#087db5}#top-controls{background:transparent}#apply{background:#087db5;color:white;border:0;border-radius:10px}#apply-note{color:#526270;line-height:1.4}#status{color:#344e60}section>small{display:none}#quick-help{font-size:12px;margin:8px 0}#quick-help summary{cursor:pointer;color:#165779}#quick-help p{line-height:1.4;margin:8px 0}#advanced-tools summary{cursor:pointer;padding:10px 0}#advanced-tools small{display:block;color:#526270;margin:8px 0}fieldset{border-color:#bdcbd4}pre{background:#e9eef2;color:#253340}#issues>div{background:#fff7e3;border-left-color:#aa7510;border-radius:4px}#issues button{color:#624400}footer{border-color:#ccd6dd}#clear-entries{background:#a52332;color:white;border-color:#a52332}#run-progress[data-state="idle"]{display:none}#tally{border-top:1px solid #ccd6dd;margin-top:8px}#tally summary{font-size:12px}#quick-help[open]{max-height:220px;overflow:auto}`;
