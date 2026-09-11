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
 await host.locator('#quick-help summary').click();
 assert.equal(await host.locator('#quick-help p').first().isVisible(),true);
 assert.equal(await host.locator('#profile').isVisible(),false);
 assert.equal(await host.locator('#stop').isVisible(),false);
 await host.getByRole('button',{name:'Tools',exact:true}).click();
 assert.equal(await host.getByRole('button',{name:'Nukacharta',exact:true}).isVisible(),true);
 assert.equal(await host.locator('#advanced-tools').getByText('At Pt',{exact:true}).isVisible(),false);
 await host.locator('#advanced-tools summary').click();
 assert.equal(await host.locator('#read-timeline').isVisible(),true);
 await host.getByRole('button',{name:'Workflow',exact:true}).click();
 await host.locator('#quick-help summary').click();
 await page.screenshot({path:'../../outputs/clean-gui-preview.png'});
 await host.locator('#hide').click();assert.equal(await host.locator('#launch').isVisible(),true);
 await host.locator('#launch').click();assert.equal(await host.locator('#apply').isVisible(),true);
 console.log('PASS help, workflow/tools separation, advanced controls, hide/restore');await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});

