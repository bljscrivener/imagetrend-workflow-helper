const fs=require('node:fs'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true}),page=await browser.newPage();
 await page.route('https://pafford.imagetrendelite.com/**',r=>r.fulfill({body:'<html><body></body></html>',contentType:'text/html'}));
 await page.goto('https://pafford.imagetrendelite.com/#/Incident123/Form42');
 await page.evaluate(()=>{
  const names=['STAT Info','Dispatch','History','Vital Signs','Procedures & Medications','Transport Info','Delays'];
  window.model={};document.body.innerHTML='<div id="left-pane"></div><div id="right-pane"><button>Times</button></div><div id="panel-header"></div><div id="form-composer"></div>';
  function render(name){
   document.getElementById('panel-header').textContent=name;
   const form=document.getElementById('form-composer');form.innerHTML='';
   const rules={'STAT Info':['95cf67b7-74f0-5a19-b258-08c7b96ef8d6','Patient Contact Made'],'Dispatch':['3cf8b9c0-7cf5-5581-a1b4-0a6ec9de735e','Ground Transport (ALS Equipped)'],'History':['2538b000-9d1a-52ab-9082-14aaa092730c','None Noted']};
   if(rules[name]){
    const [id,value]=rules[name];form.innerHTML='<div class="smart-list-control" id="'+id+'"><button class="smart-list-item">'+value+'</button></div>';
    const b=form.querySelector('button');if(window.model[name])b.classList.add('selected');
    b.onclick=()=>{window.model[name]=value;b.classList.add('selected');}; if(name==='STAT Info')b.style.display='none';
   }
   if(name==='Transport Info'){form.innerHTML='<input id="25089">';const input=form.querySelector('input');input.value=window.model[name]||'';input.oninput=()=>window.model[name]=input.value;}
   if(name==='Vital Signs')form.innerHTML='<div class="grid-control"><div class="grid-header"><div class="grid-label">Vital Signs</div></div><div class="grid-item-display"></div></div>';
   if(name==='Procedures & Medications')form.innerHTML='<div class="grid-control" id="aa6d315f-ccbc-58c0-950e-2e0932ee67b6"><div class="grid-header"><div class="grid-label">Procedures</div></div><div class="grid-item-display"></div></div>';
  }
  names.forEach(name=>{const b=document.createElement('button');b.textContent=name;b.onclick=()=>render(name);document.getElementById('left-pane').append(b);});
  document.querySelector('#right-pane button').onclick=()=>{
   const old=document.getElementById('times');if(old){old.remove();return;}
   const times=document.createElement('div');times.id='times';
   for(const [id,value] of [['29336Date','09/09/2026'],['29336Time','10:00:00'],['29337Date','09/09/2026'],['29337Time','10:10:00']]){
    const input=document.createElement('input');input.id=id;input.value=value;times.append(input);
   }document.body.append(times);
  };
  render('STAT Info');
 });
 await page.addScriptTag({content:fs.readFileSync('src/imagetrend-a15-helper.user.js','utf8')});
 const h=page.locator('#it-a15-helper-host');await h.locator('#launch').click();await h.locator('#whole').click();
 await page.waitForFunction(()=>document.querySelector('#it-a15-helper-host').shadowRoot.querySelector('#scan').dataset.state==='ready');
 assert.deepEqual(await page.evaluate(()=>window.model),{});
 assert.equal(await page.locator('#panel-header').textContent(),'STAT Info');
 await h.locator('#ack').check();await h.locator('#run').click();
 await page.waitForFunction(()=>document.querySelector('#it-a15-helper-host').shadowRoot.querySelector('#status').textContent.includes('Review results before saving.'));
 assert.deepEqual(await page.evaluate(()=>window.model),{'Dispatch':'Ground Transport (ALS Equipped)','History':'None Noted','Transport Info':'1'});
 assert.equal(await page.locator('#panel-header').textContent(),'STAT Info');
 assert.equal(await h.locator('#attention').isVisible(),true);
 await h.locator('#issues a').filter({hasText:'Unit Disposition'}).click();
 await page.waitForFunction(()=>document.getElementById('95cf67b7-74f0-5a19-b258-08c7b96ef8d6').style.outline.includes('3px'));
 assert.equal(await page.evaluate(()=>window.model['STAT Info']),undefined);
 console.log('PASS attention link navigates and highlights without writes; missing prerequisite deferred, independent sections applied, deferred choice retried');
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});

