import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {once} from 'node:events';
import {SqliteStore} from '../src/store.js';
import {Service,keyFor} from '../src/service.js';
import {LocalAuth} from '../src/auth.js';
import {AdminService} from '../src/admin.js';
import {AccountDeletion} from '../src/account-deletion.js';
import {createApp} from '../src/app.js';

test('删除账号：后台确认、权限、版本、关联清理、历史保留和事务回滚',async t=>{
 const store=new SqliteStore(':memory:');let now=Date.now();const core=new Service(store,()=>now),auth=new LocalAuth(store),admin=new AdminService(core),deletion=new AccountDeletion(admin),password=randomUUID();
 const actor=await auth.createUser('delete_admin',password,'模拟管理员','admin'),secondAdmin=await auth.createUser('other_admin',password,'另一个管理员','admin'),teacher=await auth.createUser('delete_teacher',password,'模拟教师','teacher'),otherTeacher=await auth.createUser('keep_teacher',password,'保留教师','teacher'),student=await auth.createUser('delete_student',password,'模拟学生','student');
 const c=core.createClass(teacher,'模拟保留班级');core.join(student,c.joinCode!);store.put('class_teacher',keyFor(c.id,otherTeacher.id),{classId:c.id,teacherId:otherTeacher.id});
 const oldToken=(await auth.login({username:'delete_student',password})).accessToken;
 const confirm=(p:ReturnType<typeof deletion.preview>)=>({planId:p.planId,expectedVersion:p.account.version,confirmUsername:p.account.username});
 try{
 await t.test('预览不会删除，禁止普通师生与管理员自身删除，必须二次确认',()=>{
  assert.throws(()=>deletion.preview(teacher,student.id),/仅管理员/);assert.throws(()=>deletion.preview(actor,actor.id),/不能删除管理员/);
  const p=deletion.preview(actor,student.id);assert.equal(p.enrollments,1);assert.ok(store.get('account','delete_student'));
  assert.throws(()=>deletion.remove(actor,student.id,{expectedVersion:0}));assert.throws(()=>deletion.remove(actor,student.id,{...confirm(p),confirmUsername:'wrong'}));
  assert.throws(()=>deletion.remove(secondAdmin,student.id,confirm(p)),/确认已失效/);assert.ok(store.get('account','delete_student'));
 });
 await t.test('预览过期或账号版本变化后需重新核对',()=>{
  const p=deletion.preview(actor,student.id);now+=6*60000;assert.throws(()=>deletion.remove(actor,student.id,confirm(p)),/确认已失效/);
  const fresh=deletion.preview(actor,student.id);admin.update(actor,student.id,{displayName:'模拟学生更名',disabled:false,expectedVersion:0});assert.throws(()=>deletion.remove(actor,student.id,confirm(fresh)));assert.ok(store.get('account','delete_student'));
 });
 await t.test('AI正在生成时不删除，事务故障不会留下半删状态',()=>{
  store.put('ai_thread','busy-thread',{id:'busy-thread',ownerId:student.id});store.put('ai_turn','busy-turn',{id:'busy-turn',threadId:'busy-thread',outcome:'pending'});
  assert.throws(()=>deletion.preview(actor,student.id),/正在生成/);store.remove('ai_turn','busy-turn');
  const p=deletion.preview(actor,student.id),remove=store.remove.bind(store);store.remove=(kind,id)=>{if(kind==='user'&&id===student.id)throw new Error('injected transaction failure');remove(kind,id)};
  try{assert.throws(()=>deletion.remove(actor,student.id,confirm(p)),/injected/);}finally{store.remove=remove;}
  assert.ok(store.get('account','delete_student'));assert.ok(store.get('member',keyFor(c.id,student.id)));assert.ok(store.get('account_delete_plan',p.planId));assert.ok(auth.authenticate(oldToken));
 });
 await t.test('学生删除撤销旧登录，清理身份和成员，保留历史答卷/对话/班级',async()=>{
  store.put('student_identity','delete_student',{userId:student.id,studentNumber:'delete_student',displayName:'模拟学生'});
  store.put('survey_response','historical-answer',{id:'historical-answer',studentId:student.id,answers:{q:'历史模拟答案'}});
  const p=deletion.preview(actor,student.id);assert.equal(p.retainedResponses,1);assert.equal(p.retainedConversations,1);assert.equal(deletion.remove(actor,student.id,confirm(p)).deleted,true);
  assert.equal(store.get('account','delete_student'),undefined);assert.equal(store.get('user',student.id),undefined);assert.equal(store.get('member',keyFor(c.id,student.id)),undefined);assert.equal(store.get('student_identity','delete_student'),undefined);
  assert.throws(()=>auth.authenticate(oldToken));await assert.rejects(()=>auth.login({username:'delete_student',password}));assert.ok(store.get('survey_response','historical-answer'));assert.ok(store.get('ai_thread','busy-thread'));assert.ok(store.get('class',c.id));
  const recreated=await auth.createUser('delete_student',password,'重新创建的测试账号','student');assert.notEqual(recreated.id,student.id);assert.equal(core.classes(recreated).length,0);
 });
 await t.test('删除教师只解除其任课关系，保留其他教师与全部班级',()=>{
  const p=deletion.preview(actor,teacher.id);deletion.remove(actor,teacher.id,confirm(p));
  assert.equal(store.get<{teacherId:string}>('class',c.id)?.teacherId,otherTeacher.id);assert.equal(store.get('class_teacher',keyFor(c.id,teacher.id)),undefined);assert.ok(core.classAccess(otherTeacher,c.id));
  assert.ok(store.all<{action:string}>('admin_audit').some(a=>a.action==='delete_account'));
 });
 }finally{store.close();}
});

test('真实HTTP删除需要管理员预览计划与确认体，不能单步调用',async()=>{
 const store=new SqliteStore(':memory:'),core=new Service(store),auth=new LocalAuth(store),password=randomUUID();await auth.createUser('http_delete_admin',password,'模拟管理员','admin');const student=await auth.createUser('http_delete_student',password,'模拟学生','student');
 const token=(await auth.login({username:'http_delete_admin',password})).accessToken,studentToken=(await auth.login({username:'http_delete_student',password})).accessToken;
 const server=createApp(core,auth).listen(0,'127.0.0.1');await once(server,'listening');const base=`http://127.0.0.1:${(server.address() as {port:number}).port}/api/v1/admin/users/${student.id}`;
 const request=(path:string,method:string,body:unknown,bearer=token)=>fetch(base+path,{method,headers:{Authorization:'Bearer '+bearer,'Content-Type':'application/json'},body:JSON.stringify(body)});
 try{
  assert.equal((await request('/delete-preview','POST',{},studentToken)).status,403);assert.equal((await request('','DELETE',{})).status,400);
  const p=(await(await request('/delete-preview','POST',{})).json()).data;assert.ok(store.get('account','http_delete_student'));
  assert.equal((await request('','DELETE',{planId:p.planId,expectedVersion:p.account.version,confirmUsername:p.account.username})).status,200);assert.equal(store.get('account','http_delete_student'),undefined);
 }finally{server.close();server.closeAllConnections();await once(server,'close');store.close();}
});
