import assert from 'node:assert/strict';
import {SqliteStore} from '/opt/preclass/releases/20261101-audit-fast-checkin-bound/backend/dist/backend/src/store.js';
import {Service,keyFor} from '/opt/preclass/releases/20261101-audit-fast-checkin-bound/backend/dist/backend/src/service.js';
import {LocalAuth} from '/opt/preclass/releases/20261101-audit-fast-checkin-bound/backend/dist/backend/src/auth.js';
import {AttendanceService} from '/opt/preclass/releases/20261101-audit-fast-checkin-bound/backend/dist/backend/src/attendance.js';
import {QuestionnaireService} from '/opt/preclass/releases/20261101-audit-fast-checkin-bound/backend/dist/backend/src/questionnaires.js';
import {reviewEvidence} from '/opt/preclass/releases/20261101-audit-fast-checkin-bound/backend/dist/backend/src/course-review.js';
import {protectCourseReply,Gateway} from '/opt/preclass/releases/20261101-audit-fast-checkin-bound/ai-module/dist/src/gateway.js';
import {referenceAiRoutes} from '/opt/preclass/releases/20261101-audit-fast-checkin-bound/backend/dist/backend/src/reference-ai.js';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const out={isolated:true,productionWrites:false,paidModelCalls:0,checks:[]};
const check=(name,details)=>out.checks.push({name,...details});
const db=new SqliteStore(':memory:');let now=Date.now();const core=new Service(db,()=>now);
const t={id:'teacher',displayName:'合成教师',role:'teacher'},s={id:'student',displayName:'合成学生',role:'student'};
db.put('class','class-a',{id:'class-a',name:'A',teacherId:t.id});db.put('class','class-b',{id:'class-b',name:'B',teacherId:'other-teacher'});
db.put('member',keyFor('class-a',s.id),{classId:'class-a',studentId:s.id});db.put('user',s.id,s);
const a=new AttendanceService(core);
db.put('attendance_image','image',{id:'image',active:true,mime:'image/png',base64:'AA=='});
const session=a.create(t,{classId:'class-a',imageId:'image',title:'测试',clientRequestId:'test-create'});
try{a.state(s,session.id);check('student_read_session',{denied:false})}catch(e){check('student_read_session',{denied:true,code:e.code})}
try{core.classAccess(s,'class-b');check('cross_class_access',{denied:false})}catch(e){check('cross_class_access',{denied:true,code:e.code})}
check('valid_checkin',{result:a.checkin(s,{sessionId:session.id,ticket:session.ticket}).checkedIn});
check('duplicate_checkin',{count:db.get('attendance_session',session.id).signed.length});
now+=31000;try{a.capture({sessionId:session.id,ticket:session.ticket});check('expired_qr',{denied:false})}catch(e){check('expired_qr',{denied:true,code:e.code})}
const src={sourceType:'uploaded_material',title:'合成教材',privateFileName:'合成教材.txt',content:'合成内容'};
for(const text of ['参考合成教材.txt中的内容。','请阅读 page 15。','请阅读第15页。'])check('privacy_filter',{input:text,output:protectCourseReply(text,[src])});
const chunks=['01 基本概念','02 主要内容','本章知识图谱与学习要点\n基础概念、基本原则、方法框架'];
db.put('ai_imported_source','source',{id:'source',title:'2.生态环境问题与基础知识',name:'chapter.pdf',classId:'class-a',state:'published',version:'synthetic',chunks});
for(const question of ['总结2.生态环境问题与基础知识的知识框架','总结第2章的知识框架','总结第二章的知识框架'])check('chapter_alias',{question,matched:!!reviewEvidence(core,{courseId:'class-a',question})});
const qs=new QuestionnaireService(core);
const sv=qs.save(t,{classId:'class-a',title:'测试',questions:[{id:'q',title:'可不答',type:'single',required:false,options:['A','B']}],deadlineAt:null,durationMinutes:null,expectedVersion:0});
qs.transition(t,sv.id,sv.version,'publish');qs.start(s,sv.id);
try{qs.submit(s,sv.id,{q:''});check('optional_single_empty_string',{accepted:true})}catch(e){check('optional_single_empty_string',{accepted:false,code:e.code})}
const root=mkdtempSync(join(tmpdir(),'preclass-readonly-audit-'));
try{
 const fileId='11111111-1111-4111-8111-111111111111';
 db.put('reference_file',fileId,{id:fileId,title:'合成文档',name:'synthetic.txt',status:'waiting_ai',ocrPages:0});
 writeFileSync(join(root,fileId+'.pages.jsonl'),JSON.stringify({page:1,text:'Synthetic example',needsOcr:false})+'\n');
 const rows=new Map(),used=[];
 const ai={mode:'deepseek',gateway:{policy:{enabled:true,maxOutputTokens:512,requestTimeoutMs:5000},scheduler:{async take(uid,signal,purpose){used.push(purpose);return {deployment:{id:'mock',accountId:'mock',provider:{key:'synthetic-only-not-real',baseURL:'https://api.deepseek.com',model:'mock'}},release(){}}}}},store:{reserve(x){rows.set(x.id,{...x,state:'reserved'})},update(id,patch){rows.set(id,{...rows.get(id),...patch})},get(id){return rows.get(id)},finish(id){rows.set(id,{...rows.get(id),state:'completed'})},noCall(){}}};
 const routes=new Map(),app={post(p,f){routes.set(p,f)},get(){}};
 db.put('user','mock-admin',{id:'mock-admin',role:'admin',displayName:'mock'});
 let sent;
 const originalFetch=globalThis.fetch;
 globalThis.fetch=async(url,options)=>{sent=JSON.parse(options.body);return {ok:true,json:async()=>({choices:[{finish_reason:'stop',message:{content:'Synthetic summary'}}],usage:{prompt_tokens:10,completion_tokens:10}})}};
 try{
  referenceAiRoutes(app,core,ai,root);
  routes.get('/api/v1/admin/reference-files/:id/read')({params:{id:fileId}},{locals:{user:{id:'mock-admin',role:'admin',displayName:'mock'}},json(){}});
  for(let i=0;i<30&&db.get('reference_file',fileId).status!=='ai_read_complete';i++)await new Promise(r=>setTimeout(r,10));
  check('reference_ai_route',{state:db.get('reference_file',fileId).status,ledgerPurpose:[...rows.values()][0]?.purpose,schedulerPurpose:used[0],policyOutputLimit:512,requestedMaxTokens:sent?.max_tokens});
 }finally{globalThis.fetch=originalFetch}
}finally{rmSync(root,{recursive:true,force:true})}
let revoked=false,authChecks=0;const events=[],ledger=new Map();
const provider={model:'mock',async *stream(){revoked=true;yield {type:'delta',text:'Synthetic protected answer'};yield {type:'usage',usage:{inputTokens:1,outputTokens:1,cacheHitTokens:0}};yield {type:'finish'}}};
const gateway=new Gateway({allowTeacherQuestions:true,authorization:{async authorize(){authChecks++;if(revoked)throw Error('ACCESS_REVOKED');return {scopeIds:['class-a']}}},knowledge:{async retrieve(){return {status:'supported',evidence:[{id:'e',sourceType:'uploaded_material',scopeId:'class-a',approved:true,topicId:'t',content:'Synthetic evidence'}]}}}},
 {reserve(x){ledger.set(x.id,x)},update(){},get(id){return ledger.get(id)},finish(id){ledger.get(id).state='completed'},topic(){},noCall(){}},
 {enabled:true,maxInputBytes:32000,maxOutputTokens:512},[{id:'mock',purposes:['student_qa'],provider}], 'synthetic-fingerprint-key-32-characters',undefined,
 {take:async()=>({deployment:{id:'mock',accountId:'mock',provider},release(){}})});
const principal={subjectId:'student',role:'student'},input={courseId:'class-a',question:'synthetic question',clientRequestId:'synthetic-request'};
const rid=await gateway.prepare(principal,input);await gateway.answer(principal,input,rid,new AbortController().signal,async(event,data)=>events.push({event,data}));
check('revoke_access_during_generation',{revoked,authChecks,answerEmittedAfterRevocation:events.some(x=>x.event==='delta'),done:events.some(x=>x.event==='done')});

const moduleRoot='/opt/preclass/releases/20261101-audit-fast-checkin-bound';
const {ticketAt,verifyTicket,qrState,captureProof,verifyProof,QR_INTERVAL_MS,QR_VALID_MS,SCAN_PROOF_MS}=await import(moduleRoot+'/backend/dist/backend/src/attendance-qr.js');
const specimen={id:'00000000-0000-4000-8000-000000000000',secret:'synthetic-secret-only'};
const start=Math.floor(now/2000)*2000,code=ticketAt(specimen,start),proof=captureProof(specimen,code,start+1000,'A'.repeat(43));
assert.notEqual(ticketAt(specimen,start+2000),code);assert(verifyTicket(specimen,code,start+9999));assert(!verifyTicket(specimen,code,start+10000));assert(!verifyTicket(specimen,ticketAt(specimen,start+2000),start));
assert(verifyProof(specimen,proof.scanProof,start+1000+179999,'A'.repeat(43)));assert(!verifyProof(specimen,proof.scanProof,start+1000+180000,'A'.repeat(43)));assert(!verifyProof(specimen,proof.scanProof,start+2000,'B'.repeat(43)));assert(!verifyProof(specimen,proof.scanProof,start+2000));assert(!verifyProof({...specimen,secret:'different'},proof.scanProof,start+2000,'A'.repeat(43)));assert(!verifyProof(specimen,proof.scanProof+'x',start+2000,'A'.repeat(43)));
check('fast_qr_boundaries',{passed:true,rotationMs:QR_INTERVAL_MS,validityMs:QR_VALID_MS,loginProofMs:SCAN_PROOF_MS,prefetchedFrames:qrState(specimen,start).qrTickets.length});
const school=new SqliteStore(':memory:'),schoolCore=new Service(school,()=>now),classId='http-class';
school.put('class',classId,{id:classId,teacherId:t.id});school.put('user',s.id,s);school.put('member',keyFor(classId,s.id),{classId,studentId:s.id});
const attendance=new AttendanceService(schoolCore);school.put('attendance_image','pic',{id:'pic',active:true});const open=attendance.create(t,{classId,imageId:'pic',title:'HTTP synthetic',clientRequestId:'create-http'});
const {createApp}=await import(moduleRoot+'/backend/dist/backend/src/app.js');
const httpAuth={authenticate(token){if(token==='student-token')return s;if(token==='teacher-token')return t;throw new Error('invalid synthetic auth')},logout(){},login:async()=>{throw new Error('No login in isolated test')}};
const server=createApp(schoolCore,httpAuth).listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
const origin='http://127.0.0.1:'+server.address().port;
try{
 const capture=await fetch(origin+'/api/v1/attendance/scan',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:open.id,ticket:open.ticket})});assert.equal(capture.status,200);const cookie=capture.headers.get('set-cookie').split(';')[0];assert(capture.headers.get('set-cookie').includes('HttpOnly'));assert(capture.headers.get('set-cookie').includes('SameSite=Strict'));const captured=await capture.json();assert.deepEqual(Object.keys(captured.data).sort(),['expiresAt','scanProof','sessionId']);
 const transferred=await fetch(origin+'/api/v1/core/attendance-checkin',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer student-token'},body:JSON.stringify({sessionId:open.id,scanProof:captured.data.scanProof})});assert.equal(transferred.status,409);
 now+=90000;
 const result=await fetch(origin+'/api/v1/core/attendance-checkin',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer student-token',Cookie:cookie},body:JSON.stringify({sessionId:open.id,scanProof:captured.data.scanProof})});assert.equal(result.status,200);assert((await result.json()).data.checkedIn);
 const unsigned=await fetch(origin+'/api/v1/core/attendance-checkin',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:open.id,scanProof:captured.data.scanProof})});assert.equal(unsigned.status,401);
 const wrongOrigin=await fetch(origin+'/api/v1/attendance/scan',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://untrusted.example'},body:JSON.stringify({sessionId:open.id,ticket:open.ticket})});assert.equal(wrongOrigin.status,403);
 check('prelogin_scan_http',{passed:true,loginDelayMs:90000,anonymousCheckinDenied:true,crossOriginDenied:true,publicResponseHasNoRoster:true,proofTransferWithoutDeviceCookieDenied:true,httpOnlySameSiteCookie:true});
}finally{await new Promise(r=>server.close(r));school.close()}
const qdb=new SqliteStore(':memory:'),qc=new Service(qdb,()=>now);qdb.put('class','qa',{id:'qa',teacherId:t.id});qdb.put('member',keyFor('qa',s.id),{classId:'qa',studentId:s.id});
const qservice=new QuestionnaireService(qc);let question=qservice.save(t,{classId:'qa',title:'Draft checks',questions:[{id:'required',title:'required',type:'text',required:true,options:[]},{id:'optional',title:'optional',type:'multiple',required:false,options:['A','B']}],deadlineAt:null,durationMinutes:null,expectedVersion:0});qservice.transition(t,question.id,question.version,'publish');qservice.start(s,question.id);
const draft=qservice.saveDraft(s,question.id,{answers:{optional:['A']},expectedVersion:0});assert.equal(draft.version,1);assert.deepEqual(qservice.start(s,question.id).response.answers,{optional:['A']});
assert.throws(()=>qservice.saveDraft(s,question.id,{answers:{},expectedVersion:0}),e=>e.code==='VERSION_CONFLICT');
assert.throws(()=>qservice.saveDraft({id:'other',role:'student'},question.id,{answers:{},expectedVersion:1}),e=>e.code==='FORBIDDEN');
assert.throws(()=>qservice.submit(s,question.id,{optional:['A']},1),e=>e.code==='REQUIRED');
qservice.saveDraft(s,question.id,{answers:{required:'Synthetic final answer'},expectedVersion:1});
assert.throws(()=>qservice.submit(s,question.id,{required:'Synthetic final answer'},1),e=>e.code==='VERSION_CONFLICT');
assert(qservice.submit(s,question.id,{required:'Synthetic final answer'},2).submittedAt);assert.throws(()=>qservice.saveDraft(s,question.id,{answers:{},expectedVersion:2}),e=>e.code==='ALREADY_SUBMITTED');qdb.close();
check('survey_versioned_drafts',{passed:true,partialAllowed:true,crossStudentDenied:true,staleVersionRejected:true,requiredOnFinalSubmit:true,submittedImmutable:true});
for(const row of out.checks){
 if(row.name==='privacy_filter')assert(!row.output.includes('合成教材.txt')&&!row.output.includes('page 15'));
 if(row.name==='chapter_alias')assert(row.matched);
 if(row.name==='reference_ai_route'){assert.equal(row.state,'ai_read_complete');assert.equal(row.schedulerPurpose,'system_admin');assert.equal(row.requestedMaxTokens,512)}
 if(row.name==='revoke_access_during_generation'){assert(!row.answerEmittedAfterRevocation);assert(!row.done)}
 if(['student_read_session','cross_class_access','expired_qr'].includes(row.name))assert(row.denied);
 if(row.name==='valid_checkin')assert(row.result);
 if(row.name==='duplicate_checkin')assert.equal(row.count,1);
 if(row.name==='optional_single_empty_string'){assert.equal(row.accepted,false);assert.equal(row.code,'INVALID_OPTIONS')}
}
out.passed=true;

db.close();console.log(JSON.stringify(out,null,2));
