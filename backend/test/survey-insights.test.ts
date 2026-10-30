import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {resolve} from 'node:path';
import {SqliteStore} from '../src/store.js';
import {Service} from '../src/service.js';
import {LocalAuth} from '../src/auth.js';
import {QuestionnaireService} from '../src/questionnaires.js';
import {SurveyInsights} from '../src/survey-insights.js';
import {createCourseAi} from '../src/ai.js';
import {messages} from '../../ai-module/src/deepseek.js';
test('问卷AI：匿名快照、准确口径、权限、用途路由、缓存与更新',async()=>{
 const store=new SqliteStore(':memory:'),core=new Service(store),auth=new LocalAuth(store),pw=randomUUID();
 const teacher=await auth.createUser('insights_teacher',pw,'模拟老师','teacher'),other=await auth.createUser('insights_other',pw,'其他老师','teacher'),student=await auth.createUser('0012345',pw,'学生秘密姓名','student');const c=core.createClass(teacher,'私密班名');core.join(student,c.joinCode!);const qs=new QuestionnaireService(core);
 const survey=qs.save(teacher,{classId:c.id,title:'私密问卷标题',questions:[{id:'m',title:'学习形式',type:'multiple',options:['阅读','讨论'],required:false},{id:'t',title:'意见',type:'text',options:[],required:false}],expectedVersion:0,deadlineAt:null,durationMinutes:null});qs.transition(teacher,survey.id,survey.version,'publish');
 const ai=createCourseAi(core,auth,{ledgerPath:':memory:',fingerprintKey:'x'.repeat(64),configPath:resolve('../ai-module/config/mock.example.json'),delayMs:0});ai.gateway.deployments[0].purposes.push('teacher_analytics');
 const service=new SurveyInsights(core,ai),token=(await auth.login({username:'insights_teacher',password:pw})).accessToken;let captured='',calls=0;const provider=ai.gateway.deployments[0].provider;
 provider.stream=async function*(input){calls++;captured=JSON.stringify(messages(input));await new Promise(r=>setTimeout(r,25));yield {type:'delta',text:'## 主要发现\n题号1的两种方式均被选择。\n## 教学建议\n可考虑结合阅读与讨论。\n## 解读限制\n样本有限，不能推断能力。'};yield {type:'usage',usage:{inputTokens:100,outputTokens:40,cacheHitTokens:0}};yield {type:'finish',reason:'stop'}};
 try{
  assert.equal(service.inspect(teacher,survey.id).result.status,'empty');assert.throws(()=>service.inspect(student,survey.id));assert.throws(()=>service.inspect(other,survey.id));
  qs.start(student,survey.id);qs.submit(student,survey.id,{m:['阅读','讨论'],t:'电话13812345678 学生秘密姓名'});
  const state=service.inspect(teacher,survey.id);const summary=JSON.parse(state.prompt);assert.equal(summary.questions[0].options[0].percentage,100);assert.equal(summary.questions[0].options[1].percentage,100);assert.equal(summary.questions[1].freeTextOmitted,true);
  for(const secret of ['13812345678','学生秘密姓名','0012345','私密班名','私密问卷标题'])assert.ok(!state.prompt.includes(secret));
  const input={classId:c.id,surveyId:survey.id,expectedSnapshot:state.result.snapshot};
  await assert.rejects(()=>service.generate(teacher,token,{...input,expectedSnapshot:'0'.repeat(64)}),/刷新/);
  const pending=service.generate(teacher,token,input);await assert.rejects(()=>service.generate(teacher,token,input),/正在分析/);const result=await pending;assert.ok(result.report?.text.includes('主要发现'));assert.equal(calls,1);
  await service.generate(teacher,token,input);assert.equal(calls,1);assert.equal(ai.store.rows()[0].purpose,'teacher_analytics');assert.match(captured,/问卷分析助理/);assert.ok(!captured.includes('学生秘密姓名'));assert.deepEqual(ai.store.topics(c.id,1),[]);
  const again=new SurveyInsights(core,ai);assert.ok(again.inspect(teacher,survey.id).result.report);
  const peer={id:'peer',role:'student' as const,displayName:'另一个秘密'};store.put('user',peer.id,peer);core.join(peer,c.joinCode!);qs.start(peer,survey.id);qs.submit(peer,survey.id,{m:['阅读']});const next=service.inspect(teacher,survey.id);assert.notEqual(next.result.snapshot,input.expectedSnapshot);assert.equal(next.result.report,null);
  ai.gateway.deployments[0].purposes=['student_qa'];await assert.rejects(()=>service.generate(teacher,token,{...input,expectedSnapshot:next.result.snapshot}),/配置教师统计分析用途/);assert.equal(calls,1);
 }finally{ai.close();store.close()}
});
