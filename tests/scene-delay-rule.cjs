const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('src/native-core.js','utf8');
const start=source.indexOf('  function delayChoices(){'),end=source.indexOf('  // Capture only model data.',start);
const ctx={times:{},delays:[['response','Response'],['scene','Scene'],['transport','Transport'],['destination','Destination']],missingTimes:()=> 'missing'};
vm.createContext(ctx);vm.runInContext(source.slice(start,end),ctx);
for(const [seconds,target] of [[0,'None/No Delay'],[1199,'None/No Delay'],[1200,'None/No Delay'],[1201,'Staff Delay'],[3600,'Staff Delay']]){
 ctx.times={'29335':100000,'29337':100000+seconds*1000};assert.equal(ctx.delayChoices().find(x=>x.id==='scene').target,target);
}
for(const times of [{},{'29335':100000},{'29335':100000,'29337':0}]){ctx.times=times;const result=ctx.delayChoices().find(x=>x.id==='scene');assert.ok(result.problem);assert.equal(result.target,undefined);}
console.log('PASS scene threshold: zero, below/exactly/above 20 minutes, missing and negative intervals');
