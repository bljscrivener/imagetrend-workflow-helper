const fs=require('node:fs'),assert=require('node:assert/strict'),{chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true}),page=await browser.newPage({timezoneId:'America/Chicago'});
 await page.route('https://pafford.imagetrendelite.com/**',r=>r.fulfill({body:'<div id="form-composer"></div>'}));
 await page.goto('https://pafford.imagetrendelite.com/#/Incident123/Form42');
 await page.evaluate(()=>{
   const response={DispatchPriority:'DispatchPriorityLevel_Priority1Critical',TypeOfServiceRequested:null,ResponseModeToScene:null,ResponseModes:[],Patient:{Vitals:[],PatientProcedures:[],Disposition:{PatientToAmbulances:[{MethodPatientMoved:'stretcher'}]}}};
   window.model={Incident:{Scene:{Response:response}}};
   window.ko={unwrap:x=>typeof x==='function'?x():x,contextFor:()=>({$root:{currentIncidentReadOnlyStatus:false},$parents:[model]})};
   const resources={};
   for(const [id,values] of [
     ['a5db14f5-8f30-5131-937c-912204f5151d',['Emergency Response (Primary Response Area)']],
     ['c1aa0ea5-0ad9-52d7-9170-4f0a725c2699',['With Lights and Sirens','Without Lights and Sirens']],
     ['9c627521-8b03-58e4-b7ee-7d57e7ecd0cc',['Lights and Sirens','No Lights or Sirens']],
     ['0bf28da1-6fc8-5cb0-a49f-9541aef01cae',['Stretcher']]
   ])resources[id]={Elements:values.map((Value,i)=>({Id:id.startsWith('0bf')?'stretcher':'code'+i,Value}))};
   window.imagetrend={FormComposer:{isReadOnly:()=>false},formComposer:{agencyResources:resources,agencyPresetValues:[],reportingStandardID:2},runForm:{PresetValueViewModel:function(d,r){
     const get=(o,p)=>p.split('.').reduce((a,k)=>a[k],o),display=v=>resources[d.BindingPathEntryID]?.Elements.find(x=>x.Id===v)?.Value??v??'';
     const path=d.BindingPathFromOrigin;
     if(path.includes('[].')){const [prefix,suffix]=path.split('[].'),list=get(r,prefix);this.currentValueDisplay=()=>list.map(x=>display(get(x,suffix))).join('; ');this.presetValueDisplay=()=>display(d.Value);this.applyPresetValue=()=>{list.splice(0);let o={},n=o;const parts=suffix.split('.'),key=parts.pop();for(const p of parts)n=n[p]={};n[key]=d.Value;list.push(o);};}
     else{const parts=path.split('.'),key=parts.pop(),parent=get(r,parts.join('.'));this.currentValueDisplay=()=>display(parent[key]);this.presetValueDisplay=()=>display(d.Value);this.applyPresetValue=()=>parent[key]=d.Value;}
   }}};
 });
 let source=fs.readFileSync('src/imagetrend-a15-native-test.user.js','utf8').replace(/\}\)\(\);\s*$/,'window.api={inspect,choices,readTimes,procedureTiming,delayChoices,writeTimePair,timePair,priorityChoice,missingTimes};})();');
 await page.addScriptTag({content:source});
 const results=await page.evaluate(async()=>{
   const r=model.Incident.Scene.Response,choice=id=>api.choices.find(x=>x.id===id),mode=choice('c1aa0ea5-0ad9-52d7-9170-4f0a725c2699'),desc=choice('9c627521-8b03-58e4-b7ee-7d57e7ecd0cc'),service=choice('a5db14f5-8f30-5131-937c-912204f5151d');
   const out={};out.p1=[mode,desc,service].map(x=>api.inspect(x).target);api.inspect(mode).vm.applyPresetValue();api.inspect(desc).vm.applyPresetValue();
   r.DispatchPriority='DispatchPriorityLevel_Priority2Emergent';out.p2=[mode,desc,service].map(x=>api.inspect(x).target);out.replaces=api.inspect(mode).canApply&&api.inspect(desc).canApply;
   for(const x of [mode,desc,service]){const plan=api.inspect(x);if(plan.canApply)plan.vm.applyPresetValue();}out.repeat=[mode,desc,service].every(x=>!api.inspect(x).canApply);
   r.DispatchPriority='DispatchPriorityLevel_Priority5';out.p5=api.inspect(mode).target;try{api.inspect(service);}catch(e){out.p5Service=e.message;}
   r.DispatchPriority=null;try{api.inspect(mode);}catch(e){out.noPriority=e.message;}
   out.scalar=api.inspect(choice('0bf28da1-6fc8-5cb0-a49f-9541aef01cae')).current;
   // Different IDs, label-addressed timeline, delayed native binding.
   const times=[['Unit Notified by Dispatch','10:56:00'],['Unit En Route Date/Time','10:57:00'],['Unit Arrived on Scene','10:58:00'],['Arrived at Patient','11:00:00'],['Unit Left Scene','11:15:00'],['Arrived at Destination','11:35:00'],['Unit Back in Service','12:00:20']];
   document.body.insertAdjacentHTML('beforeend',times.map(([label,time],i)=>`<div class="row"><span>${label}:</span><div><input id="changed${i}Date" value="09/09/2026"><input id="changed${i}Time" value="${time}"></div></div>`).join(''));
   await api.readTimes();out.patient=api.procedureTiming('Assessment -ALS').value;out.stretcher=api.procedureTiming('Moving a patient to a stretcher').value;out.delays=api.delayChoices();
   document.querySelector('#changed5Time').value='';await api.readTimes();out.missing=api.missingTimes(['29338']);
   // Native picker emulates a timezone-aware model while the rendered time stays local.
   document.body.insertAdjacentHTML('beforeend','<div class="grid-flyout-active"><input id="testDate"><div><input id="testTime"></div></div><div id="date-picker" style="display:none"><div class="header"><span class="close"></span></div><div class="time-button"><span class="time-button-label">Patient Arrival</span></div><div class="time-button"><span class="time-button-label">Destination Arrival</span></div><div class="minute"><button class="minus-button">-</button></div></div>');
   const date=document.querySelector('#testDate'),time=document.querySelector('#testTime'),picker=document.querySelector('#date-picker');let wall;
   function render(){const p=x=>String(x).padStart(2,'0');date.value=`${p(wall.getMonth()+1)}/${p(wall.getDate())}/${wall.getFullYear()}`;time.value=`${p(wall.getHours())}:${p(wall.getMinutes())}:${p(wall.getSeconds())}`;window.stored=wall.toISOString();}
   date.onclick=()=>picker.style.display='block';picker.querySelector('.close').onclick=()=>picker.style.display='none';
   picker.querySelectorAll('.time-button')[0].onclick=()=>{wall=new Date('2026-09-09T11:00:00');render();};
   picker.querySelectorAll('.time-button')[1].onclick=()=>{wall=new Date('2026-09-10T00:03:00');render();};
   picker.querySelector('.minus-button').onclick=()=>{wall.setMinutes(wall.getMinutes()-1);render();};
   await api.writeTimePair(api.timePair(date),'2026-09-09T11:00:00',{label:'Patient Arrival'});out.native=[date.value,time.value,stored];
   await api.writeTimePair(api.timePair(date),'2026-09-09T23:58:00',{label:'Destination Arrival',minutes:5});out.midnight=[date.value,time.value];
   return out;
 });
 assert.deepEqual(results.p1,['With Lights and Sirens','Lights and Sirens','Emergency Response (Primary Response Area)']);
 assert.deepEqual(results.p2,['Without Lights and Sirens','No Lights or Sirens','Emergency Response (Primary Response Area)']);assert.ok(results.replaces&&results.repeat);
 assert.equal(results.p5,'Without Lights and Sirens');assert.match(results.p5Service,/confirm transfer/);assert.match(results.noPriority,/missing or unsupported/);assert.equal(results.scalar,'Stretcher');
 assert.equal(results.patient,'2026-09-09T11:00:00');assert.equal(results.stretcher,'2026-09-09T11:13:00');assert.equal(results.delays.find(x=>x.label==='Scene Delay').target,'None/No Delay');assert.equal(results.delays.find(x=>x.label==='Destination Delay').targets.length,2);assert.equal(results.delays.some(x=>x.label==='Response Delay'),false);assert.match(results.missing,/Arrived at Destination/);
 assert.deepEqual(results.native,['09/09/2026','11:00:00','2026-09-09T16:00:00.000Z']);assert.deepEqual(results.midnight,['09/09/2026','23:58:00']);
 console.log('PASS priority transitions, direct-entry multiselects, label-based timeline, native timezone read-back, midnight subtraction');await browser.close();
})().catch(e=>{console.error(e);process.exit(1);});
