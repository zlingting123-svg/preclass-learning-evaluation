import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { SqliteStore } from '../src/store.js';
import { LocalAuth } from '../src/auth.js';
import { Service } from '../src/service.js';
import { createApp } from '../src/app.js';
test('管理端只允许真实管理员会话，数据响应不得带密码或会话令牌',async()=>{
 const store=new SqliteStore(':memory:'),auth=new LocalAuth(store),core=new Service(store),password=randomUUID();
 await auth.createUser('admin_test',password,'模拟管理员','admin');
 const session=await auth.login({username:'admin_test',password});
 const server=createApp(core,auth).listen(0,'127.0.0.1');await once(server,'listening');
 try{
  const response=await fetch(`http://127.0.0.1:${(server.address() as {port:number}).port}/api/v1/admin/overview`,{headers:{Authorization:'Bearer '+session.accessToken}});
  assert.equal(response.status,200);
  const data=await response.json();assert.equal(data.data.counts.users,1);assert.ok(!JSON.stringify(data).includes(session.accessToken));assert.ok(!JSON.stringify(data).includes(password));
 }finally{server.close();server.closeAllConnections();await once(server,'close');store.close()}
});

import { resolve } from 'node:path';
import { createCourseAi } from '../src/ai.js';
import type { AdminAccount, ApiSettings } from '../../shared/admin.js';
test('服务管理权限、账户恢复、配置持久化和隐私',async t=>{
 const store=new SqliteStore(':memory:'),auth=new LocalAuth(store),core=new Service(store),password=randomUUID();
 const admin=await auth.createUser('admin_primary',password,'模拟管理员','admin'),student=await auth.createUser('student_primary',password,'模拟学生','student');
 await auth.createUser('teacher_primary',password,'模拟教师','teacher');
 const adminSession=await auth.login({username:'admin_primary',password}),studentSession=await auth.login({username:'student_primary',password}),teacherSession=await auth.login({username:'teacher_primary',password});
 const configPath=resolve('../ai-module/config/mock.example.json'),ai=createCourseAi(core,auth,{ledgerPath:':memory:',fingerprintKey:'a'.repeat(64),configPath});
 const server=createApp(core,auth,ai).listen(0,'127.0.0.1');await once(server,'listening');const base=`http://127.0.0.1:${(server.address() as {port:number}).port}/api/v1`;
 const call=(path:string,method='GET',body?:unknown,token=adminSession.accessToken)=>fetch(base+path,{method,headers:{Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
 async function account(userId:string){return (await(await call('/admin/accounts?limit=100')).json()).data.items.find((a:AdminAccount)=>a.id===userId) as AdminAccount}
 try{
 await t.test('师生不能登录或读取管理接口，管理员能独立登录',async()=>{
  assert.equal((await call('/admin/login','POST',{username:'teacher_primary',password})).status,403);
  for(const path of ['/admin/overview','/admin/accounts','/admin/api','/admin/server','/admin/usage','/admin/audit','/admin/accounts/export'])for(const token of [studentSession.accessToken,teacherSession.accessToken])assert.equal((await call(path,'GET',undefined,token)).status,403);
  assert.equal((await call('/admin/api','PUT',{},teacherSession.accessToken)).status,403);assert.equal((await call('/admin/login','POST',{username:'admin_primary',password})).status,200);
 });
 await t.test('账号查找、分页、创建与审计不泄露口令，无网页管理员提权',async()=>{
  const r=await(await call('/admin/accounts?search=模拟学生')).json();assert.equal(r.data.items[0].username,'student_primary');
  const first=await(await call('/admin/accounts?limit=1')).json(),second=await(await call('/admin/accounts?limit=1&cursor='+encodeURIComponent(first.data.nextCursor))).json();assert.notEqual(first.data.items[0].id,second.data.items[0].id);
  const body=JSON.stringify(r);for(const secret of [password,studentSession.accessToken,'passwordHash','answers'])assert.ok(!body.includes(secret));
  const input={username:'created_account',displayName:'模拟新账户',role:'teacher',password};assert.equal((await call('/admin/accounts','POST',input)).status,200);assert.equal((await call('/admin/accounts','POST',input)).status,409);assert.equal((await call('/admin/accounts','POST',{...input,username:'new_admin',role:'admin'})).status,400);
  const audit=JSON.stringify((await(await call('/admin/audit')).json()).data);assert.ok(audit.includes('account.create'));assert.ok(!audit.includes(password));
 });
 await t.test('停用和改角色撤销旧会话，旧版本拒绝，自锁定与升级管理员拒绝',async()=>{
  let a=await account(student.id);const body={displayName:a.displayName,role:a.role,disabled:true,expectedVersion:a.version};
  assert.equal((await call('/admin/accounts/'+a.id,'PATCH',body)).status,200);assert.equal((await call('/auth/me','GET',undefined,studentSession.accessToken)).status,401);await assert.rejects(()=>auth.login({username:'student_primary',password}));assert.equal((await call('/admin/accounts/'+a.id,'PATCH',body)).status,409);
  a=await account(student.id);assert.equal((await call('/admin/accounts/'+a.id,'PATCH',{displayName:a.displayName,role:'teacher',disabled:false,expectedVersion:a.version})).status,200);assert.equal((await auth.login({username:'student_primary',password})).user.role,'teacher');assert.equal((await call('/auth/me','GET',undefined,studentSession.accessToken)).status,401);
  a=await account(student.id);assert.equal((await call('/admin/accounts/'+a.id,'PATCH',{displayName:a.displayName,role:'admin',disabled:false,expectedVersion:a.version})).status,403);
  a=await account(admin.id);assert.equal((await call('/admin/accounts/'+a.id,'PATCH',{displayName:a.displayName,role:'admin',disabled:true,expectedVersion:a.version})).status,409);
 });
 await t.test('重置口令与主动撤销登录即时生效且不回传新口令',async()=>{
  const login=await auth.login({username:'student_primary',password}),newPassword=randomUUID();let a=await account(student.id);
  const r=await call('/admin/accounts/'+a.id+'/password','POST',{password:newPassword,expectedVersion:a.version});assert.equal(r.status,200);assert.ok(!JSON.stringify(await r.json()).includes(newPassword));await assert.rejects(()=>auth.login({username:'student_primary',password}));assert.equal((await call('/auth/me','GET',undefined,login.accessToken)).status,401);
  const next=await auth.login({username:'student_primary',password:newPassword});a=await account(student.id);assert.equal((await call('/admin/accounts/'+a.id+'/revoke','POST',{expectedVersion:a.version})).status,200);assert.equal((await call('/auth/me','GET',undefined,next.accessToken)).status,401);
 });
 await t.test('维护拦截师生而管理员能恢复，时长设置作用于后续登录',async()=>{
  assert.equal((await call('/admin/server','PUT',{maintenance:true,sessionHours:1,expectedVersion:0})).status,200);assert.equal((await call('/classes','GET',undefined,teacherSession.accessToken)).status,503);assert.equal((await call('/auth/login','POST',{username:'teacher_primary',password})).status,503);assert.equal((await call('/admin/login','POST',{username:'admin_primary',password})).status,200);
  assert.equal((await call('/admin/server','PUT',{maintenance:false,sessionHours:1,expectedVersion:1})).status,200);const s=await auth.login({username:'teacher_primary',password});assert.ok(Math.abs(Date.parse(s.expiresAt)-Date.now()-3600000)<1000);
 });
 await t.test('API设置生效并持久恢复，禁止Key/URL字段与旧版本，忙碌时不能换池',async()=>{
  const settings=(await(await call('/admin/api')).json()).data.settings as ApiSettings,{version,...value}=settings;
  for(const extra of [{apiKey:'forbidden'},{baseUrl:'http://example.invalid'}])assert.equal((await call('/admin/api','PUT',{...value,expectedVersion:version,...extra})).status,400);
  assert.equal((await call('/admin/api','PUT',{...value,enabled:false,dailyRequests:12,expectedVersion:version})).status,200);assert.equal(ai.gateway.policy.enabled,false);assert.equal(ai.gateway.policy.dailyRequests,12);assert.equal((await call('/admin/api','PUT',{...value,expectedVersion:version})).status,409);
  const restored=createCourseAi(core,auth,{ledgerPath:':memory:',fingerprintKey:'a'.repeat(64),configPath});try{assert.equal(restored.gateway.policy.dailyRequests,12);assert.equal(restored.management().version,1)}finally{restored.close()}
  const current=ai.management(),{version:v,...next}=current;ai.store.reserve({id:'pending',fingerprint:'opaque',subjectId:'synthetic',courseId:'sample'},ai.gateway.policy);assert.equal((await call('/admin/api','PUT',{...next,expectedVersion:v})).status,409);assert.equal(ai.management().version,v);ai.store.noCall('pending','cancelled');
 });
 await t.test('用量和CSV无正文口令，不能读取任意数据表',async()=>{
  const r=await(await call('/admin/usage')).json();assert.ok(r.data.items.every((row:Record<string,unknown>)=>!('question'in row)&&!('fingerprint'in row)&&!('courseId'in row)));
  const csv=await call('/admin/accounts/export');assert.equal(csv.status,200);const text=await csv.text();assert.ok(text.includes('student_primary'));assert.ok(!text.includes(password));assert.ok(!text.includes('passwordHash'));
  assert.equal((await call('/admin/data/session')).status,404);assert.equal((await call('/admin/accounts?table=session')).status,400);
 });
 }finally{server.close();server.closeAllConnections();await once(server,'close');ai.close();store.close()}
});
