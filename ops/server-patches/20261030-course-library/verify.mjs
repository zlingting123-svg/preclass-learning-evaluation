import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,copyFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {randomUUID,createHash} from 'node:crypto';
const root='/home/ubuntu/preclass-library-20261030',release='/opt/preclass/releases/20261030-course-library';
const prepared=JSON.parse(readFileSync(root+'/preparation.json','utf8'));assert(prepared.passed);
const load=name=>import(pathToFileURL(release+'/backend/dist/backend/src/'+name+'.js'));
const [{SqliteStore},{Service},{LocalAuth},{createApp},{createCourseAi},{importedEvidence}]=await Promise.all(['store','service','auth','app','ai','knowledge-import'].map(load));
const store=new SqliteStore(':memory:'),core=new Service(store),auth=new LocalAuth(store),password=randomUUID();
const admin=await auth.createUser('library_test_admin',password,'模拟管理员','admin');
const teacher=await auth.createUser('library_test_teacher',password,'模拟教师','teacher');
const student=await auth.createUser('library_test_student',password,'模拟学生','student');
const course=core.createClass(teacher,'资料库隔离验证');core.join(student,course.joinCode);
const referenceRoot=root+'/http-state/reference-files';mkdirSync(referenceRoot,{recursive:true});process.env.DB_PATH=root+'/http-state/unused.sqlite';
const production=new DatabaseSync('/var/lib/preclass/app.sqlite',{readOnly:true});
for(const file of prepared.files){
 let source=JSON.parse(readFileSync(root+'/prepared/'+file.id+'/source.json','utf8'));
 if(file.reused){source=JSON.parse(production.prepare("SELECT payload FROM records WHERE kind='ai_imported_source' AND id=?").get(file.id).payload)}
 store.put('ai_imported_source',file.id,source);
 const job={id:file.id,title:file.title,name:file.path.split('/').at(-1),size:file.bytes,received:file.bytes,status:file.aiReadAlreadyComplete?'ai_read_complete':'waiting_ai',pages:file.pageCount,ocrPages:file.ocrPages.length,createdAt:'2026-10-30T00:00:00.000Z',retrievalIndexed:true};
 store.put('reference_file',file.id,job);copyFileSync(file.original,referenceRoot+'/'+file.id+'.original');
}
production.close();
store.put('ai_web_policy','__all_classes__',{classId:'__all_classes__',enabled:false,domains:[]});
const scopeQuestion='专用隔离口令范围验证';
store.put('ai_imported_source','private-test',{id:'private-test',classId:'another-class',title:'另一个班级的资料',version:'1',state:'published',chunks:[scopeQuestion]});
store.put('ai_imported_source','withdrawn-test',{id:'withdrawn-test',classId:'__all_classes__',title:'撤回资料',version:'1',state:'withdrawn',chunks:[scopeQuestion]});
assert(!importedEvidence(store,course.id,scopeQuestion).some(e=>/^(private-test|withdrawn-test)_/.test(e.id)));
assert(importedEvidence(store,'another-class',scopeQuestion).some(e=>e.id.startsWith('private-test_')));
store.remove('ai_imported_source','private-test');store.remove('ai_imported_source','withdrawn-test');
const queries=['环境影响评价的基本程序有哪些阶段？','生态环境问题的主要类型有哪些？','环境容量和环境承载力是什么？','地表水环境影响评价如何确定评价等级？','大气环境影响评价中的估算模型是什么？','声环境影响评价如何进行噪声预测？','生态影响评价的主要内容有哪些？','土壤环境影响评价的工作等级如何划分？','规划环境影响评价与建设项目环境影响评价有什么区别？','排污许可制度与环境影响评价制度如何衔接？','环境管理案例如何识别主要环境问题？'];
const samples=queries.map(question=>{const results=importedEvidence(store,course.id,question);assert(results.length>0,question);return {question,results:results.map(e=>({title:e.title,score:e.score,pageTagged:/第\d+页/.test(e.content)}))}});
const config=JSON.parse(readFileSync(release+'/ai-module/config/mock.example.json','utf8'));config.mode='mock';config.policy.dailyRequests=0;
const configPath=root+'/http-state/mock.json';writeFileSync(configPath,JSON.stringify(config));
const ai=createCourseAi(core,auth,{configPath,ledgerPath:root+'/http-state/mock-ledger.sqlite',fingerprintKey:randomUUID()+randomUUID(),delayMs:1});
const captures=[];for(const d of ai.gateway.deployments){const stream=d.provider.stream.bind(d.provider);d.provider.stream=async function*(input){captures.push(input);yield*stream(input)}}
const server=createApp(core,auth,ai).listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
const base='http://127.0.0.1:'+server.address().port;
const call=async(path,token,body)=>{const r=await fetch(base+'/api/v1'+path,{method:body?'POST':'GET',headers:{...(token?{Authorization:'Bearer '+token}:{}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});return {status:r.status,body:await r.json()}};
try{
 const sessions={};for(const [role,username] of [['admin','library_test_admin'],['teacher','library_test_teacher'],['student','library_test_student']]){const r=await call('/auth/login',null,{username,password});assert.equal(r.status,200);sessions[role]=r.body.data.accessToken}
 const listing=await call('/admin/reference-files',sessions.admin);assert.equal(listing.status,200);assert.equal(listing.body.data.length,12);
 assert.equal((await call('/admin/reference-files',sessions.teacher)).status,403);
 assert.equal((await call('/admin/reference-files',sessions.student)).status,403);
 const knowledge=await call('/admin/knowledge',sessions.admin);assert.equal(knowledge.status,200);assert.equal(knowledge.body.data.filter(s=>s.state==='published').length,12);
 const file=prepared.files[0],download=await fetch(base+'/api/v1/admin/reference-files/'+file.id+'/download',{headers:{Authorization:'Bearer '+sessions.admin}});
 assert.equal(download.status,200);assert.equal(createHash('sha256').update(Buffer.from(await download.arrayBuffer())).digest('hex'),file.sha256);
 assert.equal((await call('/admin/reference-files/'+file.id+'/download',sessions.student)).status,403);
 const chat=await call('/core/ai/chat',sessions.student,{classId:course.id,messages:[{role:'user',text:queries[0]}],clientRequestId:randomUUID()});assert.equal(chat.status,200);
 assert(captures.length===1&&captures[0].evidence.length>0);assert(captures[0].evidence.some(e=>prepared.files.some(f=>e.id.startsWith(f.id+'_'))));
 assert(captures[0].evidence.every(e=>e.scopeId===course.id));
 const result={passed:true,files:12,pages:prepared.pages,newFiles:prepared.new,reused:prepared.reused,publishedSources:12,adminListHTTP:200,adminDownloadHash:true,studentAndTeacherAdminDenied:true,scopedPrivateAndWithdrawnExcluded:true,queries:samples,mockChatHTTP:200,modelReceivedEvidence:true,realModelCalls:0,productionDataWritten:false,frontendChanged:false,retrievalCalibrated:false,limits:'sample retrieval integration with synthetic accounts; not pedagogical correctness or full retrieval calibration'};
 writeFileSync(root+'/verification.json',JSON.stringify(result,null,2));console.log(JSON.stringify({passed:true,files:12,pages:prepared.pages,sampleQueries:samples.length,modelReceivedEvidence:true,realModelCalls:0}));
}finally{await new Promise(resolve=>server.close(resolve));ai.close();store.close()}
