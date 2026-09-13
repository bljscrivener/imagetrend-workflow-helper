const fs=require('node:fs');
const assert=require('node:assert/strict');
const vm=require('node:vm');

const source=fs.readFileSync('src/native-procedures.js','utf8');
const context={window:{}};
vm.createContext(context);
vm.runInContext(`(()=>{${source}})()`,context);
const mod=context.window.GremlinLogicA15ProcedureModule;
assert.ok(mod,'procedure module exported');
assert.equal(mod.version,'procedure-module/1');
assert.deepEqual(Array.from(mod.definitions,d=>d.key),['assessment_als','assessment_neuro','assessment_pain','move_to_stretcher']);
assert.equal(mod.definition('Assessment - ALS').key,'assessment_als');
assert.equal(mod.definition('neurological assessment').key,'assessment_neuro');
assert.equal(mod.definition('Adult   pain assessment').key,'assessment_pain');
assert.match(mod.fingerprint(),/^[0-9a-f]{8}$/);
assert.equal(mod.fingerprint(),mod.fingerprint(),'fingerprint deterministic');
assert.notEqual(mod.fingerprint('x'),mod.fingerprint('y'),'fingerprint responds to external signature');

const resources={procedures:{Elements:[
  {Id:'1',Value:'Assessment -ALS'},
  {Id:'2',Value:'Neurological assessment'},
  {Id:'3',Value:'Adult pain assessment'},
  {Id:'4',Value:'Moving a patient to a stretcher'},
  {Id:'9',Value:'Other procedure'}
]}};
const ko={unwrap:x=>typeof x==='function'?x():x};
const row=code=>({PatientProcedureProcedurePerformedModValue:{PlusOneCode:code}});
let plan=mod.plan([row('1'),row('2')],{ko,agencyResources:resources});
assert.equal(plan.blocked,false);
assert.deepEqual(Array.from(plan.create,d=>d.key),['assessment_pain','move_to_stretcher']);

plan=mod.plan([row('1'),row('9')],{ko,agencyResources:resources});
assert.equal(plan.blocked,true);
assert.equal(plan.reason,'unknown-procedure-identity');
assert.equal(plan.create.length,0,'identity ambiguity fails closed');

plan=mod.plan([row('1'),row('1')],{ko,agencyResources:resources});
assert.equal(plan.blocked,true);
assert.equal(plan.reason,'duplicate-a15-procedure');
assert.equal(plan.create.length,0,'duplicates fail closed');

assert.equal(mod.verify([row('1'),row('2'),row('3'),row('4')],undefined,{ko,agencyResources:resources}),true);
assert.throws(()=>mod.verify([row('1'),row('2')],undefined,{ko,agencyResources:resources}),/verification failed/i);
console.log('PASS procedure module: ALS, neuro, pain, stretcher identity; deterministic fingerprint; fail-closed planning');
