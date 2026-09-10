const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({channel:'msedge',headless:true});
  const page = await browser.newPage();
  await page.route('https://pafford.imagetrendelite.com/**', route => route.fulfill({body:'<html><body></body></html>',contentType:'text/html'}));
  await page.goto('https://pafford.imagetrendelite.com/#/Incident123/Form42');
  const source = fs.readFileSync('src/imagetrend-a15-native-test.user.js','utf8');
  const code = source.slice(source.indexOf('  const choices='),source.indexOf('  const host=')) + source.slice(source.indexOf('  let times='),source.indexOf('  function reset')) + source.slice(source.indexOf('  const procedureWorkflow='),source.indexOf('  function currentRoot'));
  const results = await page.evaluate(async code => {
    eval(code + ';window.api={PROCEDURE_NAMES:["Assessment -ALS","Neurological assessment","Adult pain assessment","Moving a patient to a stretcher"],addProcedureBundle:async cb=>{await readTimes();return procedureWorkflow(api.PROCEDURE_NAMES,cb);}};');
    const results=[];
    for (const mode of ['success','search','midnight','badtime','norole','populated','disabled','missing','duplicate','noadvance','retry']) {
      sessionStorage.clear();
      document.body.innerHTML='<div id="form-composer"></div>';
      let serial=0, commits=[], details=[];
      function entry() {
        serial++;
        const form=document.getElementById('form-composer');
        form.innerHTML='<div class="grid-flyout-overlay grid-flyout-active"><div class="grid-label">Procedure</div><button class="grid-button" data-bind="click: function() { imagetrend.formComposer.controlHandlers.grid.addAnotherButtonClickHandler($context) }">Add Another</button><button class="grid-button" data-bind="click: function() { imagetrend.formComposer.controlHandlers.grid.okButtonClickHandler($context) }">OK</button><input id="entry'+serial+'25443Date"><div class="single-row-control" id="02dffd5f-4c68-506b-881d-5b00c78090aa"><div class="koSingleselect-selectedItem-value"></div><button class="koSingleselect-down-button">Open</button><div class="options" style="display:none"></div></div></div>';
        const field=form.querySelector('.single-row-control'), value=field.querySelector('.koSingleselect-selectedItem-value');
        form.insertAdjacentHTML('afterbegin','<input id="29337Date" value="09/09/2026"><input id="29337Time" value="12:10:00"><input id="29336Date" value="09/09/2026"><input id="29336Time" value="12:00:00">');
        const fly=form.querySelector('.grid-flyout-overlay');
        fly.insertAdjacentHTML('beforeend','<input id="entry'+serial+'25443Time" value="20:00:00"><div class="single-row-control" id="d0c37cfb-ac96-5c0e-9eb6-d21aeb3f57d7"><div class="koSingleselect-selectedItem-value">Critical Care Paramedic</div><div class="koSingleselect-dropDownItem">Paramedic</div></div>');
        const role=fly.querySelector('[id="d0c37cfb-ac96-5c0e-9eb6-d21aeb3f57d7"]');
        for(const [id,label] of [['c07c1d8b-c7d4-5a5a-8ec1-01bf67f882e0','No'],['6a3cd763-c562-574c-b209-bbced74d73c1','Protocol (Standing Order)'],['adcc71b8-0b92-5387-8b9f-cb94b729e4ac','Yes']]){
          const control=document.createElement('div');control.className='smart-list-control';control.id=id;
          const button=document.createElement('button');button.className='smart-list-item';button.textContent=label;button.onclick=()=>button.classList.add('selected');control.append(button);fly.append(control);
        }
        role.querySelector('.koSingleselect-dropDownItem').onclick=()=>role.querySelector('.koSingleselect-selectedItem-value').textContent='Paramedic';
        if(mode==='norole')role.remove();
        if(mode==='badtime')form.querySelector('[id="29337Time"]').value='12:01:00';
        if(mode==='midnight') {
          form.querySelector('[id="29337Time"]').value='00:01:00';
          form.querySelector('[id="29336Date"]').value='09/08/2026';
          form.querySelector('[id="29336Time"]').value='23:50:00';
        }
        function detail(){details.push({role:role.textContent,date:fly.querySelector('input[id$="25443Date"]').value,time:fly.querySelector('input[id$="25443Time"]').value});}
        if(mode==='populated')value.textContent='Existing procedure';
        for (const name of api.PROCEDURE_NAMES) {
          if(mode==='missing' && name===api.PROCEDURE_NAMES[0])continue;
          for(let i=0;i<(mode==='duplicate'?2:1);i++){
            const opt=document.createElement('div');
            opt.className='koSingleselect-dropDownItem';opt.textContent=name;
            opt.onclick=()=>{value.textContent=name;field.querySelector('.options').style.display='none';};
            field.querySelector('.options').append(opt);
          }
        }
        field.querySelector('button').onclick=()=>field.querySelector('.options').style.display='block';
        if(mode==='search') {
          field.querySelector('.options').innerHTML='';
          const search=document.createElement('input');
          search.className='koSingleselect-searchbar-input';
          search.oninput=()=>{
            const opt=document.createElement('div');
            opt.className='koSingleselect-dropDownItem';opt.textContent=search.value;
            opt.onclick=()=>{value.textContent=opt.textContent;};
            field.querySelector('.options').replaceChildren(opt);
          };
          field.append(search);
        }
        const buttons=form.querySelectorAll('button.grid-button');
        if(mode==='disabled')buttons[0].classList.add('disabled');
        buttons[0].onclick=()=>{detail();commits.push(value.textContent);if(mode!=='noadvance')entry();};
        buttons[1].onclick=()=>{detail();commits.push(value.textContent);form.innerHTML='';};
      }
      entry();
      if(mode==='repair') {
        document.querySelector('[id="02dffd5f-4c68-506b-881d-5b00c78090aa"] .koSingleselect-selectedItem-value').textContent='Moving a patient to a stretcher';
        const plan=api.buildPlan().filter(i=>i.rule.mode==='procedureTime'||i.rule.mode==='procedureRole');
        if(plan.length!==3 || plan.some(i=>i.status!=='ready'))throw Error('Repair plan missing');
        for(const item of plan)await api.apply(item);
        if(document.querySelector('input[id$="25443Time"]').value!=='12:08:00' || document.querySelector('[id="d0c37cfb-ac96-5c0e-9eb6-d21aeb3f57d7"] .koSingleselect-selectedItem-value').textContent!=='Paramedic')throw Error('Repair failed');
        results.push({mode,error:'',commits:[],details:[]});continue;
      }
      if(mode==='retry')sessionStorage.setItem('it-a15-create:'+location.href+':'+api.PROCEDURE_NAMES.join('|'),'started');
      let error='';
      try {await api.addProcedureBundle(()=>{});} catch(e){error=e.message;}
      results.push({mode,error,commits,details});
    }
    return results;
  },code);
  for(const result of results){ console.log(result.mode,result.error);
    const success=['success','search','midnight'].includes(result.mode);
    assert.equal(!result.error,success||result.mode==='repair',result.mode);
    assert.equal(result.commits.length,success?4:result.mode==='noadvance'?1:0,result.mode);
    if(success)assert.deepEqual(result.commits,['Assessment -ALS','Neurological assessment','Adult pain assessment','Moving a patient to a stretcher']);
    if(success) {
      assert.ok(result.details.every(d=>!d.role.includes('Critical')));
      assert.ok(result.details.slice(0,3).every(d=>d.time===(result.mode==='midnight'?'23:50:00':'12:00:00')));
      assert.ok(result.details.slice(0,3).every(d=>d.date===(result.mode==='midnight'?'09/08/2026':'09/09/2026')));
      assert.equal(result.details[3].time,result.mode==='midnight'?'23:59:00':'12:08:00');
      assert.equal(result.details[3].date,result.mode==='midnight'?'09/08/2026':'09/09/2026');
    }
    console.log('PASS',result.mode,result.error);
  }
  await browser.close();
})().catch(e=>{console.error(e);process.exit(1);});



