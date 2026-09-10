const fs=require('fs'),assert=require('node:assert/strict'),{chromium}=require('playwright');
(async()=>{const b=await chromium.launch({channel:'msedge',headless:true}),p=await b.newPage();await p.goto('about:blank');
const s=fs.readFileSync('src/imagetrend-a15-native-test.user.js','utf8');const code=s.slice(s.indexOf('  function assessmentPlan'),s.indexOf("  $('#launch').onclick"));
const result=await p.evaluate(async code=>{
const result=[];
for(const count of [0,1,2,3]){
 document.body.innerHTML='<div class="section" title="Assessment"></div><div class="panel" title="Assessment/Exam"></div><div id="8e916322-32f6-582f-8ad2-69a689c49b0c"><div class="grid-actions"><button>Add</button></div></div>';
 const entries=Array.from({length:count},()=>({ExamTime:null,Finding:'preserve'})),root={Incident:{Scene:{Response:{Patient:{Exams:entries}}}}},path='Incident.Scene.Response.Patient.Exams';
 const ko=window.ko={unwrap:x=>typeof x==='function'?x():x,contextFor:x=>({$data:x.tagName==='INPUT'?{BindingPath:path+'[].ExamTime',BindingPathEntryID:'date'}:{BindingPath:path}})};
 window.imagetrend={formComposer:{reportingStandardID:2},runForm:{PresetValueViewModel:function(d){this.applyPresetValue=()=>{const i=Number(d.BindingPathFromOrigin.split('.')[5]);entries[i].ExamTime=d.Value;};}}};
 const visible=x=>!!x&&x.isConnected&&!!x.getClientRects().length,currentRoot=()=>root,procedureTiming=()=>({value:'2026-09-09T11:00:00.000Z'}),times={'29338':Date.parse('2026-09-09T11:30:00.000Z')};
 const resolve=(r,path)=>path.split('.').reduce((o,k)=>o[k],r);
 function open(isNew){const fly=document.createElement('div');fly.className='grid-flyout-active';fly.innerHTML='<input id="abc25415Date"><input id="abc25415Time"><button data-bind="cancelButtonClickHandler">Cancel</button><button data-bind="okButtonClickHandler">OK</button>';document.body.append(fly);fly.querySelector('[data-bind="cancelButtonClickHandler"]').onclick=()=>fly.remove();fly.querySelector('[data-bind="okButtonClickHandler"]').onclick=()=>{if(isNew)entries.push({ExamTime:procedureTiming().value,Finding:null});fly.remove();};}
 const grid=document.getElementById('8e916322-32f6-582f-8ad2-69a689c49b0c');grid.querySelector('button').onclick=()=>open(true);
 for(let i=0;i<count;i++){const row=document.createElement('div');row.textContent='Assessment';row.dataset.bind='click: grid.openItem($context)';row.onclick=()=>open(false);grid.append(row);}
 let outcome;eval(code+';window.testAssessment=()=>createAssessment(assessmentPlan());');try{outcome=await window.testAssessment();}catch(e){outcome=e.message;}result.push({count,entries,outcome});
}
return result;},code);
for(const r of result){if(r.count===3){assert.match(r.outcome,/More than two/);assert.ok(r.entries.every(x=>x.ExamTime===null));continue;}assert.equal(r.entries.length,Math.max(1,r.count));assert.equal(r.entries[0].ExamTime,'2026-09-09T11:00:00.000Z');if(r.count===2)assert.equal(r.entries[1].ExamTime,'2026-09-09T11:30:00.000Z');assert.ok(r.entries.every(x=>x.Finding===(r.count?'preserve':null)));}console.log('PASS Assessment: create first only, first patient contact, existing second destination, findings preserved, third blocks');await b.close();})().catch(e=>{console.error(e);process.exit(1)});
