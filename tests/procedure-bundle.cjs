const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({channel:'msedge',headless:true});
  const page = await browser.newPage();
  await page.route('https://pafford.imagetrendelite.com/**', route => route.fulfill({body:'<html><body></body></html>',contentType:'text/html'}));
  await page.goto('https://pafford.imagetrendelite.com/#/Incident123/Form42');
  const source = fs.readFileSync(process.argv[2] || 'src/imagetrend-a15-helper.user.js','utf8');
  const code = source.slice(source.indexOf('  const FORM'), source.indexOf("  const host=document.createElement"));
  const results = await page.evaluate(async code => {
    eval(code + ';window.api={addProcedureBundle,PROCEDURE_NAMES};');
    const results=[];
    for (const mode of ['success','search','populated','disabled','missing','duplicate','noadvance','retry']) {
      sessionStorage.clear();
      document.body.innerHTML='<div id="form-composer"></div>';
      let serial=0, commits=[];
      function entry() {
        serial++;
        const form=document.getElementById('form-composer');
        form.innerHTML='<div class="grid-flyout-overlay grid-flyout-active"><div class="grid-label">Procedure</div><button class="grid-button" data-bind="click: function() { imagetrend.formComposer.controlHandlers.grid.addAnotherButtonClickHandler($context) }">Add Another</button><button class="grid-button" data-bind="click: function() { imagetrend.formComposer.controlHandlers.grid.okButtonClickHandler($context) }">OK</button><input id="entry'+serial+'25443Date"><div class="single-row-control" id="02dffd5f-4c68-506b-881d-5b00c78090aa"><div class="koSingleselect-selectedItem-value"></div><button class="koSingleselect-down-button">Open</button><div class="options" style="display:none"></div></div></div>';
        const field=form.querySelector('.single-row-control'), value=field.querySelector('.koSingleselect-selectedItem-value');
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
        buttons[0].onclick=()=>{commits.push(value.textContent);if(mode!=='noadvance')entry();};
        buttons[1].onclick=()=>{commits.push(value.textContent);form.innerHTML='';};
      }
      entry();
      if(mode==='retry')sessionStorage.setItem('it-a15-procedure-bundle:'+location.href,'started');
      let error='';
      try {await api.addProcedureBundle(()=>{});} catch(e){error=e.message;}
      results.push({mode,error,commits});
    }
    return results;
  },code);
  for(const result of results){
    const success=['success','search'].includes(result.mode);
    assert.equal(!result.error,success,result.mode);
    assert.equal(result.commits.length,success?4:result.mode==='noadvance'?1:0,result.mode);
    if(success)assert.deepEqual(result.commits,['Assessment -ALS','Neurological assessment','Adult pain assessment','Moving a patient to a stretcher']);
    console.log('PASS',result.mode,result.error);
  }
  await browser.close();
})().catch(e=>{console.error(e);process.exit(1);});

