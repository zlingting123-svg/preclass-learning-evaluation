import {useEffect,useState} from 'react';
import {Link} from 'react-router-dom';
import type {ChatThread} from '@shared/conversations';
import {getCurrentUser} from '../../services/api';
import {AiStatusPanel} from './AiStatus';
import {useConversations} from './useConversations';
import {DeleteConversation} from './DeleteConversation';
export function CourseAssistant({classId}:{classId:string}){
 const chat=useConversations(classId),[input,setInput]=useState(''),[deleting,setDeleting]=useState<ChatThread|null>(null);
 useEffect(()=>{setInput('');setDeleting(null)},[classId,chat.current?.id]);
 async function send(){if(!input.trim()||chat.busy||chat.loading)return;const text=input;setInput('');await chat.send(text)}
 return <section className="core"><Link to="/">返回班级</Link><h1>{getCurrentUser()?.role==='student'?'AI 问答助手':'课程 AI 使用统计'}</h1><AiStatusPanel classId={classId} revision={chat.revision}/>
 {getCurrentUser()?.role==='student'&&<><div className="saved-chat-layout"><aside className="saved-chat-list" aria-label="历史对话"><button disabled={chat.busy||chat.loading} onClick={()=>void chat.newThread()}>＋ 开启新对话</button>{chat.threads.map(t=><div className="saved-chat-row" key={t.id}><button className={chat.current?.id===t.id?'active':''} disabled={chat.busy||chat.loading} onClick={()=>void chat.selectThread(t.id)}>{t.title}</button><button aria-label={'删除对话：'+t.title} disabled={chat.busy||chat.loading} onClick={()=>setDeleting(t)}>删除</button></div>)}</aside><div>
 {deleting&&<DeleteConversation title={deleting.title} busy={chat.loading} onCancel={()=>setDeleting(null)} onConfirm={()=>{void chat.removeThread(deleting.id);setDeleting(null)}}/>}
 {chat.loading&&<p role="status">正在同步账号对话…</p>}{chat.error&&<p role="alert">{chat.error}</p>}
 <div className="ai-suggestions"><button onClick={()=>setInput('环境评价的作用是什么？')}>测试课程问题</button><button onClick={()=>setInput('它有什么作用？')}>测试接续追问</button></div>
 <div role="log" aria-label="对话消息">{chat.current?.messages.map(m=><article className="card" key={m.id}><strong>{m.role==='user'?'我':'课程助手'}</strong><p className="core-pre">{m.text}</p>{m.sources?.length?<small>参考资料：{m.sources.map(s=>s.title).join('、')}</small>:null}{m.role==='assistant'&&['error','cancelled','interrupted'].includes(m.outcome)&&<p className="muted">这次回答未完成，历史已保留；继续提问会发起新请求。</p>}</article>)}</div>
 <form onSubmit={e=>{e.preventDefault();void send()}}><label>课程问题<textarea maxLength={5000} rows={3} value={input} disabled={chat.busy||chat.loading} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();void send()}}}/></label>{chat.busy?<button type="button" disabled={!chat.canStop} onClick={chat.stop}>{chat.canStop?"停止发送":"等待生成中…"}</button>:<button className="primary" disabled={!input.trim()||chat.loading}>发送</button>} <button type="button" disabled={chat.canStop||chat.loading} onClick={()=>void chat.refresh()}>刷新已保存对话</button></form>
 </div></div></>}
 </section>;
}
