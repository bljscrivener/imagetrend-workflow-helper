// ==UserScript==
// @name         ImageTrend Preset Lab (experimental)
// @namespace    local.imagetrend.presetlab
// @version      0.2.0
// @description  Isolated, reviewed native preset field experiment. Two reviewed preset fields from any chart section.
// @match        https://pafford.imagetrendelite.com/Elite/Organizationpafford/Agencypmsmsboliv/EmsRunForm*
// @grant        none
// @run-at       document-idle
// @noframes
// ==/UserScript==

(() => {
  'use strict';
  if(document.getElementById('it-preset-lab'))return;
  const choices=[
    {label:'First EMS Unit on Scene → Yes',id:'72b9a56c-7b33-51b6-ae0f-0fe6a14ce702',path:'Incident.Scene.Response.ResponseFirstEMSUnitOnSceneModValue.FirstEMSUnitOnScene',value:'FirstEMSUnitOnSceneStatus_Yes',multi:false},
    {label:'Additional Response Mode Descriptors → No Lights or Sirens',id:'9c627521-8b03-58e4-b7ee-7d57e7ecd0cc',path:'Incident.Scene.Response.ResponseModes[].ResponseModeResponseModeModValue.ResponseMode',value:'ResponseModeDescriptor_NoLightsOrSirens',multi:true}
  ];
  const host=document.createElement('div');host.id='it-preset-lab';
  host.style.cssText='position:fixed;left:315px;bottom:65px;z-index:2147483646';
  const ui=host.attachShadow({mode:'open'});
  ui.innerHTML='<style>:host{font:14px system-ui;color:#253144}section{background:white;border:2px solid #864ca3;border-radius:12px;padding:16px;width:380px;max-width:85vw;max-height:70vh;overflow:auto;box-shadow:0 8px 24px #0004}button,select{font:inherit;padding:8px;margin:5px 0}select{width:100%}pre{white-space:pre-wrap;font:12px system-ui;background:#f4edf8;padding:9px}label{display:block;margin:10px 0}h3{margin:0}small{display:block;margin:8px 0}button{cursor:pointer}#apply{background:#864ca3;color:white;border:0;border-radius:5px}button:disabled{opacity:.45}[hidden]{display:none!important}</style><button id="launch">Preset Lab</button><section hidden><h3>Preset Lab · experimental 0.2.0</h3><small>Use on your TEST chart. Native field updates may persist immediately. This does not call the preset audit or chart Save.</small><select id="choice"></select><button id="preview">Preview selected values</button><pre id="result">Preview either test field from any chart section. Both test fields are selected by default; no navigation needed.</pre><label><input id="ack" type="checkbox">This is a TEST chart and this displayed value is appropriate.</label><button id="apply" disabled>Apply selected values</button> <button id="hide">Minimize</button></section>';
  document.body.append(host);
  const $=s=>ui.querySelector(s);let reviewed=null,busy=false;
  for(const [i,c] of choices.entries()){const o=document.createElement('option');o.value=i;o.textContent=c.label;$('#choice').append(o);}
  const both=document.createElement('option');both.value='both';both.textContent='Both: First EMS Unit Yes + No Lights or Sirens';$('#choice').prepend(both);$('#choice').value='both';
  const visible=n=>!!n&&n.isConnected&&!!n.getClientRects().length;
  const norm=x=>String(x??'').trim();
  function reset(){reviewed=null;$('#ack').checked=false;$('#apply').disabled=true;}
  function resolve(root,path,ko){let n=root;for(const p of path.split('.')){n=ko.unwrap(n);if(n==null||!(p in Object(n)))throw Error('Native field path unavailable.');n=n[p];}return n;}
  function inspect(choice){
    const app=window.imagetrend,ko=window.ko,c=choice||choices[Number($('#choice').value)];
    if(!app?.runForm?.PresetValueViewModel||!ko?.contextFor)throw Error('Native preset API is unavailable in this userscript context. No changes made.');
    const form=document.querySelector('#form-composer');
    if(!form||!visible(form))throw Error('Open a chart form first.');
    if(form.closest('.locked'))throw Error('Chart is locked.');
    const contexts=[...new Set([form,...form.querySelectorAll('[data-bind]')].map(n=>ko.contextFor(n)).filter(Boolean))];
    if(!contexts.length)throw Error('Chart context unavailable.');
    if(contexts.some(ctx=>app.FormComposer.isReadOnly(ctx)))throw Error('Chart contains a read-only context.');
    const defs=(app.formComposer.agencyPresetValues||[]).flatMap(d=>d.PresetValues||[]).filter(d=>d.BindingPathEntryID===c.id&&d.BindingPathFromOrigin===c.path&&d.Value===c.value&&d.ReportingStandardID===app.formComposer.reportingStandardID&&!d.IsNotValue&&!d.IsPertinentNegative);
    if(!defs.length)throw Error('Exact agency preset definition not found for this form version.');
    if(defs.some(d=>!!d.IsMultiselect!==c.multi))throw Error('Preset definition type conflicts.');
    const endpoint=c.multi?c.path.split('[]')[0]:c.path.slice(0,c.path.lastIndexOf('.'));
    const roots=[...new Set(contexts.flatMap(context=>[context.$data,...(context.$parents||[])]))].filter(r=>{try{return resolve(r,endpoint,ko)!=null;}catch(_){return false;}});
    if(roots.length!==1)throw Error('Could not uniquely resolve the native incident context.');
    const root=roots[0],branch=resolve(root,endpoint,ko);
    const snapshot=JSON.stringify(ko.toJS(branch));
    const vm=new app.runForm.PresetValueViewModel({...defs[0]},root);
    const current=norm(ko.unwrap(vm.currentValueDisplay)),target=norm(ko.unwrap(vm.presetValueDisplay));
    if(!target||target===c.value)throw Error('Native preset could not translate the target code to a display value.');
    // The native multiselect writer removes all entries, so only an empty collection is eligible.
    const canApply=!current&&(!c.multi||(Array.isArray(ko.unwrap(branch))&&ko.unwrap(branch).length===0));
    return {c,root,vm,snapshot,current,target,canApply,url:location.href,endpoint};
  }
  $('#launch').onclick=()=>{$('section').hidden=false;$('#launch').hidden=true;};
  $('#hide').onclick=()=>{$('section').hidden=true;$('#launch').hidden=false;};
  $('#choice').onchange=reset;
  $('#preview').onclick=()=>{
    reset();try{
      const selected=$('#choice').value==='both'?choices:[choices[Number($('#choice').value)]];
      reviewed=selected.map(c=>inspect(c));
      $('#result').textContent=reviewed.map(x=>x.c.label+'\nCurrent: '+(x.current||'(blank)')+' → '+x.target+'\n'+(x.canApply?'Ready':x.current===x.target?'Already correct':'Existing answer preserved')).join('\n\n');
    }catch(e){reset();$('#result').textContent=e.message;}
  };
  $('#ack').onchange=()=>{$('#apply').disabled=busy||!$('#ack').checked||!reviewed?.some(x=>x.canApply);};
  $('#apply').onclick=async()=>{
    if(busy||!reviewed?.some(x=>x.canApply)||!$('#ack').checked)return;
    busy=true;$('#apply').disabled=true;$('#preview').disabled=true;$('#choice').disabled=true;
    const results=[];
    try{
      const pending=reviewed.filter(x=>x.canApply);
      const validate=old=>{
        const fresh=inspect(old.c);
        if(fresh.url!==old.url||fresh.root!==old.root||fresh.snapshot!==old.snapshot||fresh.target!==old.target||!fresh.canApply)throw Error('Chart or field changed since preview. Preview again.');
        return fresh;
      };
      pending.forEach(validate);
      for(const old of pending){
        const fresh=validate(old);
        fresh.vm.applyPresetValue();
        let verified=false;
        for(let i=0;i<30;i++){
          if(location.href!==fresh.url||inspect(fresh.c).root!==fresh.root)throw Error('Chart changed after write. Inspect before retrying.');
          fresh.vm.init();
          if(norm(window.ko.unwrap(fresh.vm.currentValueDisplay))===fresh.target){verified=true;break;}
          await new Promise(r=>setTimeout(r,100));
        }
        if(!verified)throw Error('Read-back failed for '+fresh.c.label+'. Inspect before retrying.');
        results.push('Verified: '+fresh.c.label);
      }
      $('#result').textContent=results.join('\n')+'\nVisit the fields to verify their displays. No explicit Save or preset audit called; native persistence may occur.';
    }catch(e){$('#result').textContent=results.join('\n')+'\nStopped: '+e.message+'\nEarlier writes may remain. Preview again after inspecting.';}
    finally{busy=false;reset();$('#preview').disabled=false;$('#choice').disabled=false;}
  };
})();
