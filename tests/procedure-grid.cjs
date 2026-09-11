const fs=require('node:fs'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true}),page=await browser.newPage();
 const src=fs.readFileSync(process.argv[2]||'src/imagetrend-a15-helper.user.js','utf8');
 const code=src.slice(src.indexOf('  const FORM'),src.indexOf("  const host=document.createElement"));
 const results=await page.evaluate(async code=>{
  eval(code+';window.openEntry=openProcedureEntry;');
  const results=[];
  for(const mode of ['empty','populated','filtered','disabled','wronglabel']){
   document.body.innerHTML='<div id="aa6d315f-ccbc-58c0-950e-2e0932ee67b6"><div class="grid-label">Procedures</div><div class="grid-actions"><button class="grid-button" data-bind="click: grid.openSubformSelectionModal($context)">Add</button></div><button class="grid-filter grid-button-highlighted">All</button><div class="grid-item-display"></div></div><button id="medications">Add</button>';
   let clicks=0,wrongClicks=0;
   document.querySelector('#medications').onclick=()=>wrongClicks++;
   const button=document.querySelector('.grid-actions button');
   button.onclick=()=>{clicks++;setTimeout(()=>document.body.insertAdjacentHTML('beforeend','<div class="grid-flyout-overlay grid-flyout-active"><div class="grid-label">Procedure</div></div>'),20);};
   if(mode==='populated')document.querySelector('.grid-item-display').innerHTML='<div>Existing</div>';
   if(mode==='filtered')document.querySelector('.grid-filter').classList.remove('grid-button-highlighted');
   if(mode==='disabled')button.classList.add('disabled');
   if(mode==='wronglabel')document.querySelector('.grid-label').textContent='Medications';
   let error='';try{await openEntry();}catch(e){error=e.message;}
   results.push({mode,error,clicks,wrongClicks});
  }
  return results;
 },code);
 for(const r of results){assert.equal(r.clicks,r.mode==='empty'?1:0);assert.equal(r.wrongClicks,0);assert.equal(!r.error,r.mode==='empty');console.log('PASS',r.mode);}
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});

