  // Optional UI and diagnostics. No clinical rules or chart writes belong here.
  const settingsKey='gremlin-ui-v1';
  let preferences={compact:false,animations:true,observe:false,reverse:false};
  try{preferences={...preferences,...JSON.parse(localStorage.getItem(settingsKey)||'{}')};}catch(_){}
  const diagnostics=[],observations=[];
  const savePreferences=()=>{try{localStorage.setItem(settingsKey,JSON.stringify(preferences));}catch(_){status.textContent='Settings could not be saved.';}};
  const toolsPanel=document.createElement('div');toolsPanel.id='gremlin-tools';toolsPanel.hidden=true;
  const tabs=document.createElement('nav');tabs.setAttribute('aria-label','Gremlin views');
  const workflowTab=document.createElement('button'),toolsTab=document.createElement('button');
  workflowTab.textContent='Home';toolsTab.textContent='Tools';
  const settingsTab=document.createElement('button'),settingsPanel=document.createElement('div');settingsTab.textContent='Settings';settingsPanel.id='gremlin-settings';settingsPanel.hidden=true;
  tabs.append(workflowTab,toolsTab,settingsTab);controls.before(tabs);
  toolsPanel.append($('#preview'),timelineButton,footer);tally.after(toolsPanel,settingsPanel);
  function selectView(view){view=view===true?'tools':view===false?'home':view;toolsPanel.hidden=view!=='tools';settingsPanel.hidden=view!=='settings';controls.hidden=view!=='home';tally.hidden=view!=='tools';workflowTab.setAttribute('aria-pressed',String(view==='home'));toolsTab.setAttribute('aria-pressed',String(view==='tools'));settingsTab.setAttribute('aria-pressed',String(view==='settings'));}
  workflowTab.onclick=()=>selectView(false);toolsTab.onclick=()=>selectView(true);selectView(false);settingsTab.onclick=()=>selectView('settings');
  const settings=document.createElement('fieldset');settings.innerHTML='<legend>Settings</legend>';
  function setting(label,key,apply){const row=document.createElement('label'),input=document.createElement('input');input.type='checkbox';input.checked=preferences[key];row.append(input,document.createTextNode(' '+label));settings.append(row);input.onchange=()=>{preferences[key]=input.checked;savePreferences();apply();};apply();}
  setting('Compact panel','compact',()=>host.toggleAttribute('data-compact',preferences.compact));
  setting('Celebration animations','animations',()=>host.toggleAttribute('data-no-animation',!preferences.animations));
  setting('Swap timestamp button positions','reverse',()=>shortcuts.style.flexDirection=preferences.reverse?'row-reverse':'row');
  setting('Record field visit order locally','observe',()=>{});
  toolsPanel.prepend(settings);
  const about=document.createElement('small');about.textContent='Gremlin Logic A15 0.2.4.15 · Updates are managed by Tampermonkey. Observation is limited to field IDs and order in this tab.';settings.append(about);
  const resetLayout=document.createElement('button');resetLayout.textContent='Reset panel position';resetLayout.onclick=()=>{host.style.left='';host.style.right='24px';host.style.top='90px';};settings.append(resetLayout);
  const header=$('h3');header.style.cursor='move';
  header.onpointerdown=e=>{if(e.target.closest('button')||e.button!==0)return;const box=host.getBoundingClientRect(),dx=e.clientX-box.left,dy=e.clientY-box.top;header.setPointerCapture(e.pointerId);const move=p=>{host.style.right='auto';host.style.left=Math.max(0,Math.min(innerWidth-80,p.clientX-dx))+'px';host.style.top=Math.max(0,Math.min(innerHeight-60,p.clientY-dy))+'px';};const end=()=>{header.removeEventListener('pointermove',move);header.removeEventListener('pointerup',end);header.removeEventListener('pointercancel',end);};header.addEventListener('pointermove',move);header.addEventListener('pointerup',end);header.addEventListener('pointercancel',end);};
  function record(action,outcome){diagnostics.push({sequence:diagnostics.length+1,action,outcome});if(diagnostics.length>200)diagnostics.shift();}
  for(const [button,action] of [[$('#apply'),'apply'],[clearButton,'clear'],[timelineButton,'timeline'],...Array.from(shortcuts.children,b=>[b,b.textContent==='At Pt'?'patient-time':'departure-time'])]){
    const run=button.onclick;button.onclick=async e=>{if(busy){record(action,'busy — skipped');return;}record(action,'started');try{await run(e);const timestamp=action==='patient-time'||action==='departure-time';record(action,timestamp?(/verified|copied to/.test(status.textContent)?'VERIFIED':diagnosticReason(status.textContent)):$('#issues').children.length?'FINISHED_WITH_ISSUES':'FINISHED');}catch(error){record(action,'failed');throw error;}};
  }
  // Never copy free-form error text: it may contain a chart answer or timestamp.
  function diagnosticReason(text){for(const [pattern,reason] of [[/exact target choice missing/i,'TARGET_CHOICE_MISSING'],[/row controls|rows changed/i,'ROW_IDENTITY_UNRESOLVED'],[/conflicting agency/i,'FIELD_IDENTITY_CONFLICT'],[/timeline|contact time|destination arrival/i,'SOURCE_TIME_UNAVAILABLE_OR_CHANGED'],[/mapping|field path/i,'MAPPING_UNAVAILABLE'],[/readback|not verified|mismatch/i,'READBACK_NOT_VERIFIED'],[/locked|read.only/i,'READ_ONLY'],[/changed/i,'CONTEXT_CHANGED'],[/unavailable|did not load/i,'CONTROL_UNAVAILABLE']])if(pattern.test(text))return reason;return 'REVIEW_IN_APP';}
  async function copyReport(payload){const value=JSON.stringify(payload,null,2);try{await navigator.clipboard.writeText(value);status.textContent='Report copied.';}catch(_){const text=document.createElement('textarea');text.value=value;text.readOnly=true;text.setAttribute('aria-label','Diagnostic report to copy');toolsPanel.append(text);text.select();}}
  const copyLog=document.createElement('button');copyLog.id='copy-diagnostic-log';copyLog.textContent='Copy diagnostic log';copyLog.onclick=()=>copyReport({version:'0.2.4.15',events:diagnostics,issueCount:$('#issues').children.length,issues:Array.from($('#issues').children,row=>({field:row.querySelector('button')?.textContent?.replace(' — Open field',''),reason:diagnosticReason(row.querySelector('small')?.textContent||'')}))});toolsPanel.insertBefore(copyLog,footer);
  let lastField=null;
  document.addEventListener('focusin',e=>{
    if(!preferences.observe||!e.target.closest?.('#form-composer'))return;
    let node=e.target.closest('[id]'),id=null;
    while(node&&node.id!=='form-composer'){if(/^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(node.id)){id=node.id;break;}node=node.parentElement;}
    if(!id||id===lastField)return;lastField=id;observations.push({from:observations.at(-1)?.field||null,field:id});if(observations.length>200)observations.shift();
  });
  const copyObservation=document.createElement('button');copyObservation.textContent='View workflow steps';copyObservation.onclick=()=>{sequenceView.hidden=!sequenceView.hidden;sequenceText.textContent=observations.length?observations.map((x,i)=>(i+1)+'. '+(choices.find(c=>c.id===x.field)?.label||x.field)).join('\n'):'No field visits recorded.';};
  const sequenceView=document.createElement('div'),sequenceText=document.createElement('pre'),copySteps=document.createElement('button');sequenceView.hidden=true;copySteps.textContent='Copy workflow steps';copySteps.onclick=()=>copyReport({schema:1,kind:'field-focus-sequence',events:observations});sequenceView.append(sequenceText,copySteps);settings.append(sequenceView);
  const clearObservation=document.createElement('button');clearObservation.textContent='Clear recorded steps';clearObservation.onclick=()=>{observations.length=0;lastField=null;sequenceText.textContent='No field visits recorded.';};settings.append(copyObservation,clearObservation);
  window.addEventListener('hashchange',()=>{target=null;reviewed=null;times={};learnedDefinitions.clear();observations.length=0;lastField=null;record('context','changed');});
  ui.querySelectorAll('button').forEach(b=>b.type='button');
  effects.textContent+='[hidden]{display:none!important}nav{display:flex;gap:8px}#gremlin-tools{overflow:auto;min-height:0}fieldset{border:1px solid #65576f;border-radius:8px}fieldset label{display:block;margin:8px 0}fieldset small{display:block}textarea{width:95%;min-height:180px}:host([data-compact]) section{width:320px}:host([data-no-animation]) .confetti{display:none}';
  // Keep routine actions separate from experimental and developer tools.
  $('#profile').hidden=true;
  clearButton.textContent='Nukacharta';
  clearButton.title='Clear the reviewed chart entries. Two confirmations are required.';
  toolsTab.textContent='Tools';
  const advanced=document.createElement('details');advanced.id='advanced-tools';
  const advancedTitle=document.createElement('summary');advancedTitle.textContent='Debugging';
  const shortcutNote=document.createElement('small');shortcutNote.textContent='Legacy timestamp shortcuts: not yet reliable. Use Timestamp Lab until its replacement is integrated.';
  advanced.append(advancedTitle,timelineButton,capture,copyLog,copyObservation,clearObservation,sequenceView);
  const observationHelp=document.createElement('p');observationHelp.textContent='Enable Record field visit order locally, work through the chart, then View workflow steps. Records field IDs and order, not entered values. Nothing is sent automatically. Copy shares only when you paste it. Recording clears when you change charts or reload. It does not replay actions or fill fields.';advanced.append(observationHelp);settingsPanel.append(settings,advanced);toolsPanel.prepend($('#preview'));
  const toolShortcuts=document.createElement('div');toolShortcuts.className='shortcuts';toolShortcuts.id='tool-shortcuts';toolsPanel.prepend(toolShortcuts);
  const timestampButtons=Array.from(shortcuts.children);
  const layoutToggle=document.createElement('button');layoutToggle.type='button';layoutToggle.textContent='Arrange buttons';layoutToggle.id='arrange-buttons';settings.append(layoutToggle);
  let arranging=false,dragged=null;
  const layout=()=>{
    const saved=preferences.timestampLayout;
    const order=Array.isArray(saved)&&saved.length===2&&new Set(saved.map(x=>x.id)).size===2&&saved.every(x=>[0,1].includes(x.id)&&['workflow','tools'].includes(x.area))?saved:[{id:0,area:'workflow'},{id:1,area:'workflow'}];
    for(const item of order)(item.area==='tools'?toolShortcuts:shortcuts).append(timestampButtons[item.id]);
  };
  const saveLayout=()=>{preferences.timestampLayout=[...Array.from(shortcuts.children,b=>({id:timestampButtons.indexOf(b),area:'workflow'})),...Array.from(toolShortcuts.children,b=>({id:timestampButtons.indexOf(b),area:'tools'}))];savePreferences();};
  layout();
  layoutToggle.onclick=()=>{arranging=!arranging;host.toggleAttribute('data-arranging',arranging);layoutToggle.textContent=arranging?'Done arranging':'Arrange buttons';layoutToggle.setAttribute('aria-pressed',String(arranging));timestampButtons.forEach(b=>b.draggable=arranging);};
  timestampButtons.forEach(b=>{b.addEventListener('click',e=>{if(arranging){e.preventDefault();e.stopImmediatePropagation();}},true);b.ondragstart=e=>{if(!arranging){e.preventDefault();return;}dragged=b;e.dataTransfer.setData('text/plain',b.textContent);};b.ondragend=()=>{dragged=null;};});
  const drop=(area,before)=>e=>{if(!arranging||!dragged)return;e.preventDefault();area.insertBefore(dragged,before||null);saveLayout();dragged=null;};
  for(const area of [shortcuts,toolShortcuts]){area.ondragover=e=>{if(arranging)e.preventDefault();};area.ondrop=e=>{const before=e.target.closest('button');drop(area,before?.parentElement===area?before:null)(e);};}
  for(const [tab,area,tools] of [[workflowTab,shortcuts,false],[toolsTab,toolShortcuts,true]]){tab.ondragover=e=>{if(arranging)e.preventDefault();};tab.ondrop=e=>{drop(area)(e);selectView(tools);};}
  const resetButtons=document.createElement('button');resetButtons.type='button';resetButtons.textContent='Restore timestamp buttons';resetButtons.onclick=()=>{delete preferences.timestampLayout;preferences.reverse=false;shortcuts.style.flexDirection='row';layout();savePreferences();};settings.append(resetButtons);
  effects.textContent+=':host([data-arranging]) .shortcuts{min-height:45px;border:2px dashed #087db5;padding:5px}:host([data-arranging]) .shortcuts button{cursor:grab}#arrange-buttons{font-size:11px}#tool-shortcuts:empty{display:none}:host([data-arranging]) #tool-shortcuts:empty{display:flex}';
  toolsPanel.append(tally);
  const help=document.createElement('details');help.id='quick-help';
  help.innerHTML='<summary>Help me</summary><p><b>Go, baby, go</b> applies the supported A15 rules. Review the resulting chart; you control Save.</p><p><b>At Pt / Leaving Scene:</b> select the intended date/time field first. The native clock picker supplies the source time.</p><p><b>Needs attention</b> opens Tools with links to unresolved fields.</p><p><b>Settings → Debugging</b> contains diagnostic logs, field mapping, timeline reading and workflow observation.</p><p><b>Nukacharta</b> clears only its reviewed inventory after two confirmations. It is not Undo.</p><p>Drag the heading to move this panel. The corner button hides it; the A15 tab brings it back.</p>';
  toolsPanel.prepend(help);
  const layoutHelp=document.createElement('p');layoutHelp.textContent='Arrange buttons: drag At Pt or Leaving Scene onto Home or Tools, or before the other button to reorder. Click Done arranging when finished. Layout is saved in this browser. Settings → Restore timestamp buttons resets them.';help.append(layoutHelp);
  const updateStop=()=>{stop.hidden=stop.disabled;};updateStop();
  new MutationObserver(updateStop).observe(stop,{attributes:true,attributeFilter:['disabled']});

  const issueIndicator=document.createElement('button');issueIndicator.id='issue-indicator';issueIndicator.hidden=true;issueIndicator.onclick=()=>{selectView('tools');setTally(true);};controls.append(issueIndicator);
  const updateIssues=()=>{const count=$('#issues').children.length;issueIndicator.hidden=!count;issueIndicator.textContent=count+' need attention — view';};new MutationObserver(updateIssues).observe($('#issues'),{childList:true});updateIssues();
  $('#apply-note').hidden=true;$('#apply').title=$('#apply-note').textContent;toolsPanel.append($('#apply-note'));$('#apply-note').hidden=false;
  status.hidden=true;new MutationObserver(()=>{status.hidden=!status.textContent||status.textContent==='Ready · A15';}).observe(status,{childList:true,characterData:true,subtree:true});
  effects.textContent+='section{width:350px;border-radius:16px;padding:14px}nav button{flex:1}nav button[aria-pressed="true"]{background:#8851ac;color:white}#gremlin-settings,#gremlin-tools{overflow:auto;min-height:0}#quick-help{font-size:12px;margin:8px 0}#quick-help p{line-height:1.4}#advanced-tools summary{cursor:pointer;padding:10px 0}#run-progress[data-state="idle"]{display:none}section>small{display:none}#issue-indicator{font-size:12px;background:transparent;color:#ffe0a0}#tally{overflow:visible}#gremlin-tools #status{display:block}';
