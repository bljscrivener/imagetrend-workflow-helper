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

 await h.locator('#launch').click();assert.equal(await h.locator('#ack').count(),0);assert.equal(await h.locator('#apply').isEnabled(),true);assert.equal(await h.locator('#tally').getAttribute('open'),null);assert.equal(await h.locator('#profile-select option').count(),1);
 await h.locator('#apply').click();await p.waitForFunction(()=>!document.querySelector('#it-a15-native-test').shadowRoot.querySelector('#apply').disabled);assert.deepEqual(await p.evaluate(()=>entries.vitals.map(x=>x.VitalsLevelOfResponseModValue.LevelOfResponse)),['alert','alert']);assert.equal(await p.evaluate(()=>writes.length),7);assert.equal(await h.locator('#tally').evaluate(x=>x.open),true);await h.locator('#hide').click();assert.equal(await h.locator('section').isVisible(),false);await h.locator('#launch').click();assert.equal(await h.locator('footer #clear-entries').count(),1);assert.equal(await h.locator('#apply').isEnabled(),true);
 assert.match(await h.locator('#issues').textContent(),/Timestamp field could not be opened/);
 const snapshot=await p.evaluate(()=>JSON.parse(sessionStorage.getItem('it-a15-before-run')));assert.equal(snapshot.incident.Scene.Response.Patient.Vitals[0].VitalsLevelOfResponseModValue.LevelOfResponse,'verbal');assert.ok(!JSON.stringify(snapshot).includes('__parent'));assert.ok(await h.locator('#issues button').count()>0);
 await h.locator('#apply').click();await p.waitForFunction(()=>!document.querySelector('#it-a15-native-test').shadowRoot.querySelector('#apply').disabled);assert.equal(await p.evaluate(()=>writes.length),7,'rerun is idempotent');
 await p.evaluate(()=>{entries.vitals[0].VitalsLevelOfResponseModValue.LevelOfResponse='verbal';Storage.prototype.setItem=()=>{throw Error('storage unavailable');};});await h.locator('#apply').click();await p.waitForFunction(()=>document.querySelector('#it-a15-native-test').shadowRoot.querySelector('#result').textContent.includes('storage unavailable'));assert.equal(await p.evaluate(()=>writes.length),7,'capture failure prevents writes');
 console.log('PASS direct Go without checkbox/preview, native updates, issues expand tally, top controls, manual collapse');await b.close();
})().catch(e=>{console.error(e);process.exit(1)});
