import {a as React} from './react-DFdtPfhg.js';
export function QuestionInsight({surveyId,questionId,request,Answer}:any){
 const [state,setState]=React.useState(null),[busy,setBusy]=React.useState(false),[error,setError]=React.useState(''),[copied,setCopied]=React.useState(false);
 const url=`/core/surveys/${encodeURIComponent(surveyId)}/question-insights/${encodeURIComponent(questionId)}`;
 const load=()=>request('GET',url).then(setState).catch(e=>setError(e.message||'读取失败'));
 React.useEffect(()=>{let active=true;setState(null);setError('');request('GET',url).then(v=>{if(active)setState(v)}).catch(e=>{if(active)setError(e.message||'读取失败')});return()=>{active=false}},[url]);
 async function generate(){if(!state||busy)return;setBusy(true);setError('');try{setState(await request('POST',url,{body:{expectedSnapshot:state.snapshot}}))}catch(e){setError(e.message||'解读失败，请稍后重试')}finally{setBusy(false)}}
 async function copy(){try{await navigator.clipboard.writeText(state.report.text);setCopied(true)}catch{setError('复制失败，请手动选择文字复制')}}
 return <section className="qi-panel" aria-label="本题 AI 解读"><header><div><span>AI INSIGHTS</span><h3>本题 AI 解读</h3><p>结合本题统计，帮助发现回答分布与教学启示。</p></div>{state?.report?<button type="button" onClick={copy}>{copied?'已复制':'复制解读'}</button>:<button type="button" disabled={!state||busy||state.status==='empty'||state.status==='pending'} onClick={generate}>{busy?'正在解读…':state?.status==='pending'?'正在解读…':'生成本题解读'}</button>}</header><p className="qi-basis">仅使用本题题目、选项及匿名汇总人数；解读供教师核对。</p>{error&&<p role="alert" className="qi-error">{error} <button type="button" onClick={()=>{setError('');load()}}>重新读取</button></p>}{busy&&<p role="status">正在生成本题解读，请稍候…</p>}{state?.status==='empty'&&<p>本题暂无有效作答，暂不能生成解读。</p>}{state?.report&&<><p className="qi-meta">{state.report.mode==='mock'?'模拟结果':'模型生成 · 待教师核实'} · {new Date(state.report.generatedAt).toLocaleString()}</p><Answer text={state.report.text}/></>}</section>
}
