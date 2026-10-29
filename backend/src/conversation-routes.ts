import type {Express,Response} from 'express';
import {once} from 'node:events';
import {z} from 'zod';
import type {User} from '../../shared/contracts.js';
import type {ChatOutcome,ChatSource} from '../../shared/conversations.js';
import {Service} from './service.js';
import {Conversations} from './conversations.js';
import {AppError,ensure} from './errors.js';
import {ModuleError} from 'course-ai-module';
import type {CourseAi} from './ai.js';
const id=z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/),questionBody=z.object({question:z.string().trim().min(1).max(5000),clientRequestId:id}).strict();
export function conversationRoutes(app:Express,core:Service,ai?:CourseAi){
 const chats=new Conversations(core),user=(res:Response):User=>res.locals.user,ok=(res:Response,data:unknown)=>res.json({ok:true,data,requestId:res.locals.requestId});
 app.get('/api/v1/core/ai/last-context',(_req,res)=>ok(res,chats.lastContext(user(res))));
 app.get('/api/v1/core/ai/threads',(req,res)=>{const q=z.object({classId:id}).strict().parse(req.query);ok(res,chats.list(user(res),q.classId));});
 app.post('/api/v1/core/ai/threads',(req,res)=>{const b=z.object({classId:id}).strict().parse(req.body);ok(res,chats.create(user(res),b.classId));});
 app.get('/api/v1/core/ai/threads/:id',(req,res)=>ok(res,chats.detail(user(res),id.parse(req.params.id))));
 app.post('/api/v1/core/ai/threads/:id/select',(req,res)=>{z.object({}).strict().parse(req.body);ok(res,chats.select(user(res),id.parse(req.params.id)));});
 app.delete('/api/v1/core/ai/threads/:id',(req,res)=>{chats.remove(user(res),id.parse(req.params.id));ok(res,{deleted:true});});
 app.post('/api/v1/core/ai/threads/:id/questions',async(req,res)=>{
  const threadId=id.parse(req.params.id),body=questionBody.parse(req.body),student=user(res),detail=chats.detail(student,threadId);
  ensure(ai,503,'AI_NOT_CONNECTED','AI服务尚未启用');
  const turn=chats.begin(student,threadId,body.clientRequestId,body.question),controller=new AbortController();
  const abort=()=>controller.abort();res.on('close',abort);if(res.destroyed)abort();chats.running.set(threadId,controller);
  let answer='',outcome:ChatOutcome='error',sources:ChatSource[]=[];
  const timer=setTimeout(abort,ai.gateway.policy.requestTimeoutMs);
  try{
   const principal=await ai.gateway.deps.identity.verify(res.locals.token),input={courseId:detail.classId,question:body.question,clientRequestId:body.clientRequestId,history:chats.context(student,threadId,Math.max(0,Math.min(24000,ai.gateway.policy.maxInputBytes-Buffer.byteLength(body.question)-6000)))};
   const requestId=await ai.gateway.prepare(principal,input);
   res.status(200).set({'Content-Type':'text/event-stream; charset=utf-8','X-Accel-Buffering':'no','X-Request-Id':requestId});res.flushHeaders();
   await ai.gateway.answer(principal,input,requestId,controller.signal,async(event,data)=>{
    controller.signal.throwIfAborted();ensure(chats.exists(threadId),410,'THREAD_DELETED','对话已删除');
    const value=data as {text?:string;message?:string;sources?:ChatSource[]};
    if(event==='delta'){answer+=value.text??'';ensure(answer.length<=24000,502,'ANSWER_TOO_LARGE','回答过长');}
    if(event==='sources')sources=value.sources??[];
    if(event==='done')outcome='done';
    if(event==='refusal'||event==='insufficient_evidence'){outcome=event;answer=value.message??'';}
    if(!res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))await once(res,'drain',{signal:controller.signal});
   });
  }catch(e){
   if(controller.signal.aborted)outcome='cancelled';
   if(!res.headersSent){if(e instanceof ModuleError)throw new AppError(e.status,e.code,'AI请求未完成，请检查用量或稍后再试');throw e;}
  }finally{
   clearTimeout(timer);res.off('close',abort);if(chats.running.get(threadId)===controller)chats.running.delete(threadId);
   if(controller.signal.aborted&&(outcome as ChatOutcome)!=='done')outcome='cancelled';chats.finish(threadId,turn.id,answer,outcome,sources);
   if(res.headersSent)res.end();
  }
 });
 return chats;
}
