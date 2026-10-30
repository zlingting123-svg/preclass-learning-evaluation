import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {once} from 'node:events';
import {SqliteStore} from '../src/store.js';
import {Service} from '../src/service.js';
import {LocalAuth} from '../src/auth.js';
import {createApp} from '../src/app.js';

test('管理员分班建号、强制改密、多教师认领和重复导入闭环',async t=>{
 const store=new SqliteStore(':memory:'),core=new Service(store),auth=new LocalAuth(store),password=randomUUID(),initial=randomUUID(),changed=randomUUID();
 await auth.createUser('onboard_admin',password,'模拟管理员','admin');
 const ta=await auth.createUser('teacher_a',password,'模拟教师甲','teacher'),tb=await auth.createUser('teacher_b',password,'模拟教师乙','teacher'),outside=await auth.createUser('outside',password,'未认领教师','teacher');
 const server=createApp(core,auth).listen(0,'127.0.0.1');await once(server,'listening');const base=`http://127.0.0.1:${(server.address() as {port:number}).port}/api/v1`;
 const login=async(username:string,pwd:string)=>{const r=await fetch(base+'/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password:pwd})});assert.equal(r.status,200);return(await r.json()).data;};
 const admin=await login('onboard_admin',password),a=await login('teacher_a',password),b=await login('teacher_b',password),other=await login('outside',password);
 const call=(path:string,method='GET',body?:unknown,token=admin.accessToken)=>fetch(base+path,{method,headers:{Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
 const rows=[{studentNumber:'000801',displayName:'模拟学生甲',className:'一班'},{studentNumber:'000802',displayName:'模拟学生乙',className:'一班'},{studentNumber:'000803',displayName:'模拟学生丙',className:'二班'}];let plan:any,receipt:any,student:any;
 try{
 const response=await call('/admin/rosters/preview','POST',{batchName:'模拟批次',rows});assert.equal(response.status,200,'管理员名单预览接口应已存在');plan=(await response.json()).data;
 await t.test('仅管理员预览，预览不写账号；按班建号保留学号前导零',async()=>{
  assert.equal((await call('/admin/rosters/preview','POST',{batchName:'模拟批次',rows},a.accessToken)).status,403);
  assert.deepEqual(plan.errors,[]);assert.equal(plan.newAccounts,3);assert.equal(store.get('account','000801'),undefined);
  const r=await call('/admin/rosters/commit','POST',{planId:plan.id,fingerprint:plan.fingerprint,initialPassword:initial});assert.equal(r.status,200);receipt=(await r.json()).data;
  assert.equal(receipt.newAccounts,3);assert.equal(receipt.classes.length,2);
  assert.equal((await(await call('/admin/rosters/classes')).json()).data.find((c:any)=>c.name==='一班').memberCount,2);
  student=await login('000801',initial);assert.equal(student.user.displayName,'模拟学生甲');assert.equal(student.user.mustChangePassword,true);
 });
 await t.test('首次登录业务被服务端拦截；改密后旧会话全部失效',async()=>{
  assert.equal((await call('/classes','GET',undefined,student.accessToken)).status,403);assert.equal((await call('/auth/me','GET',undefined,student.accessToken)).status,200);
  for(const body of [{currentPassword:'incorrect',newPassword:changed},{currentPassword:initial,newPassword:initial}])assert.equal((await call('/auth/password','PUT',body,student.accessToken)).status,400);
  const second=await login('000801',initial);
  assert.equal((await call('/auth/password','PUT',{currentPassword:initial,newPassword:changed},student.accessToken)).status,200);
  assert.equal((await call('/auth/me','GET',undefined,second.accessToken)).status,401);
  student=await login('000801',changed);assert.ok(!student.user.mustChangePassword);assert.equal((await call('/classes','GET',undefined,student.accessToken)).status,200);
 });
 await t.test('多教师独立认领同班，认领前无权看名单；重复认领幂等',async()=>{
  const cls=receipt.classes.find((c:any)=>c.name==='一班');const catalog=(await(await call('/teacher/class-catalog','GET',undefined,a.accessToken)).json()).data;
  assert.ok(!JSON.stringify(catalog).includes('000801'));assert.ok(!JSON.stringify(catalog).includes('模拟学生甲'));
  assert.equal((await call('/core/classes/'+cls.id+'/members','GET',undefined,other.accessToken)).status,403);
  const rs=await Promise.all([call('/teacher/classes/'+cls.id+'/claim','POST',{},a.accessToken),call('/teacher/classes/'+cls.id+'/claim','POST',{},b.accessToken)]);assert.deepEqual(rs.map(r=>r.status),[200,200]);
  for(const token of [a.accessToken,b.accessToken])assert.equal((await call('/core/classes/'+cls.id+'/members','GET',undefined,token)).status,200);
  assert.equal(core.classes(ta).length,1);assert.equal(core.classes(tb).length,1);assert.equal(core.classes(outside).length,0);
  assert.equal((await call('/teacher/classes/'+cls.id+'/claim','POST',{},a.accessToken)).status,200);assert.equal((await call('/teacher/classes/'+cls.id+'/claim','POST',{},student.accessToken)).status,403);
 });
 await t.test('重导入幂等并保留新密码，身份冲突整批拒绝，不存明文密码',async()=>{
  assert.equal((await call('/admin/rosters/commit','POST',{planId:plan.id,fingerprint:plan.fingerprint,initialPassword:initial})).status,200);
  const next=(await(await call('/admin/rosters/preview','POST',{batchName:'模拟批次',rows})).json()).data;assert.equal(next.newAccounts,0);
  assert.equal((await call('/admin/rosters/commit','POST',{planId:next.id,fingerprint:next.fingerprint,initialPassword:randomUUID()})).status,200);assert.ok(!(await login('000801',changed)).user.mustChangePassword);
  const bad=(await(await call('/admin/rosters/preview','POST',{batchName:'模拟批次',rows:[{...rows[0],displayName:'身份冲突'},{studentNumber:'000999',displayName:'不应创建',className:'三班'}]})).json()).data;
  assert.ok(bad.errors.length);assert.equal((await call('/admin/rosters/commit','POST',{planId:bad.id,fingerprint:bad.fingerprint,initialPassword:initial})).status,409);assert.equal(store.get('account','000999'),undefined);
  const state=JSON.stringify(store.all('admin_roster_plan'))+JSON.stringify(store.all('admin_audit'));assert.ok(!state.includes(initial));assert.ok(!state.includes(changed));
 });
 await t.test('教师无名单写入和自建班级；管理员手工创建教师要求首登改密',async()=>{
  assert.equal((await call('/core/classes/'+receipt.classes[0].id+'/roster/preview','POST',{rows:[]},a.accessToken)).status,403);assert.equal((await call('/teacher/classes','POST',{name:'绕过管理'},a.accessToken)).status,403);
  assert.equal((await call('/admin/users','POST',{username:'manual_teacher',displayName:'管理员创建教师',role:'teacher',password:initial})).status,200);
  const manual=await login('manual_teacher',initial);assert.equal(manual.user.mustChangePassword,true);assert.equal((await call('/teacher/class-catalog','GET',undefined,manual.accessToken)).status,403);
 });
 }finally{server.close();server.closeAllConnections();await once(server,'close');store.close()}
});

import {Provisioning} from '../src/provisioning.js';
test('批量导入预览绑定管理员、过期/科学计数拒绝，500行预览不创建账号',async()=>{
 const store=new SqliteStore(':memory:');let time=Date.now();const core=new Service(store,()=>time),auth=new LocalAuth(store),pwd=randomUUID();
 const admin=await auth.createUser('batch_admin',pwd,'模拟管理员','admin'),other=await auth.createUser('batch_other',pwd,'另一模拟管理员','admin'),service=new Provisioning(core,auth),token=(await auth.login({username:'batch_admin',password:pwd})).accessToken;
 try{
  const rows=Array.from({length:500},(_,i)=>({studentNumber:String(i+1).padStart(6,'0'),displayName:'模拟学生'+i,className:'模拟'+(i%10)+'班'}));
  const p=service.preview(admin,{batchName:'模拟500行',rows});assert.equal(p.newAccounts,500);assert.equal(p.classes.length,10);assert.equal(store.all('account').length,2);
  const body={planId:p.id,fingerprint:p.fingerprint,initialPassword:pwd};await assert.rejects(()=>service.commit(other,(undefined as unknown as string),body),/预览不匹配/);
  time+=31*60000;await assert.rejects(()=>service.commit(admin,token,body),/过期/);assert.equal(store.all('account').length,2);
  const bad=service.preview(admin,{batchName:'模拟无效',rows:[{studentNumber:'1e12',displayName:'模拟姓名',className:'模拟班'}]});assert.ok(bad.errors.length);
 }finally{store.close()}
});
test('并发重复确认仅建一份账号和班级；写入故障完整回滚并可重新确认',async()=>{
 const store=new SqliteStore(':memory:'),core=new Service(store),auth=new LocalAuth(store),pwd=randomUUID(),admin=await auth.createUser('atomic_admin',pwd,'模拟管理员','admin'),service=new Provisioning(core,auth),token=(await auth.login({username:'atomic_admin',password:pwd})).accessToken;
 try{
  const p=service.preview(admin,{batchName:'模拟并发',rows:[{studentNumber:'009991',displayName:'模拟并发学生',className:'模拟班'}]}),body={planId:p.id,fingerprint:p.fingerprint,initialPassword:pwd};
  const results=await Promise.all([service.commit(admin,token,body),service.commit(admin,token,body)]);assert.deepEqual(results[0],results[1]);assert.equal(store.all('account').length,2);assert.equal(store.all('managed_class').length,1);
  const next=service.preview(admin,{batchName:'模拟回滚',rows:[{studentNumber:'009992',displayName:'模拟回滚学生',className:'回滚班'}]}),input={planId:next.id,fingerprint:next.fingerprint,initialPassword:pwd};
  const put=store.put.bind(store);store.put=(kind,id,value)=>{if(kind==='admin_audit')throw new Error('injected audit failure');put(kind,id,value)};
  await assert.rejects(()=>service.commit(admin,token,input));store.put=put;assert.equal(store.get('account','009992'),undefined);assert.equal(store.all('managed_class').length,1);assert.equal(store.get('admin_roster_receipt',next.id),undefined);
  await service.commit(admin,token,input);assert.equal(store.all('managed_class').length,2);
 }finally{store.close()}
});
