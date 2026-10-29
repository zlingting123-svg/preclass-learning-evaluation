import { randomUUID, createHash } from 'node:crypto';
import type { Express, Response } from 'express';
import { z } from 'zod';
import { ensure } from './errors.js';
import { previewFile } from './file-preview.js';
import { AdminService } from './admin.js';
import type { Service } from './service.js';
import type { Store } from './store.js';

export type ImportedSource = { id:string; classId:string; title:string; name:string; version:string; state:'draft'|'published'|'withdrawn'; url?:string; chunks:string[]; createdAt:string };
const ident=z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/);
const importBody=z.object({classId:ident,title:z.string().trim().min(1).max(200),name:z.string().min(1).max(250),base64:z.string().min(1).max(1400000)}).strict();
export async function extractKnowledge(name:string, base64:string):Promise<string> {
 const ext=name.toLowerCase().split('.').pop();
 if(ext==='txt'||ext==='md') {
  ensure(/^[A-Za-z0-9+/]*={0,2}$/.test(base64),400,'FILE_PARSE_FAILED','文件编码无效');
  const bytes=Buffer.from(base64,'base64'); ensure(bytes.length<=1024*1024&&!bytes.includes(0),400,'FILE_TOO_LARGE','文件过大或内容无效');
  try { return new TextDecoder('utf-8',{fatal:true}).decode(bytes); } catch { ensure(false,400,'FILE_PARSE_FAILED','请使用 UTF-8 编码'); }
 }
 return (await previewFile({name,base64})).text;
}
export function splitKnowledge(text:string):string[] {
 const clean=text.replace(/\r\n?/g,'\n').trim();
 ensure(clean.length>0&&clean.length<=300000,400,'FILE_PARSE_FAILED','资料为空或内容过长');
 return clean.match(/[\s\S]{1,700}/g) ?? [];
}
function terms(value:string):string[] {
 const words=value.toLowerCase().match(/[a-z0-9]{2,}|[\u4e00-\u9fff]+/g)??[];
 return [...new Set(words.flatMap(w=>/^[\u4e00-\u9fff]+$/.test(w)&&w.length>2?Array.from({length:w.length-1},(_,i)=>w.slice(i,i+2)):[w]))];
}
export function importedEvidence(store:Store,classId:string,question:string) {
 const q=terms(question); if(!q.length)return [];
 return store.all<ImportedSource>('ai_imported_source').filter(s=>s.classId===classId&&s.state==='published').flatMap(s=>s.chunks.map((content,i)=>{
 const hay=(s.title+' '+content).toLowerCase(); const score=q.filter(t=>hay.includes(t)).length/q.length;
 return {id:`${s.id}_${i}`,scopeId:s.classId,topicId:'imported_material',title:s.title,content,url:s.url,version:s.version,approved:true,keywords:[],score};
 })).filter(s=>s.score>=0.2).sort((a,b)=>b.score-a.score).slice(0,4);
}
export function knowledgeImportRoutes(app:Express,core:Service) {
 const admin=new AdminService(core); const ok=(res:Response,data:unknown)=>res.json({ok:true,data,requestId:res.locals.requestId});
 app.get('/api/v1/admin/knowledge',(_req,res)=>{admin.require(res.locals.user);ok(res,core.store.all<ImportedSource>('ai_imported_source').map(({chunks,...s})=>({...s,chunkCount:chunks.length})));});
 app.post('/api/v1/admin/knowledge',async(req,res)=>{admin.require(res.locals.user);const b=importBody.parse(req.body);ensure(core.store.get('class',b.classId),404,'CLASS_NOT_FOUND','班级不存在');const text=await extractKnowledge(b.name,b.base64);const chunks=splitKnowledge(text);const source:ImportedSource={id:randomUUID(),classId:b.classId,title:b.title,name:b.name,version:createHash('sha256').update(text).digest('hex'),state:'draft',chunks,createdAt:new Date().toISOString()};core.store.transaction(()=>{core.store.put('ai_imported_source',source.id,source);admin.audit(res.locals.user,'knowledge.import',source.id);});ok(res,{...source,chunks:source.chunks.slice(0,3),chunkCount:source.chunks.length});});
 app.get('/api/v1/admin/knowledge/:id',(req,res)=>{admin.require(res.locals.user);const source=core.store.get<ImportedSource>('ai_imported_source',ident.parse(req.params.id));ensure(source,404,'NOT_FOUND','资料不存在');ok(res,source);});
 app.post('/api/v1/admin/knowledge/:id/state',(req,res)=>{admin.require(res.locals.user);const id=ident.parse(req.params.id);const {state,version}=z.object({state:z.enum(['published','withdrawn']),version:z.string().length(64)}).strict().parse(req.body);const result=core.store.transaction(()=>{const source=core.store.get<ImportedSource>('ai_imported_source',id);ensure(source,404,'NOT_FOUND','资料不存在');ensure(source.version===version,409,'VERSION_CONFLICT','资料版本已变化');const next={...source,state};core.store.put('ai_imported_source',id,next);admin.audit(res.locals.user,'knowledge.'+state,id);return next;});ok(res,{id:result.id,state:result.state,version:result.version});});
}
