import {indexCourseware} from './courseware-evidence.js';
import {randomUUID} from 'node:crypto';
import {mkdirSync,writeFileSync,appendFileSync,readFileSync,statSync,existsSync,rmSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {z} from 'zod';
import {ensure} from './errors.js';
const run=promisify(execFile),id=z.string().uuid();
const MAX_SIZE=30*1024*1024,MAX_PAGES=500;
export function coursewareRoutes(app,core,root=resolve(dirname(process.env.DB_PATH||'work/local.sqlite'),'courseware')){
 const store=core.store,ok=(r,data)=>r.json({ok:true,data,requestId:r.locals.requestId});let queue=Promise.resolve();const pageJobs=new Map();
 const folder=j=>resolve(root,j.id),original=j=>resolve(folder(j),'original.'+j.ext),pdf=j=>j.ext==='pdf'?original(j):resolve(folder(j),'original.pdf');
 const save=j=>store.put('courseware',j.id,j);
 const get=value=>{const j=store.get('courseware',id.parse(value));ensure(j,404,'NOT_FOUND','课件不存在');return j};
 function access(u,j,write=false){core.classAccess(u,j.classId);if(write)core.role(u,'teacher');else ensure(u.role==='teacher'||(u.role==='student'&&j.published&&j.status==='ready'),403,'FORBIDDEN','课件尚未发布或无查看权限');return j}
 const safe=j=>{const {error,...v}=j;return {...v,...error?{error}:{}}};
 async function convert(job){try{
  save({...get(job.id),status:'converting',error:null});
  const head=readFileSync(original(job)).subarray(0,8);
  ensure(job.ext==='pdf'?head.subarray(0,5).toString()==='%PDF-':job.ext==='pptx'?head[0]===80&&head[1]===75:head.equals(Buffer.from([208,207,17,224,161,177,26,225])),400,'FILE_FORMAT','文件内容与扩展名不一致');
  if(job.ext!=='pdf'){
   const profile=resolve(folder(job),'office-profile');
   try{await run('/usr/bin/libreoffice',['-env:UserInstallation='+pathToFileURL(profile).href,'--headless','--convert-to','pdf','--outdir',folder(job),original(job)],{timeout:120000,maxBuffer:1024*1024});}finally{rmSync(profile,{recursive:true,force:true})}
  }
  ensure(existsSync(pdf(job)),400,'CONVERSION_FAILED','课件转换失败，请另存为PDF后重试');
  const info=await run('/usr/bin/pdfinfo',[pdf(job)],{timeout:15000,maxBuffer:1024*1024});
  const pages=Number(info.stdout.match(/^Pages:\s+(\d+)/m)?.[1]);ensure(Number.isInteger(pages)&&pages>0&&pages<=MAX_PAGES,400,'PAGE_LIMIT','课件需要为1至500页，且不能加密');
  save({...get(job.id),status:'ready',pages,error:null});
  await indexCourseware(core,{...job,pages},root);
 }catch(e){save({...get(job.id),status:'failed',published:false,error:e?.code==='PAGE_LIMIT'?e.message:'转换失败：请检查文件是否损坏、加密或页数超过500页，可另存为PDF重试。'})}}
 app.get('/api/v1/core/classes/:classId/courseware',(q,r)=>{const u=r.locals.user;core.classAccess(u,q.params.classId);ensure(['teacher','student'].includes(u.role),403,'FORBIDDEN','无查看权限');ok(r,store.all('courseware').filter(j=>j.classId===q.params.classId&&(u.role==='teacher'||j.published&&j.status==='ready')).map(safe).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)))});
 app.post('/api/v1/core/courseware',(q,r)=>{const u=r.locals.user;core.role(u,'teacher');const b=z.object({classId:z.string().min(1).max(128),title:z.string().trim().min(1).max(150),name:z.string().min(1).max(200),size:z.number().int().min(1).max(MAX_SIZE)}).strict().parse(q.body);core.classAccess(u,b.classId);const ext=b.name.split('.').pop().toLowerCase();ensure(['pdf','ppt','pptx'].includes(ext),400,'FILE_TYPE','支持PDF、PPT、PPTX，单文件不超过30MB');ensure(store.all('courseware').filter(j=>j.createdBy===u.id&&['uploading','queued','converting'].includes(j.status)).length<5,429,'UPLOAD_LIMIT','请等待现有上传或转换完成');const j={...b,id:randomUUID(),ext,createdBy:u.id,createdAt:core.iso(),status:'uploading',received:0,published:false,pages:0};mkdirSync(folder(j),{recursive:true,mode:0o700});writeFileSync(original(j),'',{flag:'wx',mode:0o600});save(j);ok(r,safe(j))});
 app.put('/api/v1/core/courseware/:id/chunk',(q,r)=>{const j=access(r.locals.user,get(q.params.id),true);const b=z.object({offset:z.number().int().nonnegative(),base64:z.string().min(4).max(710000).regex(/^[A-Za-z0-9+/]+={0,2}$/)}).strict().parse(q.body),bytes=Buffer.from(b.base64,'base64');ensure(j.status==='uploading'&&b.offset===j.received,409,'UPLOAD_OFFSET','上传位置不一致，请重新上传');ensure(bytes.length>0&&bytes.length<=512*1024&&j.received+bytes.length<=j.size,400,'UPLOAD_SIZE','上传分块大小无效');ensure(statSync(original(j)).size===j.received,409,'UPLOAD_OFFSET','文件状态不一致');appendFileSync(original(j),bytes);save({...j,received:j.received+bytes.length});ok(r,{received:j.received+bytes.length})});
 app.post('/api/v1/core/courseware/:id/complete',(q,r)=>{const j=access(r.locals.user,get(q.params.id),true);ensure(['uploading','failed'].includes(j.status)&&j.received===j.size&&statSync(original(j)).size===j.size,409,'UPLOAD_INCOMPLETE','文件尚未上传完整');save({...j,status:'queued'});queue=queue.then(()=>convert(j));ok(r,{status:'queued'})});
 app.post('/api/v1/core/courseware/:id/publish',(q,r)=>{const j=access(r.locals.user,get(q.params.id),true),b=z.object({published:z.boolean()}).strict().parse(q.body);ensure(j.status==='ready',409,'NOT_READY','请等待课件转换完成');save({...j,published:b.published,updatedAt:core.iso()});ok(r,safe(get(j.id)))});
 app.get('/api/v1/core/courseware/:id/pages/:page',async(q,r)=>{const j=access(r.locals.user,get(q.params.id));ensure(j.status==='ready',409,'NOT_READY','课件尚未就绪');const page=z.coerce.number().int().min(1).max(j.pages).parse(q.params.page),prefix=resolve(folder(j),'page-'+page),file=prefix+'.png';const key=j.id+':'+page;
  if(!existsSync(file)){if(!pageJobs.has(key))pageJobs.set(key,(async()=>{await run('/usr/bin/pdftoppm',['-f',String(page),'-l',String(page),'-singlefile','-scale-to','1800','-png',pdf(j),prefix],{timeout:30000,maxBuffer:1024*1024});})().finally(()=>pageJobs.delete(key)));await pageJobs.get(key)}
  const account=store.all('account').find(a=>a.user.id===r.locals.user.id);r.setHeader('Cache-Control','private, no-store');ok(r,{page,pages:j.pages,mime:'image/png',base64:readFileSync(file).toString('base64'),watermark:r.locals.user.displayName+' · '+(account?.username||r.locals.user.id.slice(0,8))+' · '+new Date().toLocaleDateString('zh-CN',{timeZone:'Asia/Shanghai'})});
 });
 for(const j of store.all('courseware'))if(j.status==='ready'&&!store.get('courseware_evidence',j.id))queue=queue.then(()=>indexCourseware(core,j,root));
 for(const j of store.all('courseware'))if(['queued','converting'].includes(j.status))save({...j,status:'failed',published:false,error:'服务重启中断了转换，请点击重新转换'});
}
