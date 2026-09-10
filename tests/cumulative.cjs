const fs=require('node:fs'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 const page=await browser.newPage();
 await page.route('https://pafford.imagetrendelite.com/**',r=>r.fulfill({body:'<html><body></body></html>',contentType:'text/html'}));
 await page.goto('https://pafford.imagetrendelite.com/#/Incident123/Form42');
 const src=fs.readFileSync('src/imagetrend-a15-helper.user.js','utf8');
 const code=src.slice(src.indexOf('  const FORM'),src.indexOf('  const host=document.createElement'));
 const results=await page.evaluate(async code=>{
  eval(code+';window.api={automaticTimeline,patientArrivalTime,readTimelineSnapshot,setChoice,readField,delayRules,apply,inspect,activationPlan,addHospitalActivation,changeJournal,clearAddedValue,clearCandidate,reviewVitals,applyVitalSet};');
  const results=[];
  const check=(name,value)=>{if(!value)throw Error(name);results.push(name);};
  const time=(prefix,date,time)=>'<input id="'+prefix+'Date" value="'+date+'"><input id="'+prefix+'Time" value="'+time+'">';
  const field=(id,label,options,multi=false)=>'<div class="single-row-control" id="'+id+'"><label>'+label+':</label>'+(multi?'<input class="koMultiselect-searchbar-input">':'<div class="koSingleselect-selectedItem-value"></div>')+options.map(o=>'<div class="'+(multi?'koMultiselect':'koSingleselect')+'-dropDownItem">'+o+'</div>').join('')+'</div>';
  function wireMulti(c){c.querySelectorAll('.koMultiselect-dropDownItem').forEach(n=>n.onclick=()=>{const chip=document.createElement('div');chip.className='koMultiselect-selectedItem-value';chip.textContent=n.textContent;c.append(chip);});}
  document.body.innerHTML='<div id="panel-header">Procedures &amp; Medications</div><div id="right-pane"><button>Times</button></div>';
  let toggles=0;
  document.querySelector('button').onclick=()=>{
   toggles++;
   const panel=document.getElementById('times-panel');
   if(panel)panel.remove();
   else document.body.insertAdjacentHTML('beforeend','<div id="times-panel">'+time('29336','09/09/2026','10:00:00')+time('29337','09/09/2026','10:10:00')+'</div>');
  };
  await api.automaticTimeline();
  check('timeline opens reads and closes',toggles===2&&!document.getElementById('times-panel')&&api.patientArrivalTime().time==='10:00:00');

  document.body.innerHTML='<div id="form-composer"><div class="single-row-control" id="ecg"><komultiselect></komultiselect><div class="mod-value-watermark"></div><div class="mod-value-action" data-bind="click: toggleOpen"><div class="mod-value-popout" style="display:none"><div class="not-value" data-bind="click: setNotValue"><span class="not-value-label">Not Applicable</span></div></div></div></div></div>';
  const ecg=document.getElementById('ecg'),menu=ecg.querySelector('.mod-value-popout');
  let opens=0;
  ecg.querySelector('.mod-value-action').onclick=()=>{opens++;menu.style.display='block';};
  ecg.querySelector('.not-value').onclick=e=>{e.stopPropagation();ecg.querySelector('.mod-value-watermark').textContent='Not Applicable';menu.style.display='none';};
  await api.setChoice(ecg,'Not Applicable',[]);
  check('ECG minus menu and persisted watermark',opens===1&&api.readField(ecg)[0]==='Not Applicable');

  document.body.innerHTML='<div id="form-composer">'+time('29331','09/09/2026','10:00:00')+time('29332','09/09/2026','10:02:00')+time('29338','09/09/2026','11:00:00')+time('29342','09/09/2026','11:20:00')+field('response','Response Delay',['Staff Delay'],true)+field('transport','Transport Delay',['None'],true)+field('destination','Destination Delay',['Documentation','ED crowding/transfer of care'],true)+'</div>';
  api.readTimelineSnapshot(true);
  check('strict delay thresholds',api.delayRules().length===1);
  document.getElementById('29332Time').value='10:02:01';document.getElementById('29342Time').value='11:20:01';
  api.readTimelineSnapshot(true);
  const rules=api.delayRules();
  check('response and destination delay rules',rules.length===3&&rules.find(r=>r.id==='response').target==='Staff Delay');
  const dest=document.getElementById('destination');wireMulti(dest);
  const item=api.inspect(rules.find(r=>r.id==='destination'));
  await api.apply(item);
  check('two destination selections verified',api.readField(dest).length===2&&api.inspect(rules.find(r=>r.id==='destination')).status==='kept');
  const response=document.getElementById('response');wireMulti(response);
  const reviewed=api.inspect(rules.find(r=>r.id==='response'));
  document.getElementById('29332Time').value='10:01:00';
  let rejected=false;try{await api.apply(reviewed);}catch(e){rejected=true;}
  check('changed delay source rejected',rejected&&api.readField(response).length===0);

  document.body.innerHTML='<div id="form-composer"><div class="grid-control"><div class="grid-header"><div class="grid-label">Hospital Team Activations</div><div class="grid-actions"><button data-bind="click: grid.addGridItemWithoutSubformSelection($context)">Add</button></div></div><div class="grid-item-display"></div></div></div>';
  let added=0;
  document.querySelector('button').onclick=()=>{
   added++;document.querySelector('.grid-item-display').innerHTML=field('16ccfb92-ef4d-5527-a0ee-39639fd222f4','Destination Team Pre-Arrival Alert or Activation',['No']);
   const c=document.getElementById('16ccfb92-ef4d-5527-a0ee-39639fd222f4');
   c.querySelector('.koSingleselect-dropDownItem').onclick=()=>c.querySelector('.koSingleselect-selectedItem-value').textContent='No';
  };
  await api.addHospitalActivation();
  check('activation added once',added===1&&api.activationPlan()===null);

  document.body.innerHTML='<div id="form-composer"><input id="testText"></div>';
  const input=document.getElementById('testText');
  await api.apply({el:input,status:'ready',before:'',rule:{id:'testText',label:'Test metadata',input:true,target:'adult'}});
  const entry=api.changeJournal.find(e=>e.el===input);
  check('helper-only clear journal',!!entry&&api.clearCandidate(entry));
  input.value='edited by user';
  rejected=false;try{await api.clearAddedValue(entry);}catch(e){rejected=true;}
  check('user edits excluded from clear',rejected&&input.value==='edited by user');
  input.value='adult';await api.clearAddedValue(entry);check('selected clear verified',input.value==='');

  document.body.innerHTML='<div id="form-composer"><div class="grid-control"><div class="grid-header"><div class="grid-label">Vital Signs</div></div><div class="grid-item-display"></div></div></div>';
  for(let i=0;i<2;i++){
   const row=document.createElement('div');row.className='grid-item';
   row.innerHTML='<input id="set'+i+'25333Date" value="09/09/2026"><input id="set'+i+'25341" value="123">'+field('7f5c88af-a3be-5947-b47b-ffe6cc957102','AVPU',['Alert']);
   row.querySelector('.koSingleselect-dropDownItem').onclick=()=>row.querySelector('.koSingleselect-selectedItem-value').textContent='Alert';
   document.querySelector('.grid-item-display').append(row);
  }
  const sets=await api.reviewVitals();
  await api.applyVitalSet(sets[0]);await api.applyVitalSet(sets[1]);
  check('multiple inline vitals from list',sets.length===2&&[...document.querySelectorAll('.koSingleselect-selectedItem-value')].every(n=>n.textContent==='Alert'));
  check('measured numeric vitals preserved',[...document.querySelectorAll('input[id$="25341"]')].every(n=>n.value==='123'));
  document.body.innerHTML='<div id="form-composer"><div class="grid-control"><div class="grid-header"><div class="grid-label">Vital Signs</div></div><div class="grid-item-display"><div data-bind="click: grid.openItem($context)">Vital set 11:00</div></div></div></div>';
  let savedValue='',savedNumber='',openedCount=0;
  document.querySelector('.grid-item-display > div').onclick=()=>{
    openedCount++;
    const fly=document.createElement('div');fly.className='grid-flyout-overlay grid-flyout-active';
    fly.innerHTML='<div class="grid-label">Vital Signs</div><input id="modal25333Date" value="09/09/2026"><input id="modal25341" value="123">'+field('7f5c88af-a3be-5947-b47b-ffe6cc957102','AVPU',['Alert'])+'<button class="grid-button" data-bind="click: grid.okButtonClickHandler($context)">OK</button><button class="grid-button" data-bind="click: grid.cancelButtonClickHandler($context)">Cancel</button>';
    fly.querySelector('.koSingleselect-selectedItem-value').textContent=savedValue;
    fly.querySelector('.koSingleselect-dropDownItem').onclick=()=>fly.querySelector('.koSingleselect-selectedItem-value').textContent='Alert';
    fly.querySelectorAll('button')[0].onclick=()=>{savedValue=fly.querySelector('.koSingleselect-selectedItem-value').textContent;savedNumber=fly.querySelector('[id="modal25341"]').value;fly.remove();};
    fly.querySelectorAll('button')[1].onclick=()=>fly.remove();
    document.getElementById('form-composer').append(fly);
  };
  const modalSets=await api.reviewVitals();
  check('modal vital review returns without writes',savedValue===''&&!document.querySelector('.grid-flyout-active'));
  await api.applyVitalSet(modalSets[0]);
  check('modal vitals applied from list and closed',savedValue==='Alert'&&savedNumber==='123'&&openedCount===2&&!document.querySelector('.grid-flyout-active'));
  return results;
 },code);
 for(const name of results)console.log('PASS',name);
 assert.equal(results.length,14);
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
