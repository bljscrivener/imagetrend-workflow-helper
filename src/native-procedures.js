  // A15 procedure module -----------------------------------------------------
  // Owns the semantic identity of A15-created procedure rows.  It is
  // deliberately planning/verification-only: mutation remains behind the
  // existing reviewed A15 execution path and compatibility/safety guards.
  const GremlinLogicA15ProcedureModule=(()=>{
    const VERSION='procedure-module/1';
    const DEFINITIONS=Object.freeze([
      Object.freeze({key:'assessment_als',display:'Assessment -ALS',kind:'assessment',timing:'patient-contact'}),
      Object.freeze({key:'assessment_neuro',display:'Neurological assessment',kind:'assessment',timing:'patient-contact'}),
      Object.freeze({key:'assessment_pain',display:'Adult pain assessment',kind:'assessment',timing:'patient-contact'}),
      Object.freeze({key:'move_to_stretcher',display:'Moving a patient to a stretcher',kind:'procedure',timing:'patient-contact'})
    ]);

    const canonical=value=>String(value??'')
      .normalize('NFKC')
      .replace(/[\u200B-\u200D\uFEFF]/g,'')
      .replace(/\s+/g,' ')
      .replace(/\s*-\s*/g,'-')
      .trim()
      .toLowerCase();

    const byCanonical=new Map(DEFINITIONS.map(def=>[canonical(def.display),def]));
    const byKey=new Map(DEFINITIONS.map(def=>[def.key,def]));

    function hash(text){
      let h=0x811c9dc5;
      for(let i=0;i<text.length;i++){
        h^=text.charCodeAt(i);
        h=Math.imul(h,0x01000193)>>>0;
      }
      return h.toString(16).padStart(8,'0');
    }

    function fingerprint(extra=''){
      const semantic=DEFINITIONS.map(d=>`${d.key}|${canonical(d.display)}|${d.kind}|${d.timing}`).join('\n');
      return hash(`${VERSION}\n${semantic}\n${String(extra||'')}`);
    }

    function definition(value){
      if(value&&typeof value==='object'&&value.key)return byKey.get(value.key)||null;
      return byKey.get(String(value))||byCanonical.get(canonical(value))||null;
    }

    function mapEntry(entry,{ko=window.ko,agencyResources=window.imagetrend?.formComposer?.agencyResources}={}){
      if(!entry)throw Error('Procedure entry unavailable.');
      const unwrap=x=>ko?.unwrap?ko.unwrap(x):(typeof x==='function'?x():x);
      const answer=unwrap(entry.PatientProcedureProcedurePerformedModValue);
      const code=unwrap(answer?.PlusOneCode)||unwrap(answer?.ProcedurePerformed);
      if(code==null||code==='')throw Error('Procedure code is blank.');
      const candidates=[...new Set(Object.values(agencyResources||{}).flatMap(resource=>(resource?.Elements||[])
        .filter(element=>String(element.Id)===String(code))
        .map(element=>canonical(element.Value))))];
      if(!candidates.length)throw Error('Procedure code has no loaded display mapping. Open its entry and preview again.');
      if(candidates.length!==1)throw Error('Procedure code has conflicting display mappings.');
      return byCanonical.get(candidates[0])||null;
    }

    function inspect(entries,options={}){
      if(!Array.isArray(entries))throw Error('Procedure collection unavailable.');
      const seen=new Map();
      const unknown=[];
      entries.forEach((entry,index)=>{
        const def=mapEntry(entry,options);
        if(!def){unknown.push({index,entry});return;}
        const prior=seen.get(def.key)||[];
        prior.push({index,entry});
        seen.set(def.key,prior);
      });
      const duplicates=[...seen.entries()].filter(([,rows])=>rows.length>1).map(([key,rows])=>({definition:byKey.get(key),rows}));
      const present=[...seen.keys()].map(key=>byKey.get(key));
      const missing=DEFINITIONS.filter(def=>!seen.has(def.key));
      return Object.freeze({present:Object.freeze(present),missing:Object.freeze(missing),duplicates:Object.freeze(duplicates),unknown:Object.freeze(unknown)});
    }

    function plan(entries,options={}){
      const state=inspect(entries,options);
      // Unknown procedure rows are an identity ambiguity.  We do not infer that
      // a known A15 row is missing until every existing row can be classified.
      const blocked=state.unknown.length>0||state.duplicates.length>0;
      return Object.freeze({
        version:VERSION,
        fingerprint:fingerprint(),
        blocked,
        reason:state.unknown.length?'unknown-procedure-identity':state.duplicates.length?'duplicate-a15-procedure':null,
        create:blocked?Object.freeze([]):state.missing,
        state
      });
    }

    function verify(entries,expectedKeys=DEFINITIONS.map(d=>d.key),options={}){
      const state=inspect(entries,options);
      if(state.unknown.length)throw Error('Procedure verification blocked by unknown procedure identity.');
      if(state.duplicates.length)throw Error('Procedure verification failed: duplicate A15 procedure row.');
      const present=new Set(state.present.map(d=>d.key));
      const missing=expectedKeys.map(key=>byKey.get(key)).filter(Boolean).filter(def=>!present.has(def.key));
      if(missing.length)throw Error(`Procedure verification failed: ${missing.map(d=>d.display).join(', ')}`);
      return true;
    }

    return Object.freeze({version:VERSION,definitions:DEFINITIONS,canonical,definition,fingerprint,mapEntry,inspect,plan,verify});
  })();
  window.GremlinLogicA15ProcedureModule=GremlinLogicA15ProcedureModule;
