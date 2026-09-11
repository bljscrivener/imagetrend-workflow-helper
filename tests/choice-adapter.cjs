const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({headless:true, channel:'msedge'});
  const page = await browser.newPage();
  const src = fs.readFileSync('src/imagetrend-a15-helper.user.js','utf8');
  const code = src.slice(src.indexOf("  const FORM"), src.indexOf("  function nativeSetInput"));
  const results = await page.evaluate(async code => {
    eval(code + '; window.adapter={setChoice,unchanged};');
    const out=[];
    async function run(name, rows, expected, setup='') {
      document.body.innerHTML = '<div id="form-composer"><div class="single-row-control" id="field"><input class="koMultiselect-searchbar-input">' + rows + '</div></div>';
      const c=document.getElementById('field');
      let clicks=0;
      for(const n of c.querySelectorAll('[data-bind^="click:"], [role="option"]')) n.onclick=()=>{clicks++; if(expected==='success') setTimeout(()=>c.insertAdjacentHTML('beforeend','<div class="koMultiselect-selectedItem-value">Stretcher</div>'),30);};
      if(setup==='stale') c.insertAdjacentHTML('beforeend','<div class="koMultiselect-selectedItem-value">Other</div>');
      if(setup==='opening') c.querySelector('input').onclick=()=>c.insertAdjacentHTML('beforeend','<div class="koMultiselect-selectedItem-value">Other</div>');
      let error='';
      try { await adapter.setChoice(c,'Stretcher',[]); } catch(e) {error=e.message;}
      out.push({name,clicks,error});
    }
    const leaf='<span data-bind="text: $parent.getOptionDisplay($data)">Stretcher</span>';
    const row='<div data-bind="click: selectOption"><div>'+leaf+'</div></div>';
    await run('bound ancestor',row,'success');
    await run('generic container','<div>'+leaf+'</div>','blocked');
    await run('duplicate rows',row+row,'blocked');
    await run('disabled ancestor','<div aria-disabled="true">'+row+'</div>','blocked');
    await run('stale review',row,'blocked','stale');
    await run('no confirmation',row,'blocked');
    await run('changed while opening','<div style="display:none">'+row+'</div>','blocked','opening');
    await run('known option','<div role="option">'+leaf+'</div>','success');
    if(!adapter.unchanged([],[]) || adapter.unchanged(['a'],[]) || adapter.unchanged(['a','b'],['a'])) throw Error('snapshot comparison');
    return out;
  },code);
  for(const r of results) {
    const success=['bound ancestor','known option'].includes(r.name);
    assert.equal(r.clicks, success || r.name==='no confirmation' ? 1 : 0, r.name);
    assert.equal(!r.error,success,r.name);
    console.log('PASS',r.name,r.error);
  }
  await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});


