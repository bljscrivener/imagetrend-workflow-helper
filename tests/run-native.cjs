const {spawnSync}=require('node:child_process');
for(const file of ['native-direct-go.cjs','native-batch.cjs','native-assessment.cjs','native-procedure-workflow.cjs','native-reliability.cjs']){
 const result=spawnSync(process.execPath,['tests/'+file],{stdio:'inherit',timeout:120000});
 if(result.status!==0)process.exit(result.status||1);
}
