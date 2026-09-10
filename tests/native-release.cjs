const fs=require('node:fs'),assert=require('node:assert/strict'),{chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 const page=await browser.newPage();
 await page.goto('about:blank');
 const source=fs.readFileSync('src/imagetrend-a15-native-test.user.js','utf8');
 const create=source.slice(source.indexOf('  async function createReviewed('),source.indexOf('  function assessmentPlan('));
 const outcome=await page.evaluate(async create=>{
   const root={},entries=[],plan={url:location.href,root,missing:['Assessment -ALS'],timing:['time'],entries:[]};let calls=0;
   const currentRoot=()=>root,visible=()=>true,resolve=()=>entries,procedureName=x=>x.name;
   window.ko={unwrap:x=>x};
   const creationPlan=()=>entries.length?null:{...plan,entries:[]};
   const procedureTiming=()=>({value:'time'}),procedureWorkflow=async()=>{calls++;},$=()=>({textContent:''});
   document.body.innerHTML='<button class="panel" title="Procedures &amp; Medications">Procedures</button><div id="aa6d315f-ccbc-58c0-950e-2e0932ee67b6"></div>';
   document.querySelector('button').onclick=()=>entries.push({name:'Assessment -ALS'});
   eval(create+';window.run=createReviewed;');await window.run(plan);return calls;
 },create);
 assert.equal(outcome,0,'hydrated existing procedure must not trigger Add');
 const warning=source.slice(source.indexOf('  function nukeWarning('),source.indexOf('  function attachArtFallback('));
 const confirmed=await page.evaluate(async warning=>{
   const ui=document.body,attachArtFallback=()=>{};eval(warning+';window.warn=nukeWarning;');
   const first=window.warn();document.querySelector('#nuke-cancel').click();const canceled=await first;
   const second=window.warn();document.querySelector('.nuke-cover').dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));const escaped=await second;
   const third=window.warn();const button=document.querySelector('#nuke-confirm');const type=button.type;button.click();button.click();return [canceled,escaped,await third,type,document.querySelectorAll('.nuke-cover').length];
 },warning);
 assert.deepEqual(confirmed,[false,false,true,'button',0]);
 assert.ok(!source.slice(source.indexOf('  clearButton.onclick='),source.indexOf('if(!await nukeWarning())return')).includes('.click()'),'clear inventory cannot navigate before second confirmation');
 console.log('PASS navigation hydration skips existing procedure; cancel/Escape/one-shot confirmation; clear inventory has no navigation');
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1);});
