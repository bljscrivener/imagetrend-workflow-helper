const {spawnSync}=require('node:child_process');
const files=['choice-adapter.cjs','timeline-cache.cjs','procedure-grid.cjs','procedure-bundle.cjs','cumulative.cjs','gui.cjs','whole-chart.cjs','deferred-choice.cjs','attention.cjs'];
let failed=false;
for(const file of files){
 const result=spawnSync(process.execPath,['tests/'+file],{stdio:'inherit'});
 if(result.status!==0){failed=true;console.error('FAILED',file);}
}
process.exitCode=failed?1:0;
