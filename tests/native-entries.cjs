const fs=require('fs'),assert=require('node:assert/strict'),{chromium}=require('playwright');
(async()=>{
 const b=await chromium.launch({channel:'msedge',headless:true}),p=await b.newPage();
 await p.route('https://pafford.imagetrendelite.com/**',r=>r.fulfill({body:'<div id="form-composer">Unrelated section</div><input id="29336Date" value="09/09/2026"><input id="29336Time" value="11:00:00"><input id="29335Date" value="09/09/2026"><input id="29335Time" value="10:59:00"><input id="29337Date" value="09/09/2026"><input id="29337Time" value="11:15:00">'}));await p.goto('https://pafford.imagetrendelite.com/');
 await p.evaluate(()=>{
  const vitals=[{VitalsLevelOfResponseModValue:{LevelOfResponse:'verbal'},VitalsGCSEyeModValue:{GCSEye:null},VitalsSBPModValue:{SBP:123}},{VitalsLevelOfResponseModValue:{LevelOfResponse:null},VitalsGCSEyeModValue:{GCSEye:null},VitalsSBPModValue:{SBP:111}}];
  const procedures=[{PatientProcedureProcedurePerformedModValue:{ProcedurePerformed:'als'},PatientProcedurePerformerRoleModValue:{PerformerRole:'critical'}},{PatientProcedureProcedurePerformedModValue:{ProcedurePerformed:'other'},PatientProcedurePerformerRoleModValue:{PerformerRole:'critical'}}];
  const root={Incident:{Scene:{Response:{Patient:{Vitals:vitals,PatientProcedures:procedures}}}}};
  procedures.forEach(x=>x.PatientProcedureProcedureDateTimeModValue={ProcedureDateTime:null});vitals.removeAll=()=>vitals.splice(0);procedures.removeAll=()=>procedures.splice(0);window.model=root;root.Incident.DispatchSentinel='keep';vitals.forEach(x=>x.GCSQualifiers=[]);window.entries={vitals,procedures};window.writes=[];vitals.forEach(x=>x.__parent=root);
  const resources={
   'd6db496e-fd74-5d8a-a016-e324072dcb9c':{Elements:[{Id:'qual',Value:'Initial GCS has legitimate values without interventions such as intubation and sedation'}]},
   '7f5c88af-a3be-5947-b47b-ffe6cc957102':{Elements:[{Id:'alert',Value:'Alert'},{Id:'verbal',Value:'Verbal'}]},
   '94f6e43f-139c-5eda-bd46-bdb95d7111bd':{Elements:[{Id:'eye4',Value:'4- Opens Eyes spontaneously (All Age Groups)'}]},
   'd0c37cfb-ac96-5c0e-9eb6-d21aeb3f57d7':{Elements:[{Id:'para',Value:'Paramedic'},{Id:'critical',Value:'Critical Care Paramedic'}]},
   'procedure-catalog':{Elements:[{Id:'als',Value:'Assessment -ALS'},{Id:'other',Value:'Other procedure'}]}
  };
  window.ko={unwrap:x=>typeof x==='function'?x():x,contextFor:()=>({$root:{currentIncidentReadOnlyStatus:false},$parents:[root]})};
  window.imagetrend={FormComposer:{isReadOnly:()=>false},formComposer:{agencyPresetValues:[],agencyResources:resources,reportingStandardID:2},runForm:{PresetValueViewModel:function(d,r){
   if(d.IsMultiselect){const [prefix,suffix]=d.BindingPathFromOrigin.split('[].');const list=prefix.split('.').reduce((o,k)=>o[k],r);const display=resources[d.BindingPathEntryID].Elements[0].Value;this.currentValueDisplay=()=>list.length?display:'';this.presetValueDisplay=()=>display;this.init=()=>{};this.applyPresetValue=()=>{writes.push(d.BindingPathFromOrigin);list.push({GCSQualifierGCSQualifierModValue:{GCSQualifier:d.Value}});};return;}
   const parts=d.BindingPathFromOrigin.split('.'),key=parts.pop(),parent=parts.reduce((o,k)=>o[k],r);
   const display=x=>resources[d.BindingPathEntryID]?.Elements.find(e=>e.Id===x)?.Value??x??'';
   this.currentValueDisplay=()=>display(parent[key]);this.presetValueDisplay=()=>display(d.Value);this.init=()=>{};
   this.applyPresetValue=()=>{writes.push(d.BindingPathFromOrigin);parent[key]=d.Value;};
  }}};
 });
 await p.addScriptTag({content:fs.readFileSync('src/imagetrend-a15-native-test.user.js','utf8')});const h=p.locator('#it-a15-native-test');
 await h.locator('#launch').click();await h.locator('#preview').click();
 assert.match(await h.locator('#result').textContent(),/Vital 2 · AVPU/);assert.match(await h.locator('#result').textContent(),/replace with reviewed A15/);
 await h.locator('#ack').check();await p.evaluate(()=>entries.vitals.reverse());await h.locator('#apply').click();
 assert.deepEqual(await p.evaluate(()=>entries.vitals.map(x=>x.VitalsLevelOfResponseModValue.LevelOfResponse)),['alert','alert']);
 assert.deepEqual(await p.evaluate(()=>entries.vitals.map(x=>x.VitalsGCSEyeModValue.GCSEye)),['eye4','eye4']);
 assert.deepEqual(await p.evaluate(()=>entries.vitals.map(x=>x.VitalsSBPModValue.SBP)),[111,123]);
 assert.deepEqual(await p.evaluate(()=>entries.procedures.map(x=>x.PatientProcedurePerformerRoleModValue.PerformerRole)),['para','critical']);
 assert.equal(await p.evaluate(()=>writes.length),8);assert.deepEqual(await p.evaluate(()=>entries.vitals.map(x=>x.GCSQualifiers.length)),[1,1]);
 await h.locator('#preview').click();await h.locator('#ack').check();assert.equal(await h.locator('#apply').isEnabled(),false);
 await p.evaluate(()=>entries.vitals[0].VitalsLevelOfResponseModValue.LevelOfResponse=null);await h.locator('#preview').click();await h.locator('#ack').check();
 await p.evaluate(()=>entries.vitals.shift());await h.locator('#apply').click();assert.equal(await p.evaluate(()=>writes.length),8);assert.deepEqual(await p.evaluate(()=>entries.vitals.map(x=>x.GCSQualifiers.length)),[1]);assert.match(await h.locator('#result').textContent(),/removed or ambiguous/);
 assert.equal(await p.evaluate(()=>new Date(entries.procedures[0].PatientProcedureProcedureDateTimeModValue.ProcedureDateTime).getHours()),11);await p.evaluate(()=>{model.Incident.Scene.Response.Patient.Disposition={TransportMode:'test'};imagetrend.formComposer.agencyPresetValues=[{PresetValues:[{BindingPathEntryID:'transport-test',FieldName:'Transport mode',ReportingStandardID:2,BindingPathFromOrigin:'Incident.Scene.Response.Patient.Disposition.TransportMode'}]}];window.confirm=()=>false;});await h.locator('#clear-entries').click();assert.equal(await p.evaluate(()=>entries.procedures.length),2);await p.evaluate(()=>{window.confirmCount=0;window.confirm=()=>{confirmCount++;return true;};});await h.locator('#clear-entries').click();await h.locator('#nuke-confirm').click();assert.equal(await p.evaluate(()=>confirmCount),1);assert.equal(await p.evaluate(()=>model.Incident.Scene.Response.Patient.Disposition.TransportMode),null);assert.equal(await h.locator('.confetti').count(),1);assert.equal(await p.evaluate(()=>entries.procedures.length),0);assert.equal(await p.evaluate(()=>entries.vitals.length),0);assert.equal(await p.evaluate(()=>model.Incident.DispatchSentinel),'keep');assert.equal(await p.locator('input[id="29336Time"]').inputValue(),'11:00:00');console.log('PASS timestamp rule, clear cancellation, double confirmation, dispatch/timeline preserved; all existing vital entries, reviewed replacements, reorder identity, unrelated procedure preserved, numbers protected, no duplicates, removed entry blocked');await b.close();
})().catch(e=>{console.error(e);process.exit(1)});

