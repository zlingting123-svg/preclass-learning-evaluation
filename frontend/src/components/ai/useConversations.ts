import {useCallback,useEffect,useRef,useState} from 'react';
import type {ChatDetail,ChatList,ChatThread} from '@shared/conversations';
import {apiRequest} from '../../services/httpClient';
import {askThread} from '../../services/courseAi';
import {getCurrentUser} from '../../services/api';
export function useConversations(classId:string){
 const enabled=getCurrentUser()?.role==='student',userId=getCurrentUser()?.id;
 const [threads,setThreads]=useState<ChatThread[]>([]),[current,setCurrent]=useState<ChatDetail|null>(null),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState(''),[revision,setRevision]=useState(0);
 const controller=useRef<AbortController|null>(null),busyRef=useRef(false),changing=useRef(false),epoch=useRef(0),selected=useRef<string|null>(null);
 const load=useCallback(async(preferred?:string|null)=>{
  const generation=epoch.current;const list=await apiRequest<ChatList>('GET','/core/ai/threads?classId='+encodeURIComponent(classId));
  if(generation!==epoch.current)return;
  const id=preferred&&list.items.some(t=>t.id===preferred)?preferred:list.activeId;
  const detail=id?await apiRequest<ChatDetail>('GET','/core/ai/threads/'+id):null;
  if(generation!==epoch.current)return;setThreads(list.items);setCurrent(detail);selected.current=detail?.id??null;
 },[classId]);
 useEffect(()=>{
  ++epoch.current;const generation=epoch.current;controller.current?.abort();busyRef.current=false;changing.current=false;setBusy(false);setThreads([]);setCurrent(null);selected.current=null;setError('');
  if(!enabled||!classId){setLoading(false);return;}
  setLoading(true);void load().catch(e=>{if(generation===epoch.current)setError(e instanceof Error?e.message:'读取历史失败')}).finally(()=>{if(generation===epoch.current){changing.current=false;setLoading(false)}});
  return()=>{++epoch.current;controller.current?.abort()};
 },[classId,userId,enabled,load]);
 // Resume viewing a request still running in another tab, without generating it a second time.
 useEffect(()=>{if(!current?.busy||busy)return;const timer=setTimeout(()=>{void load(current.id).catch(e=>setError(e instanceof Error?e.message:'刷新失败'))},1200);return()=>clearTimeout(timer)},[current,busy,load]);
 async function newThread(){
  if(busyRef.current||changing.current)return;changing.current=true;setLoading(true);setError('');const generation=++epoch.current;
  try{const detail=await apiRequest<ChatDetail>('POST','/core/ai/threads',{body:{classId}});if(generation!==epoch.current)return;setCurrent(detail);selected.current=detail.id;await load(detail.id)}catch(e){if(generation===epoch.current)setError(e instanceof Error?e.message:'创建失败')}finally{if(generation===epoch.current){changing.current=false;setLoading(false)}}
 }
 async function selectThread(id:string){
  if(busyRef.current||changing.current)return;changing.current=true;setLoading(true);setError('');const generation=++epoch.current;
  try{const detail=await apiRequest<ChatDetail>('POST',`/core/ai/threads/${id}/select`,{body:{}});if(generation===epoch.current){setCurrent(detail);selected.current=detail.id}}catch(e){if(generation===epoch.current)setError(e instanceof Error?e.message:'读取失败')}finally{if(generation===epoch.current){changing.current=false;setLoading(false)}}
 }
 async function removeThread(id:string){
  if(busyRef.current||changing.current)return;changing.current=true;setLoading(true);setError('');const generation=++epoch.current;
  try{await apiRequest('DELETE','/core/ai/threads/'+id);if(generation===epoch.current)await load(selected.current===id?null:selected.current)}catch(e){if(generation===epoch.current)setError(e instanceof Error?e.message:'删除失败')}finally{if(generation===epoch.current){changing.current=false;setLoading(false)}}
 }
 async function send(text:string){
  if(busyRef.current||changing.current||loading||current?.busy||!text.trim())return;
  const generation=++epoch.current,abort=new AbortController();controller.current=abort;busyRef.current=true;setBusy(true);setError('');
  let threadId=selected.current;
  try{
   if(!threadId){const detail=await apiRequest<ChatDetail>('POST','/core/ai/threads',{body:{classId}});if(generation!==epoch.current)return;threadId=detail.id;selected.current=threadId;setCurrent(detail);}
   const requestId=crypto.randomUUID(),userMessage={id:requestId+':user',role:'user' as const,text:text.trim(),outcome:'pending' as const},answerId=requestId+':assistant';
   setCurrent(c=>c?{...c,busy:true,messages:[...c.messages,userMessage]}:c);
   await askThread(threadId,text.trim(),requestId,abort.signal,({event,data})=>{
    if(abort.signal.aborted||generation!==epoch.current)return;
    setCurrent(c=>{
     if(!c||c.id!==threadId)return c;
     if(event==='sources')return {...c,messages:[...c.messages,{id:answerId,role:'assistant',text:'',outcome:'pending',sources:data.sources}]};
     if(['delta','refusal','insufficient_evidence'].includes(event)){
      const text=data.text??data.message??'';return {...c,messages:c.messages.some(m=>m.id===answerId)?c.messages.map(m=>m.id===answerId?{...m,text:m.text+text}:m):[...c.messages,{id:answerId,role:'assistant',text,outcome:'pending'}]};
     }return c;
    });
   });
  }catch(e){if(generation===epoch.current)setError(abort.signal.aborted?'已停止生成，记录会保留。若已调用模型，用量可能待对账。':e instanceof Error?e.message:'提问失败');}
  finally{
   if(generation===epoch.current){try{await load(threadId)}catch(e){setError(e instanceof Error?e.message:'同步失败，请刷新查看已保存记录');setCurrent(c=>c?{...c,busy:false}:c)}busyRef.current=false;setBusy(false);controller.current=null;setRevision(n=>n+1)}
  }
 }
 async function refresh(){
  if(busyRef.current||changing.current)return;changing.current=true;const generation=++epoch.current;setLoading(true);setError('');
  try{await load(selected.current)}catch(e){if(generation===epoch.current)setError(e instanceof Error?e.message:'刷新失败')}finally{if(generation===epoch.current){changing.current=false;setLoading(false)}}
 }
 return {threads,current,canStop:busy,busy:busy||!!current?.busy,loading,error,revision,newThread,selectThread,removeThread,send,stop:()=>controller.current?.abort(),refresh};
}
