import {test} from 'node:test';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {once} from 'node:events';
import {randomUUID} from 'node:crypto';
import {SqliteStore} from '../src/store.js';
import {Service} from '../src/service.js';
import {LocalAuth} from '../src/auth.js';
import {Conversations} from '../src/conversations.js';
import {createCourseAi} from '../src/ai.js';
import {createApp} from '../src/app.js';
import {LearningService} from '../src/learning.js';

test('教师独立问答与账本用途、班级授权、私人对话隔离及长历史保留',async()=>{
 const store=new SqliteStore(':memory:'),core=new Service(store),auth=new LocalAuth(store),password=randomUUID();
 const teacher=await auth.createUser('teacher_chat',password,'模拟教师','teacher'),student=await auth.createUser('student_chat',password,'模拟学生','student'),other=await auth.createUser('other_teacher',password,'其他教师','teacher');
 const c=core.createClass(teacher,'模拟班一'),outside=core.createClass(other,'其他班');core.join(student,c.joinCode!);
 const learning=new LearningService(core),m=learning.saveMaterial(teacher,c.id,{title:'模拟环境资料',content:'环境评价与管理的模拟资料',expectedVersion:0});learning.publishMaterial(teacher,m.id,m.version);
 const ai=createCourseAi(core,auth,{ledgerPath:':memory:',fingerprintKey:'x'.repeat(64),configPath:resolve('../ai-module/config/mock.example.json'),delayMs:0});
 const server=createApp(core,auth,ai).listen(0,'127.0.0.1');await once(server,'listening');
 const base=`http://127.0.0.1:${(server.address() as {port:number}).port}/api/v1`;
 const teacherToken=(await auth.login({username:'teacher_chat',password})).accessToken,studentToken=(await auth.login({username:'student_chat',password})).accessToken;
 const call=(path:string,token=teacherToken,body?:unknown)=>fetch(base+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
 try{
  const thread=(await(await call('/core/ai/threads',teacherToken,{classId:c.id})).json()).data;
  assert.ok(thread.id);
  const r=await call(`/core/ai/threads/${thread.id}/questions`,teacherToken,{question:'环境评价是什么',clientRequestId:randomUUID()});assert.equal(r.status,200);assert.match(await r.text(),/event: done/);
  assert.equal(ai.store.rows()[0].purpose,'teacher_qa');assert.equal(ai.store.rows()[0].subjectId,teacher.id);
  assert.deepEqual(ai.store.topics(c.id,2),[]);
  assert.equal((await call('/core/ai/threads/'+thread.id,studentToken)).status,404);
  assert.equal((await call('/core/ai/threads',teacherToken,{classId:outside.id})).status,403);
  const studentThread=(await(await call('/core/ai/threads',studentToken,{classId:c.id})).json()).data;
  assert.equal((await call('/core/ai/threads/'+studentThread.id)).status,404);
  const chats=new Conversations(core),turn=chats.begin(teacher,thread.id,randomUUID(),'大气污染评价中的高斯方程是什么');
  chats.finish(thread.id,turn.id,'长回答包含公式\n'.repeat(5000),'done',[]);
  const history=chats.context(teacher,thread.id);
  assert.ok(history.some(x=>x.text.includes('高斯方程')));assert.ok(history.at(-1)!.text.length>1000);assert.ok(Buffer.byteLength(JSON.stringify(history))<=24000);
 }finally{server.close();server.closeAllConnections();await once(server,'close');ai.close();store.close();}
});
