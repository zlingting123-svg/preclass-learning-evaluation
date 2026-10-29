import {test} from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {randomUUID} from 'node:crypto';
import {SqliteStore} from '../src/store.js';
import {Service} from '../src/service.js';
import {LocalAuth} from '../src/auth.js';
import {createApp} from '../src/app.js';
import {AdminService} from '../src/admin.js';
import {AccountDeletion} from '../src/account-deletion.js';
import {QuestionnaireService} from '../src/questionnaires.js';

test('个人中心隐私、真实姓名保护、头像校验、版本、改密与删除清理',async()=>{
 const store=new SqliteStore(':memory:'),core=new Service(store),auth=new LocalAuth(store),password=randomUUID();
 const student=await auth.createUser('0010123',password,'模拟真实学生','student'),teacher=await auth.createUser('personal_teacher',password,'模拟教师','teacher'),admin=await auth.createUser('personal_admin',password,'模拟管理员','admin');
 store.put('student_identity','0010123',{userId:student.id,studentNumber:'0010123',displayName:student.displayName});const c=core.createClass(teacher,'模拟个人中心班');core.join(student,c.joinCode!);
 const studentToken=(await auth.login({username:'0010123',password})).accessToken,teacherToken=(await auth.login({username:'personal_teacher',password})).accessToken,adminToken=(await auth.login({username:'personal_admin',password})).accessToken;
 const server=createApp(core,auth).listen(0,'127.0.0.1');await once(server,'listening');const base=`http://127.0.0.1:${(server.address() as {port:number}).port}/api/v1`;
 const call=(path:string,token=studentToken,body?:unknown)=>fetch(base+path,{method:body?'PUT':'GET',headers:{Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
 const avatar='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jJ1cAAAAASUVORK5CYII=';
 try{
  assert.equal((await fetch(base+'/account/profile')).status,401);
  const first=(await(await call('/account/profile')).json()).data;assert.equal(first.realName,'模拟真实学生');assert.equal(first.studentNumber,'0010123');assert.equal(first.version,0);
  const update={nickname:'ONLY_ME_ALIAS_TEST',avatarDataUrl:avatar,expectedVersion:0};assert.equal((await call('/account/profile',studentToken,update)).status,200);
  assert.equal((await call('/account/profile',studentToken,{...update,realName:'伪造姓名',expectedVersion:1})).status,400);assert.equal((await call('/account/profile',studentToken,{...update,userId:teacher.id,expectedVersion:1})).status,400);
  assert.equal((await call('/account/profile',studentToken,update)).status,409);assert.equal((await call('/account/profile',studentToken,{...update,avatarDataUrl:'data:image/svg+xml;base64,PHN2Zz4=',expectedVersion:1})).status,400);
  assert.equal((await call('/account/profile',studentToken,{...update,avatarDataUrl:'https://external.example/avatar.png',expectedVersion:1})).status,400);
  const teacherPrivate=(await(await call('/account/profile',teacherToken)).json()).data;assert.equal(teacherPrivate.nickname,'');assert.equal(teacherPrivate.realName,teacher.displayName);assert.equal((await call('/account/profile/'+student.id,teacherToken)).status,404);
  const roster=(await(await call('/core/classes/'+c.id+'/members',teacherToken)).json()).data;assert.equal(roster[0].studentNumber,'0010123');assert.equal(roster[0].studentName,student.displayName);assert.ok(!JSON.stringify(roster).includes(update.nickname));
  const users=(await(await call('/admin/users',adminToken)).json()).data;assert.ok(!JSON.stringify(users).includes(update.nickname));assert.ok(!JSON.stringify(users).includes(avatar));
  const surveys=new QuestionnaireService(core),s=surveys.save(teacher,{classId:c.id,title:'模拟问卷',questions:[{id:'q',title:'模拟题',type:'text',required:false,options:[]}],deadlineAt:null,durationMinutes:null,expectedVersion:0});surveys.transition(teacher,s.id,s.version,'publish');surveys.start(student,s.id);surveys.submit(student,s.id,{q:'模拟回答'});assert.equal(surveys.stats(teacher,s.id).students[0].studentName,student.displayName);assert.ok(!JSON.stringify(surveys.stats(teacher,s.id)).includes(update.nickname));
  const next=randomUUID();assert.equal((await call('/auth/password',studentToken,{currentPassword:'incorrect',newPassword:next})).status,400);assert.equal((await call('/auth/password',studentToken,{currentPassword:password,newPassword:next})).status,200);assert.equal((await call('/account/profile')).status,401);
  const newToken=(await auth.login({username:'0010123',password:next})).accessToken;const retained=(await(await call('/account/profile',newToken)).json()).data;assert.equal(retained.nickname,update.nickname);assert.equal(retained.avatarDataUrl,avatar);assert.equal(retained.realName,student.displayName);
  const deletion=new AccountDeletion(new AdminService(core)),preview=deletion.preview(admin,student.id);deletion.remove(admin,student.id,{planId:preview.planId,expectedVersion:preview.account.version,confirmUsername:preview.account.username});assert.equal(store.get('personal_profile',student.id),undefined);
 }finally{server.close();server.closeAllConnections();await once(server,'close');store.close();}
});
