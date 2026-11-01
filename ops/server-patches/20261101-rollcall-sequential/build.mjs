import{createRequire}from'node:module';import{readFileSync,writeFileSync,mkdirSync}from'node:fs';import{createHash}from'node:crypto';
const require=createRequire('C:/Users/96496/Documents/Codex/2026-10-28/outputs-md/work/deepseek-live-source/preclass-learning-evaluation-ddc55257eccf2aba137f4e38ce3f645393eb54a1/frontend/package.json'),r='work/rollcall-sequential';mkdirSync(r+'/dist/assets',{recursive:true});
const get=async p=>{const response=await fetch('http://127.0.0.1:5173'+p);if(!response.ok)throw Error('Current resource unavailable: '+p);return await response.text()},sha=s=>createHash('sha256').update(s).digest('hex');
const html=await get('/'),entryName=html.match(/src="([^"]*main-entry[^" ]+)"/)[1],entry=await get(entryName),mainName=entry.match(/\.\/(main-[\w-]+\.js)/)[1],main=await get('/assets/'+mainName);if(!main.includes('./attendance-puzzle-b.js'))throw Error('Attendance module changed');const attendance=await get('/assets/attendance-puzzle-b.js');if(sha(attendance)!==sha(readFileSync('work/puzzle-redesign/dist/assets/attendance-puzzle-b.js','utf8')))throw Error('Attendance code changed; inspect current');
writeFileSync(r+'/index.before.html',html);writeFileSync(r+'/entry.before.js',entry);writeFileSync(r+'/main.before.js',main);writeFileSync(r+'/attendance.before.js',attendance);
let s=readFileSync('work/puzzle-redesign/AttendancePanel.puzzle-b.js','utf8').replace(/\r\n/g,'\n').replace("from '../rollcall-custom/RollcallStage.tsx'","from './RollcallStage.tsx'").replace("from './puzzle-b.js'","from '../puzzle-redesign/puzzle-b.js'").replace('/assets/attendance-puzzle-b.css','/assets/attendance-sequential.css');
const at='  const [customCount,setCustomCount]';if(!s.includes(at))throw Error('Count settings changed');s=s.replace(at,"  const rollSequence=i.useRef({skip:false,wake:null});\n"+at);s=s.replace('    pt.current++, F.current = null, Ut([])', '    rollSequence.current.skip=true;rollSequence.current.wake?.();\n    pt.current++, F.current = null, Ut([])');
const a=s.indexOf('      if (!(!O.current || c !== pt.current) && (F.current = null, _t("revealing")'),b=s.indexOf('\n    });\n  }\n  let we =',a);if(a<0||b<a)throw Error('Draw reveal changed');
s=s.slice(0,a)+`      if(!O.current||c!==pt.current)return;
      F.current=null;const control=rollSequence.current;control.skip=false;
      const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
      const pause=ms=>control.skip?Promise.resolve():new Promise(resolve=>{let done=false;const finish=()=>{if(done)return;done=true;clearTimeout(timer);if(control.wake===finish)control.wake=null;resolve()};const timer=setTimeout(finish,ms);control.wake=finish});
      for(let index=0;index<Jt.students.length;index++){
        if(!O.current||c!==pt.current)return;
        if(control.skip){Ut(Jt.students);break}
        _t('revealing');await pause(reduced?120:index===0?4800:3400);
        if(!O.current||c!==pt.current)return;
        if(control.skip){Ut(Jt.students);break}
        Ut(Jt.students.slice(0,index+1));_t('landed');await pause(reduced?40:850);
      }
      if(!O.current||c!==pt.current)return;
      _t('');try{await X()}catch{qt('抽取已完成，记录暂未刷新，请稍后再试。')}`+s.slice(b);
const props='count: Dt, onDraw: qn';if(s.split(props).length!==2)throw Error('Draw props changed');s=s.replace(props,'count: Dt, onDraw: qn, onSkip:()=>{rollSequence.current.skip=true;rollSequence.current.wake?.()}');writeFileSync(r+'/AttendancePanel.sequential.js',s);
await require('esbuild').build({entryPoints:[r+'/AttendancePanel.sequential.js'],outfile:r+'/dist/assets/attendance-sequential.js',bundle:true,format:'esm',platform:'browser',external:['./react-DFdtPfhg.js'],jsxFactory:'React.createElement',jsxFragment:'React.Fragment',minify:true});
writeFileSync(r+'/dist/assets/attendance-sequential.css',await get('/assets/attendance-puzzle-b.css')+'\n'+readFileSync(r+'/sequential.css','utf8'));writeFileSync(r+'/dist/assets/main-rollcall-sequential.js',main.replace('./attendance-puzzle-b.js','./attendance-sequential.js'));writeFileSync(r+'/dist/assets/main-entry-rollcall-sequential.js',entry.replaceAll(mainName,'main-rollcall-sequential.js'));writeFileSync(r+'/baseline.json',JSON.stringify({mainName,entryName,mainHash:sha(main),attendanceHash:sha(attendance)},null,2));console.log('Built one extractor and sequential results; current main preserved:',mainName);
