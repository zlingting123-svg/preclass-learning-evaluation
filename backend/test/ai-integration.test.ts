import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { SqliteStore } from '../src/store.js';
import { Service, keyFor } from '../src/service.js';
import { LocalAuth } from '../src/auth.js';
import { LearningService } from '../src/learning.js';
import { createApp } from '../src/app.js';
import { createCourseAi } from '../src/ai.js';

test('AI接入现有会话、班级、发布资料、SSE和仅元数据统计', async t => {
  const store = new SqliteStore(':memory:'), core = new Service(store), auth = new LocalAuth(store);
  const teacherPassword=randomUUID();
  const teacher = await auth.createUser('ai_teacher', teacherPassword, '模拟教师', 'teacher');
  const password = randomUUID(), student = await auth.createUser('ai_student', password, '模拟学生', 'student');
  const outside = await auth.createUser('ai_outside', password, '其他学生', 'student');
  const c = core.createClass(teacher, '模拟AI班级'), other = core.createClass(teacher, '其他班');
  core.join(student, c.joinCode!);
  const learning = new LearningService(core);
  const material = learning.saveMaterial(teacher, c.id, {title:'模拟环境资料', content:'环境评价需要依据课程资料说明项目影响。', expectedVersion:0});
  const hidden = learning.saveMaterial(teacher, other.id, {title:'其他班私密资料', content:'环境评价其他班内容', expectedVersion:0});
  learning.publishMaterial(teacher, hidden.id, hidden.version);
  const ai = createCourseAi(core, auth, {ledgerPath:':memory:',fingerprintKey:'x'.repeat(64),configPath:resolve('../ai-module/config/mock.example.json'),policy:{dailyRequests:1000},delayMs:50});
  const server = createApp(core, auth, ai).listen(0,'127.0.0.1'); await once(server,'listening');
  const base = `http://127.0.0.1:${(server.address() as {port:number}).port}/api/v1`;
  const studentSession = await auth.login({username:'ai_student',password}), outsideSession=await auth.login({username:'ai_outside',password});
  const teacherSession=await auth.login({username:'ai_teacher',password:teacherPassword});
  const admin=await auth.createUser('ai_admin',password,'模拟管理员','admin');
  const adminSession=await auth.login({username:'ai_admin',password});
  assert.equal(adminSession.user.id,admin.id);
  const call = (path:string, token:string, body?:unknown) => fetch(base+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
  const ask=(question:string,id=randomUUID(),token=studentSession.accessToken,classId=c.id)=>call('/core/ai/chat/stream',token,{classId,question,clientRequestId:id});
  try {
    await t.test('未登录、未选班、伪造身份和教师代问被拦截', async()=>{
      assert.equal((await fetch(base+'/core/ai/status')).status,401);
      assert.equal((await ask('环境评价',randomUUID(),outsideSession.accessToken)).status,403);
      assert.equal((await ask('环境评价',randomUUID(),teacherSession.accessToken)).status,403);
      assert.equal((await call('/core/ai/chat/stream',studentSession.accessToken,{classId:c.id,question:'环境评价',clientRequestId:randomUUID(),userId:outside.id})).status,400);
    });
    await t.test('本班草稿及他班已发布资料不能支持回答',async()=>{
      const text=await (await ask('环境评价是什么？')).text();assert.match(text,/event: insufficient_evidence/);assert.doesNotMatch(text,/event: delta/);
      assert.equal(ai.store.summary(student.id).modelCalls,0);
    });
    learning.publishMaterial(teacher, material.id, material.version);
    await t.test('SSE返回已发布来源与模拟回答，重复请求不再次调用',async()=>{
      const id=randomUUID(),text=await(await ask('环境评价是什么？',id)).text();
      for(const e of ['sources','delta','done'])assert.ok(text.includes('event: '+e));
      assert.match(text,/本地替身测试/);assert.ok(text.includes(material.id));assert.ok(!text.includes(hidden.id));
      assert.equal((await ask('环境评价是什么？',id)).status,409);
      assert.equal(ai.store.summary(student.id).modelCalls,1);
    });
    await t.test('超范围拒答不调用模型；JSON旧契约仍可用',async()=>{
      assert.match(await(await ask('推荐游戏装备')).text(),/event: refusal/);assert.equal(ai.store.summary(student.id).modelCalls,1);
      const r=await call('/core/ai/chat',studentSession.accessToken,{classId:c.id,messages:[{role:'user',text:'环境评价的作用'}]});assert.equal(r.status,200);assert.match((await r.json()).data.reply,/本地替身/);
    });
    await t.test('个人用量、教师门槛、跨班权限、管理员权限、账本无正文',async()=>{
      const usage=await(await call('/core/ai/usage',studentSession.accessToken)).json();assert.equal(usage.data.modelCalls,2);assert.equal(usage.data.outputTokens,60);
      const topic=await(await call('/core/ai/topics/'+c.id,teacherSession.accessToken)).json();assert.deepEqual(topic.data.buckets,[]);
      assert.equal((await call('/core/ai/topics/'+c.id,studentSession.accessToken)).status,403);
      assert.equal((await call('/core/ai/admin',studentSession.accessToken)).status,403);
      const managed=await(await call('/core/ai/admin',adminSession.accessToken)).json();assert.equal(managed.data.summary.modelCalls,2);assert.equal(managed.data.accounts[0].capacity,350);assert.equal(managed.data.balances[0].state,'not_configured');
      const metadata=JSON.stringify(ai.store.rows());assert.ok(!metadata.includes('环境评价'));assert.ok(!metadata.includes('本地替身测试'));assert.ok(!metadata.includes(studentSession.accessToken));
      // Removal is checked again for new questions; no client class declaration can bypass it.
      store.remove('member',keyFor(c.id,student.id));assert.equal((await ask('环境评价')).status,403);core.join(student,c.joinCode!);
    });
    await t.test('浏览器断流会取消上游并保留未知用量，不能假称免费',async()=>{
      const abort=new AbortController();
      const response=await fetch(base+'/core/ai/chat/stream',{method:'POST',headers:{Authorization:'Bearer '+studentSession.accessToken,'Content-Type':'application/json'},body:JSON.stringify({classId:c.id,question:'环境评价',clientRequestId:randomUUID()}),signal:abort.signal});
      const reader=response.body!.getReader();await reader.read();abort.abort();await reader.cancel().catch(()=>{});
      for(let i=0;i<40&&!ai.store.rows().some(r=>r.state==='usage_unknown');i++)await new Promise(r=>setTimeout(r,5));
      assert.ok(ai.store.rows().some(r=>r.state==='usage_unknown'&&r.reservedMicros>0));
    });
    await t.test('排队等待期间注销会话会阻止上游调用',async()=>{
      const principal=await ai.gateway.deps.identity.verify(studentSession.accessToken);
      const input={courseId:c.id,question:'环境评价',clientRequestId:randomUUID()};const id=await ai.gateway.prepare(principal,input);
      const take=ai.gateway.scheduler.take.bind(ai.gateway.scheduler);
      ai.gateway.scheduler.take=async(user,signal)=>{const lease=await take(user,signal);auth.logout(studentSession.accessToken);return lease;};
      const events:string[]=[];
      await ai.gateway.answer(principal,input,id,new AbortController().signal,async e=>{events.push(e)});
      assert.ok(events.includes('error'));assert.equal(ai.store.summary(student.id).modelCalls,3);
      assert.equal((await call('/core/ai/usage',studentSession.accessToken)).status,401);
    });
  }finally{server.close();server.closeAllConnections();await once(server,'close');ai.close();store.close();}
});
