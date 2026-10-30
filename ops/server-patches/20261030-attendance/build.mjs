import {createRequire} from 'node:module';import {copyFileSync,mkdirSync} from 'node:fs';
const require=createRequire('C:/Users/96496/Documents/Codex/2026-10-28/outputs-md/work/deepseek-live-source/preclass-learning-evaluation-ddc55257eccf2aba137f4e38ce3f645393eb54a1/frontend/package.json');
mkdirSync('work/attendance-module/patch',{recursive:true});
await require('esbuild').build({entryPoints:['work/attendance-module/AttendancePanel.tsx'],outfile:'work/attendance-module/patch/attendance-20261030.js',bundle:true,format:'esm',platform:'browser',external:['./react-DFdtPfhg.js'],jsxFactory:'React.createElement',jsxFragment:'React.Fragment',minify:true});
copyFileSync('work/attendance-module/attendance.css','work/attendance-module/patch/attendance-20261030.css');
console.log('Built isolated real attendance component using existing React and theme tokens');
