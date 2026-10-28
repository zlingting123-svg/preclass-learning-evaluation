import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
const action=process.argv[2]??'usage';const tokens=JSON.parse(readFileSync('work/sample/tokens.json','utf8'));
const paths={usage:['student','/usage/me'],topics:['teacher','/teacher/courses/environment/topics'],accounts:['admin','/admin/provider-accounts'],admin:['admin','/admin/usage']};
if(action==='ask'){
 if(process.stdin.isTTY)throw new Error('问题从标准输入传入，例如 printf "环境评价有什么作用？" | node scripts/client.mjs ask');
 let question='';for await(const chunk of process.stdin){question+=chunk.toString();if(Buffer.byteLength(question)>12000)throw new Error('输入过长')}
 const r=await fetch('http://127.0.0.1:8891/api/ai/v1/questions',{method:'POST',headers:{Authorization:'Bearer '+tokens.student,'Content-Type':'application/json'},body:JSON.stringify({courseId:'environment',question,clientRequestId:randomUUID()})});
 for await(const chunk of r.body)process.stdout.write(chunk);
}else{const [role,path]=paths[action]??[];if(!path)throw new Error('支持ask/usage/topics/accounts/admin');const r=await fetch('http://127.0.0.1:8891/api/ai/v1'+path,{headers:{Authorization:'Bearer '+tokens[role]}});console.log(JSON.stringify(await r.json(),null,2))}
