const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const core=fs.readFileSync(path.join(root,'src/native-core.js'),'utf8');
const peripherals=fs.readFileSync(path.join(root,'src/native-peripherals.js'),'utf8');
if(!core.trimEnd().endsWith('})();'))throw Error('Core wrapper missing');
const output=core.trimEnd().slice(0,-5)+peripherals+'\n})();\n';
fs.writeFileSync(path.join(root,'src/imagetrend-a15-native-test.user.js'),output);
console.log('Built native userscript from core and peripherals');
