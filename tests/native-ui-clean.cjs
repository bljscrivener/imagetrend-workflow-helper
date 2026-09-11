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
 const host=page.locator('#it-a15-native-test'); await host.locator('#launch').click();
 assert.equal(await host.getByRole('button',{name:'At Pt',exact:true}).isVisible(),true);
 assert.equal(await host.getByRole('button',{name:'Leaving Scene',exact:true}).isVisible(),true);
 assert.equal(await host.locator('#profile').isVisible(),false);
 assert.equal(await host.locator('#stop').isVisible(),false);
 await host.getByRole('button',{name:'Tools',exact:true}).click();
 assert.equal(await host.getByRole('button',{name:'Nukacharta',exact:true}).isVisible(),true);
 await host.locator('#quick-help summary').click();
 assert.equal(await host.locator('#quick-help p').first().isVisible(),true);
 await host.getByRole('button',{name:'Settings',exact:true}).click();
 await host.locator('#advanced-tools summary').click();
 assert.equal(await host.locator('#read-timeline').isVisible(),true);
 assert.equal(await host.getByRole('button',{name:'View workflow steps',exact:true}).isVisible(),true);
 await host.getByRole('button',{name:'View workflow steps',exact:true}).click();
 assert.equal(await host.getByText('No field visits recorded.',{exact:true}).isVisible(),true);
 await host.locator('#arrange-buttons').click();
 await host.getByRole('button',{name:'Home',exact:true}).click();
 await page.evaluate(()=>{const root=document.querySelector('#it-a15-native-test').shadowRoot,button=[...root.querySelectorAll('.shortcuts button')].find(b=>b.textContent==='At Pt'),tab=[...root.querySelectorAll('nav button')].find(b=>b.textContent==='Tools'),dataTransfer=new DataTransfer();button.dispatchEvent(new DragEvent('dragstart',{bubbles:true,dataTransfer}));tab.dispatchEvent(new DragEvent('drop',{bubbles:true,dataTransfer}));});
 assert.equal(await host.locator('#tool-shortcuts').getByRole('button',{name:'At Pt',exact:true}).isVisible(),true);
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('gremlin-ui-v1')).timestampLayout.find(x=>x.id===0).area),'tools');
 await host.getByRole('button',{name:'Settings',exact:true}).click();
 await host.getByRole('button',{name:'Restore timestamp buttons',exact:true}).click();
 await host.locator('#arrange-buttons').click();
 await host.getByRole('button',{name:'Home',exact:true}).click();
 assert.equal(await host.locator('#quick-help').isVisible(),false);
 assert.equal(await host.locator('#read-timeline').isVisible(),false);
 assert.equal(await host.locator('section').evaluate(x=>getComputedStyle(x).backgroundColor),'rgb(32, 33, 42)');
 assert.equal(await page.evaluate(()=>api.choices.some(c=>c.label.includes('STEMI'))),false);
 assert.equal(await page.evaluate(()=>api.choices.find(c=>c.label==='Type of Destination').target),'Hospital-Emergency Department');
 // Native Timestamp Lab route works without a Times panel or opening it.
 await page.evaluate(()=>{
   const form=document.querySelector('#form-composer');form.innerHTML='<div class="control"><input id="labDate"><input id="labTime"></div><div id="date-picker">Native picker</div>';
   const old=ko.contextFor;window.nativeWrites=0;window.locked=false;
   window.dateFns={parse:x=>new Date(x),format:x=>x};imagetrend.helpers={isFire:()=>false,getISODateTimeFormat:()=>''};
   const source={ResponseTimeArrivedAtPatientModValue:{ArrivedAtPatient:'2026-09-09T11:00:00'},ResponseTimeUnitLeftSceneModValue:{UnitLeftScene:'2026-09-09T11:15:00'}};
   const vm={focusedElement:()=> 'labTime',currentResponseTimesObject:()=>source,datePickerInputObservable:()=>'',setDateObj(d){nativeWrites++;document.getElementById('labDate').value='09/09/2026';document.getElementById('labTime').value=d.getHours()+':'+String(d.getMinutes()).padStart(2,'0')+':00';}};
   document.getElementById('labDate').onclick=()=>{throw Error('Must reuse the open picker without clicking date again');};
   ko.isObservable=x=>typeof x==='function';ko.contextFor=n=>n.id==='date-picker'?{$data:vm}:n.id==='labDate'?{$root:{currentIncidentReadOnlyStatus:()=>locked},$parents:[model]}:old(n);
 });
 await page.locator('#labDate').focus();await host.getByRole('button',{name:'At Pt',exact:true}).click();
 await page.waitForFunction(()=>document.getElementById('labTime').value==='11:00:00');
 await page.waitForFunction(()=>document.querySelector('#it-a15-native-test').shadowRoot.querySelector('#status').textContent==='At Pt — verified');
 await host.getByRole('button',{name:'Leaving Scene',exact:true}).click();
 await page.waitForFunction(()=>document.getElementById('labTime').value==='11:15:00');
 await page.waitForTimeout(200);await page.evaluate(()=>locked=true);await host.getByRole('button',{name:'At Pt',exact:true}).click();await page.waitForTimeout(200);
 assert.equal(await page.evaluate(()=>nativeWrites),2,'locked chart must not write');
 await page.evaluate(()=>document.querySelector('#form-composer').replaceChildren());
 await page.screenshot({path:'../../outputs/clean-gui-preview.png'});
 await host.locator('#hide').click();assert.equal(await host.locator('#launch').isVisible(),true);
 await host.locator('#launch').click();assert.equal(await host.locator('#apply').isVisible(),true);
 console.log('PASS help, workflow/tools separation, advanced controls, hide/restore');await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});

