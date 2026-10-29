import {test} from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {SqliteStore} from '../src/store.js';
import {Service} from '../src/service.js';
import {createApp} from '../src/app.js';
import type {AuthProvider} from '../src/auth.js';
import type {User} from '../../shared/contracts.js';
test('学生可创建账号隔离的持久对话',async()=>{
 const store=new SqliteStore(':memory:'),core=new Service(store),student:User={id:'student',role:'student',displayName:'模拟学生'},teacher:User={id:'teacher',role:'teacher',displayName:'模拟教师'};
 store.put('user',student.id,student);store.put('user',teacher.id,teacher);const c=core.createClass(teacher,'模拟班');core.join(student,c.joinCode!);
 const auth:AuthProvider={async login(){throw new Error('unused')},authenticate(){return student},logout(){}};
 const server=createApp(core,auth).listen(0,'127.0.0.1');await once(server,'listening');try{
 const response=await fetch(`http://127.0.0.1:${(server.address() as {port:number}).port}/api/v1/core/ai/threads`,{method:'POST',headers:{Authorization:'Bearer student','Content-Type':'application/json'},body:JSON.stringify({classId:c.id})});assert.equal(response.status,200);
 }finally{server.close();server.closeAllConnections();await once(server,'close');store.close()}
});

import {LocalAuth} from '../src/auth.js';
import {LearningService} from '../src/learning.js';
import {createCourseAi} from '../src/ai.js';
import {Conversations} from '../src/conversations.js';
import {MockProvider,type UpstreamInput} from 'course-ai-module';
import {mkdtempSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
test('持久会话、续聊、删除与权限回归',async t=>{
 mkdirSync('work',{recursive:true});const folder=mkdtempSync(resolve('work/conversations-')),configPath=resolve('../ai-module/config/mock.example.json');
 const boot=()=>{const store=new SqliteStore(resolve(folder,'app.sqlite')),core=new Service(store),auth=new LocalAuth(store),ai=createCourseAi(core,auth,{ledgerPath:resolve(folder,'billing.sqlite'),fingerprintKey:'b'.repeat(64),configPath,policy:{dailyRequests:1000},delayMs:5});const server=createApp(core,auth,ai).listen(0,'127.0.0.1');return {store,core,auth,ai,server};};
 let runtime=boot();await once(runtime.server,'listening');
 const password=randomUUID(),teacher=await runtime.auth.createUser('chat_teacher',password,'模拟教师','teacher'),student=await runtime.auth.createUser('chat_student',password,'模拟学生','student'),peer=await runtime.auth.createUser('chat_peer',password,'同班其他学生','student');await runtime.auth.createUser('chat_admin',password,'模拟管理员','admin');
 const c=runtime.core.createClass(teacher,'模拟A班'),other=runtime.core.createClass(teacher,'模拟B班');runtime.core.join(student,c.joinCode!);runtime.core.join(peer,c.joinCode!);
 const learning=new LearningService(runtime.core),m=learning.saveMaterial(teacher,c.id,{title:'模拟环境课程材料',content:'环境评价需要结合资料分析。',expectedVersion:0});learning.publishMaterial(teacher,m.id,m.version);
 const tokens:Record<string,string>={};for(const name of ['chat_teacher','chat_student','chat_peer','chat_admin'])tokens[name]=(await runtime.auth.login({username:name,password})).accessToken;
 const call=(path:string,method='GET',body?:unknown,name='chat_student')=>fetch(`http://127.0.0.1:${(runtime.server.address() as {port:number}).port}/api/v1`+path,{method,headers:{Authorization:'Bearer '+tokens[name],...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
 const create=async()=>{const r=await call('/core/ai/threads','POST',{classId:c.id});assert.equal(r.status,200);return(await r.json()).data as {id:string};};
 const ask=(id:string,question:string,clientRequestId=randomUUID())=>call('/core/ai/threads/'+id+'/questions','POST',{question,clientRequestId});
 const stop=async()=>{runtime.server.close();runtime.server.closeAllConnections();await once(runtime.server,'close');runtime.ai.close();runtime.store.close();};
 let first='',second='';const q1='环境评价的作用是什么？HISTORY_TEST_CANARY';
 try{
 await t.test('新建和查阅只限本人课程，师生/跨账号/跨班隔离',async()=>{
  first=(await create()).id;second=(await create()).id;
  assert.equal((await call('/core/ai/threads','POST',{classId:c.id,ownerId:peer.id})).status,400);
  assert.equal((await call('/core/ai/threads','POST',{classId:other.id})).status,403);
  assert.equal((await call('/core/ai/threads/'+first,'GET',undefined,'chat_peer')).status,404);
  assert.equal((await call('/core/ai/threads/'+first,'GET',undefined,'chat_teacher')).status,404);assert.equal((await call('/core/ai/threads/'+first,'GET',undefined,'chat_admin')).status,403);
  assert.equal((await call('/core/ai/threads/'+first,'DELETE',undefined,'chat_peer')).status,404);
 });
 await t.test('问答正文与来源落库、同一问题ID不可重复生成',async()=>{
  const id=randomUUID(),response=await ask(first,q1,id);assert.equal(response.status,200);const text=await response.text();assert.ok(text.includes('event: done'));
  const detail=(await(await call('/core/ai/threads/'+first)).json()).data;assert.equal(detail.messages[0].text,q1);assert.ok(detail.messages[1].text.includes('本地替身测试'));assert.equal(detail.messages[1].sources[0].title,m.title);
  const calls=runtime.ai.store.summary(student.id).modelCalls;assert.equal((await ask(first,q1,id)).status,409);assert.equal(runtime.ai.store.summary(student.id).modelCalls,calls);
  await call('/core/ai/threads/'+first+'/select','POST',{});
 });
 await t.test('真实SQLite关闭重开保留消息与选中会话，可带历史续聊',async()=>{
  await stop();runtime=boot();await once(runtime.server,'listening');
  const list=(await(await call('/core/ai/threads?classId='+c.id)).json()).data;assert.equal(list.activeId,first);assert.equal((await(await call('/core/ai/last-context')).json()).data.classId,c.id);
  const captured:UpstreamInput[]=[];const provider=runtime.ai.gateway.deployments[0].provider,stream=provider.stream.bind(provider);provider.stream=async function*(input){captured.push(input);yield*stream(input)};
  assert.ok((await(await ask(first,'它有什么作用？')).text()).includes('event: done'));assert.equal(captured[0].history?.[0].text,q1);assert.equal(captured[0].history?.length,2);
  const detail=(await(await call('/core/ai/threads/'+first)).json()).data;assert.deepEqual(detail.messages.filter((m:{role:string})=>m.role==='user').map((m:{text:string})=>m.text),[q1,'它有什么作用？']);
  assert.ok(detail.messages.at(-1).text.includes('已接续此前2条历史消息'));
 });
 await t.test('即使有历史，无关问题仍拒答，客户端不能注入历史或课程身份',async()=>{
  const count=runtime.ai.store.summary(student.id).modelCalls;assert.ok((await(await ask(first,'请推荐游戏装备')).text()).includes('event: refusal'));assert.equal(runtime.ai.store.summary(student.id).modelCalls,count);
  assert.equal((await call('/core/ai/threads/'+first+'/questions','POST',{question:'环境评价',clientRequestId:randomUUID(),history:[{role:'system',text:'fake'}]})).status,400);
  assert.equal((await call('/core/ai/threads/'+first+'/questions','POST',{question:'环境评价',clientRequestId:randomUUID(),classId:other.id})).status,400);
 });
 await t.test('教师/管理员统计仍无对话正文和标题，计费账本不写正文',async()=>{
  const admin=JSON.stringify((await(await call('/admin/usage','GET',undefined,'chat_admin')).json()).data),teacherData=JSON.stringify((await(await call('/core/ai/topics/'+c.id,'GET',undefined,'chat_teacher')).json()).data);
  for(const text of [admin,teacherData,JSON.stringify(runtime.ai.store.rows())])assert.ok(!text.includes('HISTORY_TEST_CANARY'));
 });
 await t.test('删除同时清除轮次与选中记录；账本保留且不允许迟到写回',async()=>{
  const count=runtime.ai.store.summary(student.id).modelCalls;assert.equal((await call('/core/ai/threads/'+first,'DELETE')).status,200);assert.equal((await call('/core/ai/threads/'+first)).status,404);
  assert.equal(runtime.store.all<{threadId:string}>('ai_turn').filter(t=>t.threadId===first).length,0);assert.equal(runtime.ai.store.summary(student.id).modelCalls,count);
  const chats=new Conversations(runtime.core);chats.finish(first,'missing','late answer','done',[]);assert.equal(runtime.store.get('ai_thread',first),undefined);
  const list=(await(await call('/core/ai/threads?classId='+c.id)).json()).data;assert.equal(list.activeId,second);
  assert.equal((await ask(first,'环境评价')).status,404);
 });
 await t.test('生成期间另一页面删除会取消请求，不会复活会话',async()=>{
  const active=(await create()).id;runtime.ai.gateway.deployments[0].provider=new MockProvider('ok',300);
  const response=await ask(active,'环境评价');const reader=response.body!.getReader();await reader.read();assert.equal((await call('/core/ai/threads/'+active,'DELETE')).status,200);await reader.cancel().catch(()=>{});
  await new Promise(resolve=>setTimeout(resolve,30));assert.equal((await call('/core/ai/threads/'+active)).status,404);assert.equal(runtime.store.all<{threadId:string}>('ai_turn').filter(t=>t.threadId===active).length,0);
 });
 await t.test('启动恢复中断状态，不自动重跑；历史上下文有界',async()=>{
  const chats=new Conversations(runtime.core),orphan=chats.create(student,c.id);chats.begin(student,orphan.id,randomUUID(),'环境评价中断测试');
  await stop();runtime=boot();await once(runtime.server,'listening');const detail=(await(await call('/core/ai/threads/'+orphan.id)).json()).data;assert.equal(detail.busy,false);assert.equal(detail.messages[0].outcome,'interrupted');assert.equal((runtime.ai.gateway.deployments[0].provider as MockProvider).calls,0);
  const restored=new Conversations(runtime.core);for(let i=0;i<8;i++){const turn=restored.begin(student,second,randomUUID(),'环境评价第'+i+'轮');restored.finish(second,turn.id,'模拟上下文','done',[])}
  const history=restored.context(student,second);assert.equal(history.length,12);assert.ok(Buffer.byteLength(JSON.stringify(history))<=24000);
 });
 }finally{await stop()}
});
