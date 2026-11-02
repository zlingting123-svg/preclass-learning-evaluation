import {createHash,randomUUID} from 'node:crypto';
import type {Express} from 'express';
import {z} from 'zod';
import {ModuleError} from 'course-ai-module';
import type {CourseAi} from './ai.js';
import type {Service} from './service.js';
import type {User} from '../../shared/contracts.js';
import type {SurveyInsight} from '../../shared/survey-insights.js';
import {QuestionnaireService} from './questionnaires.js';
import {AppError,ensure} from './errors.js';
const identifier=z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/);
const body=z.object({classId:identifier,surveyId:identifier,expectedSnapshot:z.string().regex(/^[a-f0-9]{64}$/)}).strict();
type Report=NonNullable<SurveyInsight['report']>;
export class SurveyInsights {
 readonly running=new Set<string>();
 constructor(readonly core:Service,readonly ai?:CourseAi){}
 inspect(user:User,surveyId:string){
  const stats=new QuestionnaireService(this.core).stats(user,surveyId);
  // Exclude individual rows, names/numbers, survey title, IDs and all free-text responses.
  const summary={rosterSize:stats.students.length,submittedInRoster:stats.students.filter(s=>s.status==='已提交').length,
   denominator:'每题有效作答为分母；多选合计可超过100%；当前名单与累计答卷口径可能不同',
   questions:stats.questions.map((q,i)=>({number:i+1,type:q.type,answered:q.answered,...(q.type==='text'?{freeTextOmitted:true}:{title:q.title,options:q.counts.map((c,j)=>({code:String(j+1),label:c.name,count:c.value,percentage:q.answered?Math.round(c.value/q.answered*1000)/10:null}))})}))};
  const prompt=JSON.stringify(summary),snapshot=createHash('sha256').update('survey-insights-v1\n'+prompt).digest('hex');
  const key=surveyId+':'+snapshot;
  const report=this.core.store.get<Report>('survey_insight',key)??null;
  const hasAnswers=stats.questions.some(q=>q.type!=='text'&&q.answered>0);
  const result:SurveyInsight={snapshot,status:this.running.has(key)?'pending':hasAnswers?'ready':'empty',report,choiceQuestions:stats.questions.filter(q=>q.type!=='text').length,textQuestions:stats.questions.filter(q=>q.type==='text').length,submittedInRoster:summary.submittedInRoster,rosterSize:summary.rosterSize};
  return {key,prompt,result,classId:stats.survey.classId};
 }
 async generate(user:User,token:string,input:unknown){
  const b=body.parse(input),state=this.inspect(user,b.surveyId);
  ensure(state.classId===b.classId,403,'FORBIDDEN','问卷与班级不匹配');
  ensure(state.result.snapshot===b.expectedSnapshot,409,'STALE_STATS','统计数据已更新，请刷新后再分析');
  ensure(state.result.status!=='empty',409,'NO_CHOICE_ANSWERS','暂无可分析的选择题答卷');
  if(state.result.report)return state.result;
  ensure(!this.running.has(state.key),409,'ANALYSIS_RUNNING','该问卷正在分析，请稍后读取结果');
  const ai=this.ai;ensure(ai,503,'AI_NOT_CONNECTED','AI服务尚未启用，请先配置问卷分析用途');
  ensure(ai.gateway.deployments.some(d=>d.purposes.includes('teacher_analytics')),503,'ANALYTICS_POOL_REQUIRED','请在API管理配置教师统计分析用途');
  this.running.add(state.key);const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),ai.gateway.policy.requestTimeoutMs);
  try{
   const principal=await ai.gateway.deps.identity.verify(token);
   const request={courseId:b.classId,question:state.prompt,clientRequestId:randomUUID(),purpose:'teacher_analytics' as const};
   const requestId=await ai.gateway.prepare(principal,request);let text='',completed=false,failure='';
   await ai.gateway.answer(principal,request,requestId,controller.signal,async(event,raw)=>{
    const d=raw as {text?:string};if(event==='delta')text+=d.text??'';if(event==='done')completed=true;if(event==='error')failure=(raw as {code?:string}).code??'REQUEST_FAILED';
    ensure(text.length<=100000,502,'ANALYSIS_TOO_LONG','分析结果过长，请调整输出配置');
   });
   ensure(completed&&text.trim(),502,failure||'ANALYSIS_INCOMPLETE','分析未完整完成，请查看用量后重试');
   // Recheck the session and class grant before persisting/returning sensitive results.
   await ai.gateway.deps.authorization.authorize(principal,b.classId,'topics');
   const report:Report={text,generatedAt:new Date().toISOString(),mode:ai.mode,requestId};
   this.core.store.put('survey_insight',state.key,report);ensure(this.inspect(user,b.surveyId).result.snapshot===state.result.snapshot,409,'STALE_STATS','生成期间答卷已更新，请刷新后分析最新统计');return {...state.result,report};
  }catch(e){if(e instanceof ModuleError)throw new AppError(e.status,e.code,'AI解读未完成，请检查分析用途、余额或用量状态后重试');throw e;}
  finally{clearTimeout(timer);this.running.delete(state.key)}
 }
}
export function surveyInsightRoutes(app:Express,core:Service,ai?:CourseAi){
 const insights=new SurveyInsights(core,ai),ok=(res:any,data:unknown)=>res.json({ok:true,data,requestId:res.locals.requestId});
 app.get('/api/v1/core/surveys/:id/insights',(req,res)=>ok(res,insights.inspect(res.locals.user,identifier.parse(req.params.id)).result));
 app.post('/api/v1/core/ai/insights',async(req,res)=>ok(res,await insights.generate(res.locals.user,res.locals.token,req.body)));
}
