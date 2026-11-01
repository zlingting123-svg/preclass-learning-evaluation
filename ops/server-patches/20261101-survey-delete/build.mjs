import{createRequire}from'node:module';import{readFileSync,writeFileSync,mkdirSync}from'node:fs';import{createHash}from'node:crypto';
const r='work/survey-delete',require=createRequire('C:/Users/96496/Documents/Codex/2026-10-28/outputs-md/work/deepseek-live-source/preclass-learning-evaluation-ddc55257eccf2aba137f4e38ce3f645393eb54a1/frontend/package.json');mkdirSync(r+'/dist/assets',{recursive:true});
const get=async p=>{const r=await fetch('http://127.0.0.1:5173'+p);if(!r.ok)throw Error(p);return r.text()},sha=s=>createHash('sha256').update(s).digest('hex');
const html=await get('/'),entryName=html.match(/src="([^"]*main-entry[^" ]+)"/)[1],entry=await get(entryName),mainName=entry.match(/\.\/(main-[\w-]+\.js)/)[1],main=await get('/assets/'+mainName),oldBundle=await get('/assets/teacher-workspace-analysis-entry.js');
if(oldBundle!==readFileSync('work/survey-analysis-entry/dist/assets/teacher-workspace-analysis-entry.js','utf8')||main.split('./teacher-workspace-analysis-entry.js').length!==2)throw Error('The current teacher workspace differs from the baseline');
writeFileSync(r+'/index.before.html',html);writeFileSync(r+'/entry.before.js',entry);writeFileSync(r+'/main.before.js',main);writeFileSync(r+'/baseline.json',JSON.stringify({entryName,mainName,mainHash:sha(main),indexHash:sha(html),teacherHash:sha(oldBundle)}));
writeFileSync(r+'/dist/assets/main-survey-delete.js',main.replace('./teacher-workspace-analysis-entry.js','./teacher-workspace-delete.js'));
writeFileSync(r+'/dist/assets/main-entry-survey-delete.js',entry.replaceAll(mainName,'main-survey-delete.js')+"\nconst delStyle=document.createElement('link');delStyle.rel='stylesheet';delStyle.href='/assets/survey-delete.css';document.head.appendChild(delStyle);\n");
await require('esbuild').build({entryPoints:[r+'/TeacherDashboard.tsx'],outfile:r+'/dist/assets/teacher-workspace-delete.js',bundle:true,format:'esm',platform:'browser',external:['./react-DFdtPfhg.js'],jsxFactory:'React.createElement',jsxFragment:'React.Fragment',minify:true});

writeFileSync(r+'/dist/assets/survey-delete.css',readFileSync(r+'/delete.css'));
