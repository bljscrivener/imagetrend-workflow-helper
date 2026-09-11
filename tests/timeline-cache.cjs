const fs=require('node:fs');
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 const page=await browser.newPage();
 await page.route('https://pafford.imagetrendelite.com/**',r=>r.fulfill({body:'<html><body></body></html>'}));
 await page.goto('https://pafford.imagetrendelite.com/#/Incident123/Form42');
 const src=fs.readFileSync(process.argv[2]||'src/imagetrend-a15-helper.user.js','utf8');
 const code=src.slice(src.indexOf('  const FORM'),src.indexOf("  const host=document.createElement"));
 const result=await page.evaluate(code=>{
  eval(code+';window.timing={stretcherTime};');
  function mount(){document.body.innerHTML='<div id="timeline"><input id="29337Date" value="09/09/2026"><input id="29337Time" value="12:10:00"><input id="29336Date" value="09/09/2026"><input id="29336Time" value="12:00:00"></div>';}
  function blocked(){try{timing.stretcherTime();return false;}catch(e){return true;}}
  const results={};
  mount();results.outsideForm=timing.stretcherTime(true).time==='12:08:00';
  document.body.innerHTML='';results.afterUnmount=timing.stretcherTime().time==='12:08:00';
  location.hash='/Incident456/Form42';results.otherChart=blocked();
  location.hash='/Incident123/Form42';mount();timing.stretcherTime(true);
  document.querySelector('[id="29337Time"]').dispatchEvent(new Event('input',{bubbles:true}));
  document.body.innerHTML='';results.editInvalidates=blocked();
  mount();timing.stretcherTime(true);document.querySelector('[id="29337Time"]').value='';
  results.blankRejects=blocked();document.body.innerHTML='';results.blankClearsCache=blocked();
  mount();timing.stretcherTime(true);document.body.innerHTML='';
  const now=Date.now;Date.now=()=>now()+16*60000;results.expired=blocked();Date.now=now;
  mount();
  document.body.insertAdjacentHTML('beforeend','<input id="29335Date" value="09/09/2026"><input id="29335Time" value="12:00:00">');
  results.departurePreferred=timing.stretcherTime(true).time==='12:08:00';
  document.querySelector('[id="29337Time"]').value='';
  results.sceneFallback=timing.stretcherTime(true).time==='12:02:00';
  document.body.innerHTML='';results.fallbackRetained=timing.stretcherTime().time==='12:02:00';
  mount();
  document.querySelector('[id="29337Date"]').remove();
  document.querySelector('[id="29337Time"]').remove();
  document.querySelector('[id="29336Date"]').remove();
  document.querySelector('[id="29336Time"]').remove();
  document.body.insertAdjacentHTML('beforeend','<input id="29335Date" value="09/09/2026"><input id="29335Time" value="23:59:00">');
  const rollover=timing.stretcherTime(true);
  results.fallbackMidnight=rollover.date==='09/10/2026'&&rollover.time==='00:01:00';
  document.body.insertAdjacentHTML('beforeend','<input id="29337Date" value="09/09/2026"><input id="29337Time" value="invalid">');
  results.invalidDepartureBlocks=blocked();
  return results;
 },code);
 for(const [name,passed] of Object.entries(result)){assert.equal(passed,true,name);console.log('PASS',name);}
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1);});

