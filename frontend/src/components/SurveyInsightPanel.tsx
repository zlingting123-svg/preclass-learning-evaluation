import {useEffect,useState} from 'react';
import type {SurveyInsight} from '@shared/survey-insights';
import {apiRequest} from '../services/httpClient';
import {ChatAnswer} from './ChatAnswer';
import './survey-insight.css';
export function SurveyInsightPanel({surveyId,classId,revision}:{surveyId:string;classId:string;revision:unknown}){
 const [state,setState]=useState<SurveyInsight|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{let active=true;setState(null);setError('');apiRequest<SurveyInsight>('GET',`/core/surveys/${surveyId}/insights`).then(s=>{if(active)setState(s)}).catch(e=>{if(active)setError(e.message)});return()=>{active=false}},[surveyId,revision]);
 async function generate(){if(!state||busy)return;setBusy(true);setError('');try{setState(await apiRequest<SurveyInsight>('POST','/core/ai/insights',{body:{classId,surveyId,expectedSnapshot:state.snapshot}}))}catch(e){setError(e instanceof Error?e.message:'解读失败')}finally{setBusy(false)}}
 return <section className="survey-insight" aria-labelledby="survey-insight-title"><header><div><span>TEACHER / INSIGHTS</span><h2 id="survey-insight-title">AI 问卷解读</h2><p>从回答分布到教学思路，每条发现都应对照上方统计。</p></div><button className="primary" disabled={!state||busy||state.status==='empty'||!!state.report||state.status==='pending'} onClick={generate}>{busy?'正在分析，请稍候…':state?.report?'当前统计已解读':state?.status==='pending'?'该问卷正在分析':'生成问卷解读'}</button></header>
 <div className="insight-basis"><strong>分析依据</strong><p>{state?`${state.choiceQuestions} 道选择题 · 当前名单已提交 ${state.submittedInRoster}/${state.rosterSize} 人`:'正在读取统计快照…'}</p><p>仅发送题干、选项及汇总人数；不发送学生名单、学号、私人对话和文字题原答。不使用尚未上传的资料库。</p></div>
 {error&&<p role="alert" className="insight-error">{error}<button onClick={()=>apiRequest<SurveyInsight>('GET',`/core/surveys/${surveyId}/insights`).then(setState).catch(e=>setError(e.message))}>重新读取状态</button></p>}
 {busy&&<p role="status">正在调用模型解释统计，可能需要一至三分钟；请勿重复点击。费用与用量沿用服务端配置。</p>}
 {state?.status==='empty'&&<p>暂无已提交的选择题回答，暂不调用模型。文字题保留在原明细中。</p>}
 {state?.report?<><p className="insight-meta">{state.report.mode==='mock'?'模拟上游验证，非真实AI解读':'模型生成 · 待教师核实'} · {new Date(state.report.generatedAt).toLocaleString()} · 当前统计快照</p><ChatAnswer text={state.report.text}/><details><summary>核对与使用说明</summary><p>人数、比例与完成率以上方统计为准。AI建议供教师参考，不代表学生能力评分或正式教学结论。相同统计复用已保存的解读；答卷更新后刷新统计可生成新解读。</p></details></>:!busy&&state?.status!=='empty'&&<div className="insight-empty"><strong>主要发现 → 教学建议 → 解读限制</strong><p>点击生成后展示结果。尚未生成时，不显示模拟结论。</p></div>}
 </section>;
}
