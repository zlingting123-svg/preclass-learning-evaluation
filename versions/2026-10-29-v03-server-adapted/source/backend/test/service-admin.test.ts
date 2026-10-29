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
test('服务设置接入其他工作者管理员契约，权限与生效回归',async t=>{
 const store=new SqliteStore(':memory:'),core=new Service(store),auth=new LocalAuth(store),password=randomUUID();
 await auth.createUser('svc_admin',password,'模拟管理员','admin');await auth.createUser('svc_teacher',password,'模拟教师','teacher');
 const adminSession=await auth.login({username:'svc_admin',password}),teacherSession=await auth.login({username:'svc_teacher',password});
 const ai=createCourseAi(core,auth,{ledgerPath:':memory:',fingerprintKey:'s'.repeat(64),configPath:resolve('../ai-module/config/mock.example.json')});
 const server=createApp(core,auth,ai).listen(0,'127.0.0.1');await once(server,'listening');
 const base=`http://127.0.0.1:${(server.address() as {port:number}).port}/api/v1`;
 const call=(path:string,method='GET',body?:unknown,token:string|undefined=adminSession.accessToken)=>fetch(base+path,{method,headers:{...(token?{Authorization:'Bearer '+token}:{}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
 try{
 await t.test('专用登录拒绝教师，服务设置保持后台管理员校验',async()=>{
  assert.equal((await call('/auth/admin-login','POST',{username:'svc_teacher',password})).status,403);
  assert.equal((await call('/admin/server','GET',undefined,'')).status,401);
  assert.equal((await call('/admin/api','GET',undefined,teacherSession.accessToken)).status,403);
  const overview=(await(await call('/admin/overview')).json()).data;assert.equal(overview.users,2);assert.equal(overview.counts,undefined);
  assert.ok(Array.isArray((await(await call('/admin/audit')).json()).data));
 });
 await t.test('API设置可版本化保存，保留原审计结构且不返回Key或正文',async()=>{
  const data=(await(await call('/admin/api')).json()).data;const {version,...value}=data.settings;
  assert.equal((await call('/admin/api','PUT',{...value,expectedVersion:version,dailyRequests:23})).status,200);
  assert.equal(ai.management().dailyRequests,23);assert.equal(store.get<{dailyRequests:number}>('ai_admin_settings','current')?.dailyRequests,23);
  assert.equal((await call('/admin/api','PUT',{...value,expectedVersion:version})).status,409);
  assert.equal((await call('/admin/api','PUT',{...value,expectedVersion:1,apiKey:'FAKE_SECRET_FOR_SCHEMA_REJECTION'})).status,400);
  const audit=(await(await call('/admin/audit')).json()).data;assert.ok(audit.some((a:{action:string;at:string})=>a.action==='api.configure'&&a.at));
  const raw=JSON.stringify((await(await call('/admin/usage')).json()).data);assert.ok(!raw.includes(password));assert.ok(!raw.includes('question'));assert.ok(!raw.includes('fingerprint'));
 });
 await t.test('维护设置即时拦截师生，但管理员和退出仍可用；新登录时长生效',async()=>{
  assert.equal((await call('/admin/server','PUT',{maintenance:true,sessionHours:2,expectedVersion:0})).status,200);
  assert.equal((await call('/classes','GET',undefined,teacherSession.accessToken)).status,503);
  assert.equal((await call('/auth/login','POST',{username:'svc_teacher',password})).status,503);
  assert.equal((await call('/admin/api')).status,200);
  const login=await call('/auth/admin-login','POST',{username:'svc_admin',password});assert.equal(login.status,200);const data=(await login.json()).data;const remaining=Date.parse(data.expiresAt)-Date.now();assert.ok(remaining>7100000&&remaining<=7200000);
  assert.equal((await call('/admin/server','PUT',{maintenance:false,sessionHours:8,expectedVersion:0})).status,409);
  assert.equal((await call('/admin/server','PUT',{maintenance:false,sessionHours:8,expectedVersion:1})).status,200);
  assert.equal((await call('/classes','GET',undefined,teacherSession.accessToken)).status,200);
  await call('/auth/logout','POST',undefined,data.accessToken);
 });
 }finally{server.close();server.closeAllConnections();await once(server,'close');ai.close();store.close()}
});
