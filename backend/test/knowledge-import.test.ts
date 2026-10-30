import {test} from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {randomUUID} from 'node:crypto';
import {resolve} from 'node:path';
import {SqliteStore} from '../src/store.js';
import {Service} from '../src/service.js';
import {LocalAuth} from '../src/auth.js';
import {createApp} from '../src/app.js';
import {createCourseAi} from '../src/ai.js';

test('导入资料仅管理员审核发布且限定班级，撤回后停止引用',async()=>{
 const store=new SqliteStore(':memory:'), core=new Service(store), auth=new LocalAuth(store), password=randomUUID();
 const teacher=await auth.createUser('knowledge_teacher',password,'教师','teacher');
 const student=await auth.createUser('knowledge_student',password,'学生','student');
 await auth.createUser('knowledge_admin',password,'管理员','admin');
 const cls=core.createClass(teacher,'班级一'), other=core.createClass(teacher,'班级二');core.join(student,cls.joinCode!);
 const ai=createCourseAi(core,auth,{ledgerPath:':memory:',fingerprintKey:'x'.repeat(64),configPath:resolve('../ai-module/config/mock.example.json'),delayMs:1});
 const server=createApp(core,auth,ai).listen(0,'127.0.0.1');await once(server,'listening');
 const base=`http://127.0.0.1:${(server.address() as {port:number}).port}/api/v1`;
 const admin=(await auth.login({username:'knowledge_admin',password})).accessToken, token=(await auth.login({username:'knowledge_student',password})).accessToken;
 const call=(path:string,method:string,body?:unknown,t=admin)=>fetch(base+path,{method,headers:{Authorization:'Bearer '+t,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
 const ask=async()=>await(await call('/core/ai/chat/stream','POST',{classId:cls.id,question:'如何进行生态修复',clientRequestId:randomUUID()},token)).text();
 try{
 const payload={classId:cls.id,title:'生态修复',name:'test.txt',base64:Buffer.from('生态修复需要结合生态环境开展长期监测。').toString('base64')};
 assert.equal((await call('/admin/knowledge','POST',payload,token)).status,403);
 const r=await call('/admin/knowledge','POST',payload);assert.equal(r.status,200);const source=(await r.json()).data;assert.equal(source.state,'draft');
 assert.doesNotMatch(await ask(),/event: sources/);
 assert.equal((await call(`/admin/knowledge/${source.id}/state`,'POST',{state:'published',version:'0'.repeat(64)})).status,409);
 assert.equal((await call(`/admin/knowledge/${source.id}/state`,'POST',{state:'published',version:source.version})).status,200);
 const output=await ask();assert.match(output,/event: sources/);assert.match(output,/生态修复/);assert.match(output,/event: done/);
 const outsider=await call('/core/ai/chat/stream','POST',{classId:other.id,question:'生态修复',clientRequestId:randomUUID()},token);assert.equal(outsider.status,403);
 assert.equal((await call(`/admin/knowledge/${source.id}/state`,'POST',{state:'withdrawn',version:source.version})).status,200);
 assert.doesNotMatch(await ask(),/event: sources/);
 assert.equal((await call('/admin/knowledge','POST',{...payload,name:'test.pdf'})).status,400);
 }finally{server.close();server.closeAllConnections();await once(server,'close');ai.close();store.close()}
});
