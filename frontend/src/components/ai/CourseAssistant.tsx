import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { askCourse } from '../../services/courseAi';
import { getCurrentUser } from '../../services/api';
import { AiStatusPanel } from './AiStatus';
interface Message { id: string; role: 'user' | 'assistant'; text: string; failed?: boolean; sources?: Array<{id:string; title:string}>; }
export function CourseAssistant({classId}: {classId:string}) {
  const [input,setInput]=useState(''),[messages,setMessages]=useState<Message[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState(''),[revision,setRevision]=useState(0);
  const controller=useRef<AbortController|null>(null),busyRef=useRef(false);
  useEffect(()=>()=>controller.current?.abort(),[]);
  useEffect(()=>{setMessages([]);setInput('');setError('');return()=>controller.current?.abort();},[classId]);
  async function send(text:string, retryId?:string) {
    if(busyRef.current||!text.trim())return;
    busyRef.current=true;setBusy(true);setError('');setInput('');
    const id=retryId??crypto.randomUUID(),answerId=crypto.randomUUID(),abort=new AbortController();controller.current=abort;
    setMessages(ms=>retryId?ms.map(m=>m.id===id?{...m,failed:false}:m):[...ms,{id,role:'user',text}]);
    try {
      await askCourse(classId,text,id,abort.signal,({event,data})=>{
        if(abort.signal.aborted)return;
        if(event==='sources')setMessages(ms=>[...ms,{id:answerId,role:'assistant',text:'',sources:data.sources}]);
        if(['delta','refusal','insufficient_evidence'].includes(event))setMessages(ms=>ms.some(m=>m.id===answerId)?ms.map(m=>m.id===answerId?{...m,text:m.text+(data.text??data.message??'')}:m):[...ms,{id:answerId,role:'assistant',text:data.text??data.message??''}]);
      });
    }catch(e){setMessages(ms=>ms.map(m=>m.id===id?{...m,failed:true}:m));setError(abort.signal.aborted?'已停止。若已调用模型，用量可能待对账，请勿连续重试。':e instanceof Error?e.message:'请求失败');}
    finally{busyRef.current=false;setBusy(false);controller.current=null;setRevision(n=>n+1);}
  }
  return <section className="core"><Link to="/">返回班级</Link><h1>{getCurrentUser()?.role==='student'?'AI 问答助手':'课程 AI 使用统计'}</h1>
    <AiStatusPanel classId={classId} revision={revision}/>
    {getCurrentUser()?.role==='student'&&<>
      <div className="ai-suggestions"><button onClick={()=>setInput('环境评价的作用是什么？')}>测试课程问题</button><button onClick={()=>setInput('请推荐游戏装备')}>测试范围拒答</button></div>
      <div role="log" aria-label="对话消息">{messages.map(m=><article className="card" key={m.id}><strong>{m.role==='user'?'我':'课程助手'}</strong><p className="core-pre">{m.text}</p>{m.sources?.length?<small>参考资料：{m.sources.map(s=>s.title).join('、')}</small>:null}{m.failed&&<button disabled={busy} onClick={()=>send(m.text,m.id)}>检查后重试</button>}</article>)}</div>
      {error&&<p role="alert">{error}</p>}
      <form onSubmit={e=>{e.preventDefault();void send(input)}}><label>课程问题<textarea maxLength={5000} rows={3} value={input} disabled={busy} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();void send(input)}}}/></label>
      {busy?<button type="button" onClick={()=>controller.current?.abort()}>停止发送</button>:<button className="primary" disabled={!input.trim()}>发送</button>}
      <button type="button" disabled={busy} onClick={()=>setMessages([])}>清空本页对话</button></form>
    </>}
  </section>;
}
