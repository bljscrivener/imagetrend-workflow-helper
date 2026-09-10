const fs=require('fs'),assert=require('node:assert/strict'),{chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 const page=await browser.newPage({timezoneId:'America/Chicago',viewport:{width:1100,height:900}});
 page.on('pageerror',e=>{throw e;});
 await page.route('https://pafford.imagetrendelite.com/**',r=>r.fulfill({body:'<div id="form-composer"><div class="control" id="9753adcb-f760-554b-94d6-60a5e82badd8"><label>Contacted</label><input id="fieldDate"><input id="fieldTime"></div></div>'+['29331','29332','29335','29336','29337','29338','29342'].map((id,i)=>`<input id="${id}Date" value="09/09/2026"><input id="${id}Time" value="${['10:50:00','10:53:00','10:59:00','11:00:00','11:15:00','11:30:00','12:00:00'][i]}">`).join('')}));
 await page.goto('https://pafford.imagetrendelite.com/#/Incident123/Form42');
 await page.evaluate(()=>{
   const response={Patient:{Vitals:[],PatientProcedures:[],Disposition:{DispositionNumberOfPatientsTransportedModValue:{NumberOfPatientsTransported:null},DispositionTransportModeFromSceneModValue:{TransportModeFromScene:null},HospitalTeamActivations:[]},InterfacilityTransfer:{AcceptingHospitalNotified:null}},ResponseTime:{ReceivingHospitalContacted:null},ResponseDelays:[],SceneDelays:[],TransportDelays:[],TurnAroundDelays:[]};
   document.querySelector('#fieldTime').addEventListener('change',()=>{const d=document.querySelector('#fieldDate').value.split('/');response.ResponseTime.ReceivingHospitalContacted=d[2]+'-'+d[0]+'-'+d[1]+'T'+document.querySelector('#fieldTime').value;});
   window.model={Incident:{Scene:{Response:response}}};window.writes=[];
   window.ko={unwrap:x=>typeof x==='function'?x():x,contextFor:()=>({$root:{currentIncidentReadOnlyStatus:false},$parents:[model]})};
   const resources={};
   for(const [id,values] of [
    ['a7f8dd77-6a81-580f-9b55-43325de410c0',['Staff Delay']],['b8e1199a-3d25-5c25-9d50-25743474a17d',['None/No Delay']],['3ecd70cc-229a-541b-993c-60d0928e963c',['None/No Delay']],['6f0ddd39-647d-5bbc-a963-19a0bbf7fb9a',['Documentation','ED Overcrowding / Transfer of Care']],['62dd5264-cd67-56ec-a3d3-f35e00818537',['Without Lights and Sirens']],['50ac60ee-31b5-5836-b004-25def8d05ae7',['Yes']],['16ccfb92-ef4d-5527-a0ee-39639fd222f4',['No']]
   ])resources[id]={Elements:values.map((Value,i)=>({Id:'code'+i,Value}))};
   window.imagetrend={FormComposer:{isReadOnly:()=>false},formComposer:{agencyResources:resources,agencyPresetValues:[],reportingStandardID:2},runForm:{PresetValueViewModel:function(d,r){
     const path=d.BindingPathFromOrigin,get=(o,p)=>p.split('.').reduce((a,k)=>a[k],o),display=v=>resources[d.BindingPathEntryID]?.Elements.find(x=>x.Id===v)?.Value??v??'';
     this.init=()=>{};
     if(path.includes('[].')){
       const [prefix,suffix]=path.split('[].'),list=get(r,prefix);
       this.currentValueDisplay=()=>list.map(x=>display(get(x,suffix))).join('; ');this.presetValueDisplay=()=>d.Value?.split('|').map(display).join('; ')||'';
       this.applyPresetValue=()=>{writes.push(path);list.splice(0);for(const value of (d.Value?.split('|')||[])){let o={},n=o;const parts=suffix.split('.'),key=parts.pop();for(const p of parts)n=n[p]={};n[key]=value;list.push(o);}};
     }else {const parts=path.split('.'),key=parts.pop(),parent=get(r,parts.join('.'));this.currentValueDisplay=()=>display(parent[key]);this.presetValueDisplay=()=>display(d.Value);this.applyPresetValue=()=>{writes.push(path);parent[key]=d.Value;};}
   }}};
 });
 let source=fs.readFileSync('src/imagetrend-a15-native-test.user.js','utf8');source=source.replace(/\}\)\(\);\s*$/,'window.testAPI={inspect,readTimes,procedureTiming,delayChoices,localStamp,choices};})();');
 await page.addScriptTag({content:source});const h=page.locator('#it-a15-native-test');await h.locator('#launch').click();
 const rules=await page.evaluate(async()=>{await testAPI.readTimes();return {rules:testAPI.delayChoices(),time:testAPI.procedureTiming('Assessment -ALS'),stretcher:testAPI.procedureTiming('Moving a patient to a stretcher')};});
 assert.equal(rules.rules.length,4);assert.equal(rules.time.value,'2026-09-09T11:00:00');assert.equal(rules.stretcher.value,'2026-09-09T11:13:00');
 // Native choices, including a two-choice multiselect, work without visiting Transport or Delays.
 await h.locator('#apply').click();await page.waitForFunction(()=>!document.querySelector('#it-a15-native-test').shadowRoot.querySelector('#apply').disabled);
 const actual=await page.evaluate(()=>model.Incident.Scene.Response);
 assert.equal(actual.Patient.Disposition.DispositionNumberOfPatientsTransportedModValue.NumberOfPatientsTransported,'1');
 assert.equal(actual.Patient.InterfacilityTransfer.AcceptingHospitalNotified,'code0');
 assert.equal(actual.TurnAroundDelays.length,2);assert.equal(actual.ResponseDelays.length,1);assert.equal(actual.SceneDelays.length,1);assert.equal(actual.ResponseTime.ReceivingHospitalContacted,'2026-09-09T11:25:00');assert.equal(actual.Patient.Disposition.HospitalTeamActivations.length,1);
 await page.locator('#fieldTime').focus();await h.getByRole('button',{name:'At Pt',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#fieldTime').value==='11:00:00');assert.equal(await page.locator('#fieldDate').inputValue(),'09/09/2026');
 // Invalid departure cannot be silently replaced by the arrival fallback.
 await page.locator('[id="29337Time"]').fill('nonsense');const error=await page.evaluate(async()=>{await testAPI.readTimes();try{testAPI.procedureTiming('Moving a patient to a stretcher');return '';}catch(e){return e.message;}});assert.match(error,/Departure time is invalid/);
 // A prerequisite exposes a later resource; an earlier pending choice heals on the next pass.
 await page.locator('[id="29337Time"]').fill('11:15:00');await page.evaluate(()=>{
   const res=imagetrend.formComposer.agencyResources,resp=model.Incident.Scene.Response;
   resp.Patient.Disposition.DispositionTransportModeFromSceneModValue.TransportModeFromScene=null;resp.Patient.InterfacilityTransfer.AcceptingHospitalNotified=null;delete res['62dd5264-cd67-56ec-a3d3-f35e00818537'];
   const Original=imagetrend.runForm.PresetValueViewModel;imagetrend.runForm.PresetValueViewModel=function(d,r){const vm=new Original(d,r),apply=vm.applyPresetValue;vm.applyPresetValue=()=>{apply();if(d.BindingPathEntryID==='50ac60ee-31b5-5836-b004-25def8d05ae7')res['62dd5264-cd67-56ec-a3d3-f35e00818537']={Elements:[{Id:'code0',Value:'Without Lights and Sirens'}]};};return vm;};
 });await h.locator('#apply').click();await page.waitForFunction(()=>!document.querySelector('#it-a15-native-test').shadowRoot.querySelector('#apply').disabled);assert.equal(await page.evaluate(()=>model.Incident.Scene.Response.Patient.Disposition.DispositionTransportModeFromSceneModValue.TransportModeFromScene),'code0');
 // Stop finishes the current write and leaves the following field untouched.
 await page.evaluate(()=>{const r=model.Incident.Scene.Response;r.Patient.Disposition.DispositionTransportModeFromSceneModValue.TransportModeFromScene=null;r.Patient.InterfacilityTransfer.AcceptingHospitalNotified=null;const Original=imagetrend.runForm.PresetValueViewModel;imagetrend.runForm.PresetValueViewModel=function(d,r){const vm=new Original(d,r),apply=vm.applyPresetValue;vm.applyPresetValue=()=>{apply();if(d.BindingPathEntryID==='62dd5264-cd67-56ec-a3d3-f35e00818537')document.querySelector('#it-a15-native-test').shadowRoot.querySelector('#stop').click();};return vm;};});
 await h.locator('#apply').click();await page.waitForFunction(()=>!document.querySelector('#it-a15-native-test').shadowRoot.querySelector('#apply').disabled);assert.equal(await page.evaluate(()=>model.Incident.Scene.Response.Patient.InterfacilityTransfer.AcceptingHospitalNotified),null);assert.match(await h.locator('#status').textContent(),/stopped/);
 // An attempted failing write is never retried by auto-healing.
 await page.evaluate(()=>{model.Incident.Scene.Response.Patient.InterfacilityTransfer.AcceptingHospitalNotified=null;window.failedAttempts=0;const Original=imagetrend.runForm.PresetValueViewModel;imagetrend.runForm.PresetValueViewModel=function(d,r){const vm=new Original(d,r);if(d.BindingPathEntryID==='50ac60ee-31b5-5836-b004-25def8d05ae7')vm.applyPresetValue=()=>{failedAttempts++;throw Error('native write failed');};return vm;};});
 await h.locator('#apply').click();await page.waitForFunction(()=>!document.querySelector('#it-a15-native-test').shadowRoot.querySelector('#apply').disabled);assert.equal(await page.evaluate(()=>failedAttempts),1);assert.match(await h.locator('#issues').textContent(),/native write failed/);
 await page.screenshot({path:'../../outputs/a15-gremlin-preview.png'});
 // Clear requires both warnings and keeps the timeline while reporting incomplete scope.
 await h.getByRole('button',{name:'Tools / Settings',exact:true}).click();
 assert.equal(await h.locator('#apply').isVisible(),false);
 assert.equal(await h.locator('#copy-diagnostic-log').isVisible(),true);
 await page.evaluate(()=>{for(const key of ['Vitals','PatientProcedures']){const list=model.Incident.Scene.Response.Patient[key];list.removeAll=()=>list.splice(0);}window.confirm=()=>true;});
 await h.locator('#clear-entries').click();await h.locator('#nuke-confirm').waitFor();assert.equal(await h.locator('.nuke-dialog svg').count(),1);await h.locator('#nuke-cancel').click();assert.equal(await page.evaluate(()=>model.Incident.Scene.Response.Patient.Disposition.DispositionNumberOfPatientsTransportedModValue.NumberOfPatientsTransported),'1');
 await h.locator('#clear-entries').click();await h.locator('#nuke-confirm').click();await page.waitForFunction(()=>document.querySelector('#it-a15-native-test').shadowRoot.querySelector('#result').textContent.includes('Cleared'));assert.equal(await page.locator('[id="29336Time"]').inputValue(),'11:00:00');assert.equal(await page.evaluate(()=>model.Incident.Scene.Response.Patient.Disposition.DispositionNumberOfPatientsTransportedModValue.NumberOfPatientsTransported),null);assert.equal(await h.locator('.confetti').count(),0,'partial coverage is not celebrated as full clear');
 console.log('PASS transport native mappings, two-choice delays, local times, shortcuts, invalid departure, bounded prerequisite healing');await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});

