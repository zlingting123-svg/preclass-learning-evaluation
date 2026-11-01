import{readFileSync,writeFileSync,mkdirSync,copyFileSync}from'node:fs';import{createHash}from'node:crypto';
const root='work/back-to-top',dest=root+'/dist/assets';mkdirSync(dest,{recursive:true});const get=async p=>{const r=await fetch('http://127.0.0.1:5173'+p);if(!r.ok)throw Error(p);return r.text()},sha=s=>createHash('sha256').update(s).digest('hex');
const html=await get('/'),entryName=html.match(/src="([^"]*main-entry[^" ]+)"/)[1],entry=await get(entryName),mainName=entry.match(/\.\/(main-[\w-]+\.js)/)[1],main=await get('/assets/'+mainName);
if(!main.includes('teacher-workspace-delete.js'))throw Error('Unexpected baseline');
for(const [name,data] of [['index.before.html',html],['entry.before.js',entry],['main.before.js',main]])writeFileSync(root+'/'+name,data);
writeFileSync(root+'/baseline.json',JSON.stringify({entryName,mainName,mainHash:sha(main),indexHash:sha(html)}));
writeFileSync(dest+'/main-entry-back-to-top.js',entry+'\nconst topCss=document.createElement("link");topCss.rel="stylesheet";topCss.href="/assets/back-to-top.css";document.head.appendChild(topCss);import("./back-to-top.js");\n');
copyFileSync(root+'/back-to-top.js',dest+'/back-to-top.js');copyFileSync(root+'/back-to-top.css',dest+'/back-to-top.css');
