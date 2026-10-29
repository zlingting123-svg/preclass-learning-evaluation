import {randomUUID} from 'node:crypto';
import type {User} from '../../shared/contracts.js';
import type {ChatOutcome,ChatSource,ChatDetail,ChatList} from '../../shared/conversations.js';
import type {HistoryMessage} from 'course-ai-module';
import {Service,keyFor} from './service.js';
import {ensure} from './errors.js';
interface Thread {id:string;ownerId:string;classId:string;title:string;createdAt:string;updatedAt:string}
interface Turn {sequence:number;id:string;threadId:string;clientRequestId:string;question:string;answer:string;outcome:ChatOutcome;sources:ChatSource[];createdAt:string}
/** Student-only transcript store, separate from the billing ledger and teacher aggregates. */
export class Conversations {
 readonly running=new Map<string,AbortController>();
 constructor(readonly core:Service){
  // A process restart cannot resume an in-flight generation or silently regenerate it.
  core.store.transaction(()=>{for(const turn of core.store.all<Turn>('ai_turn'))if(turn.outcome==='pending')core.store.put('ai_turn',turn.id,{...turn,outcome:'interrupted'});});
 }
 private access(user:User,id:string):Thread {
  ensure(user.role==='student'||user.role==='teacher',403,'FORBIDDEN','仅师生可使用课程对话');const thread=this.core.store.get<Thread>('ai_thread',id);
  ensure(thread?.ownerId===user.id,404,'THREAD_NOT_FOUND','对话不存在或已删除');this.core.classAccess(user,thread.classId);return thread;
 }
 private turns(id:string){return this.core.store.all<Turn>('ai_turn').filter(t=>t.threadId===id).sort((a,b)=>a.sequence-b.sequence||a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id));}
 private summary(thread:Thread){const turns=this.turns(thread.id);return {id:thread.id,classId:thread.classId,title:thread.title,createdAt:thread.createdAt,updatedAt:thread.updatedAt,busy:turns.some(t=>t.outcome==='pending'),messageCount:turns.reduce((n,t)=>n+1+(t.answer?1:0),0)};}
 list(user:User,classId:string):ChatList {
  ensure(user.role==='student'||user.role==='teacher',403,'FORBIDDEN','仅师生可使用课程对话');this.core.classAccess(user,classId);
  const items=this.core.store.all<Thread>('ai_thread').filter(t=>t.ownerId===user.id&&t.classId===classId).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)||b.id.localeCompare(a.id)).map(t=>this.summary(t));
  const selected=this.core.store.get<{threadId:string}>('ai_chat_selection',keyFor(user.id,classId))?.threadId;
  return {items,activeId:items.some(t=>t.id===selected)?selected!:items[0]?.id??null};
 }
 create(user:User,classId:string):ChatDetail {
  ensure(user.role==='student'||user.role==='teacher',403,'FORBIDDEN','仅师生可使用课程对话');this.core.classAccess(user,classId);
  return this.core.store.transaction(()=>{
   ensure(this.list(user,classId).items.length<100,409,'THREAD_LIMIT','本课程最多保留100条对话，请先删除不需要的对话');
   const now=new Date().toISOString(),thread:Thread={id:randomUUID(),ownerId:user.id,classId,title:'新的课程对话',createdAt:now,updatedAt:now};
   this.core.store.put('ai_thread',thread.id,thread);this.select(user,thread.id);return this.detail(user,thread.id);
  });
 }
 detail(user:User,id:string):ChatDetail {const thread=this.access(user,id);return {...this.summary(thread),messages:this.turns(id).flatMap(t=>[
  {id:t.clientRequestId+':user',role:'user' as const,text:t.question,outcome:t.outcome},
  ...(t.answer||t.outcome!=='pending'?[{id:t.clientRequestId+':assistant',role:'assistant' as const,text:t.answer,outcome:t.outcome,sources:t.sources}]:[]),
 ])};}
 select(user:User,id:string):ChatDetail {const t=this.access(user,id);this.core.store.put('ai_chat_selection',keyFor(user.id,t.classId),{threadId:id});this.core.store.put('ai_chat_last',user.id,{classId:t.classId,threadId:id});return this.detail(user,id);}
 lastContext(user:User){
  ensure(user.role==='student'||user.role==='teacher',403,'FORBIDDEN','仅师生可使用课程对话');const saved=this.core.store.get<{classId:string;threadId:string}>('ai_chat_last',user.id);
  const thread=saved&&this.core.store.get<Thread>('ai_thread',saved.threadId);
  return saved&&thread?.ownerId===user.id&&this.core.classes(user).some(c=>c.id===saved.classId)?saved:{classId:null,threadId:null};
 }
 remove(user:User,id:string){
  const thread=this.access(user,id);
  this.core.store.transaction(()=>{for(const t of this.turns(id))this.core.store.remove('ai_turn',t.id);this.core.store.remove('ai_thread',id);
   const key=keyFor(user.id,thread.classId);if(this.core.store.get<{threadId:string}>('ai_chat_selection',key)?.threadId===id)this.core.store.remove('ai_chat_selection',key);
   if(this.core.store.get<{threadId:string}>('ai_chat_last',user.id)?.threadId===id){const next=this.list(user,thread.classId).activeId;if(next)this.select(user,next);else this.core.store.remove('ai_chat_last',user.id);}
  });this.running.get(id)?.abort();this.running.delete(id);
 }
 begin(user:User,id:string,clientRequestId:string,question:string){
  const thread=this.access(user,id);return this.core.store.transaction(()=>{
   const turns=this.turns(id);ensure(!turns.some(t=>t.clientRequestId===clientRequestId),409,'REQUEST_ALREADY_HANDLED','此问题已处理，请勿重复发送');
   ensure(!turns.some(t=>t.outcome==='pending'),409,'THREAD_BUSY','这条对话正在生成回答，请稍候');ensure(turns.length<100,409,'TURN_LIMIT','该对话已达100轮，请开启新对话');
   const turn:Turn={sequence:turns.length+1,id:keyFor(id,clientRequestId),threadId:id,clientRequestId,question,answer:'',outcome:'pending',sources:[],createdAt:new Date().toISOString()};
   this.core.store.put('ai_turn',turn.id,turn);this.core.store.put('ai_thread',id,{...thread,title:turns.length?thread.title:question.slice(0,48),updatedAt:turn.createdAt});this.select(user,id);return turn;
  });
 }
 finish(threadId:string,turnId:string,answer:string,outcome:ChatOutcome,sources:ChatSource[]){
  // Deletion wins over every late success/error callback; never recreate removed records.
  const thread=this.core.store.get<Thread>('ai_thread',threadId),turn=this.core.store.get<Turn>('ai_turn',turnId);if(!thread||!turn)return;
  this.core.store.transaction(()=>{this.core.store.put('ai_turn',turnId,{...turn,answer:answer.slice(0,24000),outcome,sources});this.core.store.put('ai_thread',threadId,{...thread,updatedAt:new Date().toISOString()});});
 }
 context(user:User,id:string,maxBytes=24000):HistoryMessage[]{
  this.access(user,id);const history:HistoryMessage[]=[];let bytes=2;
  const clip=(text:string,budget:number)=>{
   if(Buffer.byteLength(text)<=budget)return text;
   const chars=Array.from(text);let left=0,right=chars.length;
   while(left<right){const mid=Math.ceil((left+right)/2);if(Buffer.byteLength(chars.slice(0,mid).join(''))<=Math.max(0,budget-80))left=mid;else right=mid-1;}
   return chars.slice(0,left).join('')+'\n[较长历史已截取，请勿假定包含完整内容]';
  };
  for(const turn of this.turns(id).filter(t=>t.outcome==='done').slice(-6).reverse()){
   const remaining=maxBytes-bytes;if(remaining<500)break;
   const question=clip(turn.question,Math.min(2000,remaining-300));
   let answer=clip(turn.answer,Math.max(0,remaining-Buffer.byteLength(question)-180));
   const pair:HistoryMessage[]=[{role:'user',text:question},{role:'assistant',text:answer}];
   let size=Buffer.byteLength(JSON.stringify(pair));while(bytes+size>maxBytes&&answer.length>100){answer=clip(answer,Math.floor(Buffer.byteLength(answer)*.8));pair[1].text=answer;size=Buffer.byteLength(JSON.stringify(pair));}if(bytes+size>maxBytes)break;
   history.unshift(...pair);bytes+=size;
  }return history;
 }
 exists(id:string){return !!this.core.store.get('ai_thread',id);}
}
