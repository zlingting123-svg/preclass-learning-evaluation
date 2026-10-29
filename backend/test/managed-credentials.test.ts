import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {once} from 'node:events';
import {SqliteStore} from '../src/store.js';
import {Service} from '../src/service.js';
import {LocalAuth} from '../src/auth.js';
import {CredentialVault} from '../src/credential-vault.js';
import {createCourseAi} from '../src/ai.js';
import {createApp} from '../src/app.js';

test('AES-GCM密钥存储：随机nonce、密文、绑定部署、篡改与错误主密钥拒绝',()=>{
 const store=new SqliteStore(':memory:'),master=randomBytes(32).toString('base64'),vault=new CredentialVault(store,master),key='sk-test-fake-test-vault-only-credential';
 try{
  vault.set('student',key);const first=store.get<{iv:string;ciphertext:string}>('ai_provider_credential','student')!;assert.equal(vault.get('student'),key);assert.ok(!JSON.stringify(store.all('ai_provider_credential')).includes(key));
  vault.set('student',key);const second=store.get<{iv:string;ciphertext:string}>('ai_provider_credential','student')!;assert.notEqual(first.iv,second.iv);assert.notEqual(first.ciphertext,second.ciphertext);
  store.put('ai_provider_credential','teacher',second);assert.throws(()=>vault.get('teacher'),/无法读取/);assert.throws(()=>new CredentialVault(store,randomBytes(32).toString('base64')).get('student'),/无法读取/);
  const changed=store.get<Record<string,unknown>>('ai_provider_credential','student')!;store.put('ai_provider_credential','student',{...changed,tag:Buffer.alloc(16).toString('base64')});assert.throws(()=>vault.get('student'),/无法读取/);
 }finally{store.close();}
});

test('管理端录入/换Key、用途路由、只写不回显、事务回滚及重启无环境Key恢复',async()=>{
 const env={...process.env},originalFetch=globalThis.fetch,folder=mkdtempSync(join(tmpdir(),'managed-key-'));
 Object.assign(process.env,{AI_SECRET_MASTER_KEY:randomBytes(32).toString('base64'),AI_ENABLE_LIVE:'I_ACCEPT_PAID_API_CALLS',AI_PROVIDER_POLICY_ACCEPTED:'true',NODE_ENV:'development',AI_RETRIEVAL_BASELINE_ACCEPTED:'PRIVATE_TEST_ONLY',AI_PROVIDER_INITIAL:'sk-test-fake-environment-only-initial-key'});
 const config=JSON.parse(readFileSync(resolve('../ai-module/config/mock.example.json'),'utf8'));config.mode='deepseek';config.policy.reserveMicros=40000;config.policy.rates={inputPerMillion:2000000,cacheHitPerMillion:40000,outputPerMillion:8000000,currency:'CNY',version:'deepseek-flash-2026-10-29-peak-ceiling'};config.deployments[0].credentialEnv='AI_PROVIDER_INITIAL';
 const configPath=join(folder,'config.json');writeFileSync(configPath,JSON.stringify(config));
 const store=new SqliteStore(':memory:'),core=new Service(store),auth=new LocalAuth(store),password=randomUUID();
 const admin=await auth.createUser('key_admin',password,'模拟管理员','admin'),teacher=await auth.createUser('key_teacher',password,'模拟教师','teacher'),student=await auth.createUser('key_student',password,'模拟学生','student');const c=core.createClass(teacher,'模拟密钥班');core.join(student,c.joinCode!);
 const adminToken=(await auth.login({username:'key_admin',password})).accessToken,teacherToken=(await auth.login({username:'key_teacher',password})).accessToken,studentToken=(await auth.login({username:'key_student',password})).accessToken;
 const calledKeys:string[]=[];
 globalThis.fetch=async(url,opts)=>{
  if(!String(url).startsWith('https://api.deepseek.com'))return originalFetch(url,opts);
  if(String(url).endsWith('/user/balance'))return Response.json({is_available:true,balance_infos:[{currency:'CNY',total_balance:'50'}]});
  calledKeys.push((opts?.headers as Record<string,string>).Authorization);
  return new Response('data: '+JSON.stringify({model:'deepseek-flash',choices:[{delta:{content:'模拟课程解释'},finish_reason:null}]})+'\n\ndata: '+JSON.stringify({choices:[{delta:{},finish_reason:'stop'}],usage:{prompt_tokens:100,completion_tokens:10,prompt_cache_hit_tokens:0}})+'\n\ndata: [DONE]\n\n');
 };
 let ai=createCourseAi(core,auth,{ledgerPath:':memory:',fingerprintKey:'x'.repeat(64),configPath}),server=createApp(core,auth,ai).listen(0,'127.0.0.1');await once(server,'listening');
 let base=`http://127.0.0.1:${(server.address() as {port:number}).port}/api/v1`;
 const call=(path:string,method='GET',body?:unknown,token=adminToken)=>fetch(base+path,{method,headers:{Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
 const studentKey='sk-test-fake-managed-student-only-key',teacherKey='sk-test-fake-managed-teacher-only-key',rotated='sk-test-fake-managed-student-rotated-key';
 try{
  assert.equal((await call('/admin/api','GET',undefined,studentToken)).status,403);
  const initial=(await(await call('/admin/api')).json()).data;assert.equal(initial.storageReady,true);assert.equal(initial.credentials[0].source,'environment');
  const {version,...settings}=initial.settings;
  const payload={...settings,expectedVersion:version,deployments:[{id:'student',accountId:'student-account',quotaGroup:'student-account',purposes:['student_qa'],maxConcurrency:2},{id:'teacher',accountId:'teacher-account',quotaGroup:'teacher-account',purposes:['teacher_qa'],maxConcurrency:2}],credentialUpdates:[{deploymentId:'student',apiKey:studentKey},{deploymentId:'teacher',apiKey:teacherKey}]};
  const denied=await call('/admin/api','PUT',payload,teacherToken);assert.equal(denied.status,403);assert.ok(!(await denied.text()).includes(studentKey));
  const saved=await call('/admin/api','PUT',payload);assert.equal(saved.status,200);assert.ok(!(await saved.text()).includes(studentKey));
  const reloaded=(await(await call('/admin/api')).json()).data;assert.ok(reloaded.credentials.every((x:{source:string})=>x.source==='managed'));assert.ok(!JSON.stringify(reloaded).includes(teacherKey));
  const ask=async(token:string)=>{const r=await call('/core/ai/chat','POST',{classId:c.id,messages:[{role:'user',text:'高斯模型是什么'}],clientRequestId:randomUUID()},token);assert.equal(r.status,200);assert.equal((await r.json()).data.outcome,'done');};
  await ask(studentToken);await ask(teacherToken);assert.deepEqual(calledKeys,['Bearer '+studentKey,'Bearer '+teacherKey]);
  const versioned=ai.management(),{version:nextVersion,...next}=versioned;
  const rotate=await call('/admin/api','PUT',{...next,expectedVersion:nextVersion,credentialUpdates:[{deploymentId:'student',apiKey:rotated}]});assert.equal(rotate.status,200);await ask(studentToken);assert.equal(calledKeys.at(-1),'Bearer '+rotated);
  const vault=new CredentialVault(store);assert.equal(vault.get('teacher'),teacherKey);
  assert.throws(()=>ai.configure(ai.management(),()=>{throw new Error('simulated persistence failure')},{student:'sk-test-fake-must-not-be-saved-credential'}),/simulated/);assert.equal(vault.get('student'),rotated);await ask(studentToken);assert.equal(calledKeys.at(-1),'Bearer '+rotated);
  const metadata=JSON.stringify([...store.all('ai_provider_credential'),...store.all('ai_admin_settings'),...store.all('admin_audit'),...ai.store.rows()]);for(const key of [studentKey,teacherKey,rotated])assert.ok(!metadata.includes(key));
  server.close();server.closeAllConnections();await once(server,'close');ai.close();delete process.env.AI_PROVIDER_INITIAL;
  ai=createCourseAi(core,auth,{ledgerPath:':memory:',fingerprintKey:'x'.repeat(64),configPath});server=createApp(core,auth,ai).listen(0,'127.0.0.1');await once(server,'listening');base=`http://127.0.0.1:${(server.address() as {port:number}).port}/api/v1`;
  await ask(studentToken);await ask(teacherToken);assert.deepEqual(calledKeys.slice(-2),['Bearer '+rotated,'Bearer '+teacherKey]);assert.ok(admin.id);
 }finally{server.close();server.closeAllConnections();await once(server,'close');ai.close();store.close();globalThis.fetch=originalFetch;for(const key of Object.keys(process.env))if(!(key in env))delete process.env[key];Object.assign(process.env,env);rmSync(folder,{recursive:true,force:true});}
});
