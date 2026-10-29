import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {SqliteStore} from '../src/store.js';
import {Service} from '../src/service.js';
import {LocalAuth} from '../src/auth.js';
import {LearningService} from '../src/learning.js';
import {createCourseAi} from '../src/ai.js';

test('真实提供商主机适配：余额门禁、课程范围、流式结算及密钥隔离（替身网络）',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'deepseek-host-'));
 const env={...process.env},originalFetch=globalThis.fetch;
 const config=JSON.parse(readFileSync(resolve('../ai-module/config/mock.example.json'),'utf8'));
 config.mode='deepseek';config.policy.rates={inputPerMillion:2000000,cacheHitPerMillion:40000,outputPerMillion:8000000,currency:'CNY',version:'deepseek-flash-2026-10-29-peak-ceiling'};
 config.policy.reserveMicros=40000;config.deployments[0].credentialEnv='AI_PROVIDER_STUDENT_1';
 const path=join(dir,'config.json');writeFileSync(path,JSON.stringify(config));
 Object.assign(process.env,{AI_ENABLE_LIVE:'I_ACCEPT_PAID_API_CALLS',AI_PROVIDER_POLICY_ACCEPTED:'true',NODE_ENV:'development',AI_RETRIEVAL_BASELINE_ACCEPTED:'PRIVATE_TEST_ONLY',AI_PROVIDER_STUDENT_1:'fake-test-key'});
 const store=new SqliteStore(':memory:'),core=new Service(store),auth=new LocalAuth(store);
 let calls=0,balanceCalls=0,generalCalls=0,failBalance=false;
 globalThis.fetch=async (url,opts)=>{
   assert.equal(new URL(String(url)).origin,'https://api.deepseek.com');
   assert.equal((opts?.headers as Record<string,string>).Authorization,'Bearer fake-test-key');
   if(String(url).endsWith('/user/balance')){balanceCalls++;if(failBalance)throw new Error('simulated network failure');return Response.json({is_available:true,balance_infos:[{currency:'CNY',total_balance:'50'}]});}
   calls++;const body=JSON.parse(String(opts?.body));assert.equal(body.model,'deepseek-flash');assert.equal(body.stream,true); if(JSON.parse(body.messages[1].content).course_evidence.length===0){generalCalls++;assert.match(body.messages[0].content,/一般知识/)}
   return new Response('data: '+JSON.stringify({model:'deepseek-flash',choices:[{delta:{content:'根据课程资料，环境评价需要依据资料。'},finish_reason:null}]})+'\n\ndata: '+JSON.stringify({choices:[{delta:{},finish_reason:'stop'}],usage:{prompt_tokens:100,completion_tokens:10,prompt_cache_hit_tokens:0}})+'\n\ndata: [DONE]\n\n');
 };
 let ai:ReturnType<typeof createCourseAi>|undefined;
 try{
   const teacher=await auth.createUser('host_teacher','random-test-only','模拟教师','teacher');
   const student=await auth.createUser('host_student','random-test-only','模拟学生','student');
   const c=core.createClass(teacher,'模拟班');core.join(student,c.joinCode!);
   const token=(await auth.login({username:'host_student',password:'random-test-only'})).accessToken;
   ai=createCourseAi(core,auth,{ledgerPath:':memory:',fingerprintKey:'x'.repeat(64),configPath:path});
   assert.equal(ai.mode,'deepseek');
   const principal=await ai.gateway.deps.identity.verify(token);
   let lastReply=""; const ask=async(question:string,id:string)=>{lastReply="";const input={courseId:c.id,question,clientRequestId:id};const rid=await ai!.gateway.prepare(principal,input);const events:string[]=[];await ai!.gateway.answer(principal,input,rid,new AbortController().signal,async (e,data)=>{events.push(e);if(e==="delta")lastReply+=(data as {text:string}).text;});return events;};
   assert.ok((await ask('环境评价是什么','no-material')).includes('done'));assert.equal(calls,1);assert.equal(generalCalls,1);assert.match(lastReply,/一般知识解释，未依据已上传课程资料/);
   assert.ok((await ask('老师讲的环境评价评分标准是什么','teacher-specific')).includes('done'));assert.equal(calls,2);
   assert.ok((await ask('最新环境评价法规是什么','current-law')).includes('done'));assert.equal(calls,3);
   for(const question of ['总结一下','大气的呢','高斯方程是什么','大气污染评价中的基本模型有什么','我该如何准备这门课程的课前学习？'])assert.equal((await ai.gateway.deps.knowledge.retrieve({courseId:c.id,scopeIds:[c.id],question,history:[{role:'user',text:'水环境评价的流程'}],signal:new AbortController().signal})).status,'general_knowledge');
   const learning=new LearningService(core),m=learning.saveMaterial(teacher,c.id,{title:'模拟环境资料',content:'环境评价需要依据课程资料。',expectedVersion:0});learning.publishMaterial(teacher,m.id,m.version);
   assert.ok((await ask('推荐游戏装备','off-topic')).includes('done'));assert.equal(calls,4);
   assert.ok((await ask('环境评价是什么','real-adapter')).includes('done'));assert.equal(calls,5);assert.equal(balanceCalls,1);
   assert.equal(ai.store.summary(student.id).modelCalls,5);
   assert.equal(ai.store.rows().find(r=>r.state==='completed')?.costMicros,280);
   assert.ok(!JSON.stringify(ai.management()).includes('fake-test-key'));
   const expanded={...ai.management(),maxOutputTokens:8192};
   ai.configure(expanded,()=>store.put('ai_admin_settings','current',{...expanded,version:1}));
   assert.equal(ai.gateway.policy.maxOutputTokens,8192);
   assert.ok(ai.gateway.policy.reserveMicros>=91584);
   const settings=ai.management();
   assert.throws(()=>ai!.configure({...settings,deployments:[{...settings.deployments[0],credentialEnv:'AI_PROVIDER_MISSING'}]},()=>assert.fail('must not persist invalid key')));
   ai.configure({...settings,stopMicros:60000000,warningMicros:70000000},()=>{});
   assert.ok((await ask('环境评价是什么','balance-low')).includes('error'));assert.equal(calls,5);
   ai.close();ai=undefined;failBalance=true;
   ai=createCourseAi(core,auth,{ledgerPath:':memory:',fingerprintKey:'x'.repeat(64),configPath:path});
   assert.equal(ai.gateway.policy.maxOutputTokens,8192);
   assert.ok(ai.gateway.policy.reserveMicros>=91584);
   const p=await ai.gateway.deps.identity.verify(token),input={courseId:c.id,question:'环境评价是什么',clientRequestId:'unknown-balance'};
   const id=await ai.gateway.prepare(p,input);let code='';
   await ai.gateway.answer(p,input,id,new AbortController().signal,async(e,data)=>{if(e==='error')code=(data as {code:string}).code;});
   assert.equal(code,'BALANCE_UNKNOWN');assert.equal(calls,5);
   process.env.NODE_ENV='production';
   assert.throws(()=>createCourseAi(core,auth,{ledgerPath:':memory:',fingerprintKey:'x'.repeat(64),configPath:path}),/RETRIEVAL_UNCALIBRATED/);
 }finally{
   ai?.close();store.close();globalThis.fetch=originalFetch;
   for(const k of Object.keys(process.env))if(!(k in env))delete process.env[k];Object.assign(process.env,env);rmSync(dir,{recursive:true,force:true});
 }
});
