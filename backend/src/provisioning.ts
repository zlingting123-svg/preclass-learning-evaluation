import {createHash,randomBytes,randomUUID} from 'node:crypto';
import type {Express,Response} from 'express';
import {z} from 'zod';
import type {User} from '../../shared/contracts.js';
import type {AdminRosterRow,AdminRosterPlan,AdminRosterReceipt,ManagedClassInfo} from '../../shared/onboarding.js';
import {Service,keyFor,type ClassRecord,type Member} from './service.js';
import {AdminService} from './admin.js';
import {LocalAuth,type AuthProvider,type Account} from './auth.js';
import {ensure} from './errors.js';
import {previewFile} from './file-preview.js';
interface ManagedClass {id:string;batchName:string;sourceName:string;createdAt:string}
interface Plan extends AdminRosterPlan {actorId:string}
interface Receipt extends AdminRosterReceipt {actorId:string;fingerprint:string}
const id=z.string().min(1).max(128);
const fields=z.string().trim().min(1).max(200).refine(v=>!/[\x00-\x1f]/.test(v),'不能包含控制字符');
const previewBody=z.object({batchName:fields,rows:z.array(z.object({studentNumber:z.string().trim().max(100),displayName:fields,className:fields}).strict()).min(1).max(1000)}).strict();
export class Provisioning {
 readonly admin:AdminService;
 constructor(readonly core:Service,readonly auth:AuthProvider){this.admin=new AdminService(core)}
 get store(){return this.core.store}
 inspect(rows:AdminRosterRow[]){
  const errors:string[]=[],seen=new Set<string>(),names=new Map<string,string>();
  rows.forEach((r,i)=>{
   const row=i+1;
   if(!/^[a-zA-Z0-9_.@-]{3,100}$/.test(r.studentNumber)||/^[+-]?\d+(?:\.\d+)?[eE][+-]?\d+$/.test(r.studentNumber))errors.push(`第${row}行：学号格式无效或疑似科学计数法`);
   const key=keyFor(r.studentNumber,r.className);if(seen.has(key))errors.push(`第${row}行：同班学号重复`);seen.add(key);
   if(names.has(r.studentNumber)&&names.get(r.studentNumber)!==r.displayName)errors.push(`第${row}行：同一学号姓名不一致`);names.set(r.studentNumber,r.displayName);
   const a=this.store.get<Account>('account',r.studentNumber),u=a&&this.store.get<User>('user',a.user.id),identity=this.store.get<{userId:string;displayName:string}>('student_identity',r.studentNumber);
   if(a&&(a.user.role!=='student'||a.user.displayName!==r.displayName||u?.role!=='student'||u.displayName!==r.displayName))errors.push(`第${row}行：已有账号姓名或角色不一致`);
   if(identity&&(!a||identity.userId!==a.user.id||identity.displayName!==r.displayName))errors.push(`第${row}行：学号身份记录冲突`);
  });return errors;
 }
 preview(actor:User,raw:unknown):AdminRosterPlan{
  this.admin.require(actor);const b=previewBody.parse(raw),unique=[...new Map(b.rows.map(r=>[r.studentNumber,r])).values()];
  const groups=[...new Set(b.rows.map(r=>r.className))].map(name=>({name,memberCount:b.rows.filter(r=>r.className===name).length}));
  const plan:Plan={id:randomUUID(),actorId:actor.id,batchName:b.batchName,rows:b.rows,errors:this.inspect(b.rows),expiresAt:this.core.now()+30*60000,fingerprint:createHash('sha256').update(JSON.stringify([actor.id,b])).digest('hex'),newAccounts:unique.filter(r=>!this.store.get('account',r.studentNumber)).length,existingAccounts:unique.filter(r=>this.store.get('account',r.studentNumber)).length,classes:groups};
  this.store.put('admin_roster_plan',plan.id,plan);const {actorId:_,...result}=plan;return result;
 }
 info(m:ManagedClass,teacher?:User):ManagedClassInfo{
  const c=this.store.get<ClassRecord>('class',m.id)!;
  const ids=[...new Set([c.teacherId,...this.store.all<{classId:string;teacherId:string}>('class_teacher').filter(r=>r.classId===m.id).map(r=>r.teacherId)].filter(Boolean))];
  return{id:m.id,name:c.name,batchName:m.batchName,memberCount:this.store.all<Member>('member').filter(r=>r.classId===m.id).length,teacherCount:ids.length,teacherNames:ids.map(id=>this.store.get<User>('user',id)?.displayName??'教师'),...(teacher?{claimed:ids.includes(teacher.id)}:{})};
 }
 list(actor:User,admin=false){if(admin)this.admin.require(actor);else this.core.role(actor,'teacher');return this.store.all<ManagedClass>('managed_class').map(m=>this.info(m,admin?undefined:actor));}
 async commit(actor:User,token:string,raw:unknown):Promise<AdminRosterReceipt>{
  this.admin.require(actor);ensure(this.auth instanceof LocalAuth,503,'LOCAL_AUTH_REQUIRED','当前认证提供方不支持批量建号');
  const b=z.object({planId:id,fingerprint:z.string().length(64),initialPassword:z.string().min(12).refine(v=>Buffer.byteLength(v)<=72,'初始密码最多72字节')}).strict().parse(raw);
  const plan=this.store.get<Plan>('admin_roster_plan',b.planId);ensure(plan&&plan.actorId===actor.id&&plan.fingerprint===b.fingerprint,409,'INVALID_PLAN','预览不匹配，请重新预览');
  const previous=this.store.get<Receipt>('admin_roster_receipt',plan.id);if(previous){const {actorId:_,fingerprint:__,...receipt}=previous;return receipt}
  ensure(plan.expiresAt>this.core.now()&&!this.inspect(plan.rows).length,409,'ROSTER_CONFLICT','名单冲突或预览过期，请重新预览');
  const prepared=new Map<string,Account>();
  // Every new student gets a separate bcrypt salt; no plaintext password is persisted.
  for(const r of plan.rows)if(!this.store.get('account',r.studentNumber)&&!prepared.has(r.studentNumber)){
   const a=await this.auth.prepareUser(r.studentNumber,b.initialPassword,r.displayName,'student');a.mustChangePassword=true;prepared.set(r.studentNumber,a);
  }
  return this.store.transaction(()=>{
   this.admin.require(this.auth.authenticate(token));
   const replay=this.store.get<Receipt>('admin_roster_receipt',plan.id);if(replay){const {actorId:_,fingerprint:__,...receipt}=replay;return receipt}
   ensure(plan.expiresAt>this.core.now()&&!this.inspect(plan.rows).length,409,'ROSTER_CONFLICT','名单已变更，请重新预览');
   const managed:ManagedClass[]=[],numbers=new Set<string>();let created=0,reused=0;
   for(const name of new Set(plan.rows.map(r=>r.className))){
    let m=this.store.all<ManagedClass>('managed_class').find(c=>c.batchName===plan.batchName&&c.sourceName===name);
    if(!m){m={id:randomUUID(),batchName:plan.batchName,sourceName:name,createdAt:this.core.iso()};this.store.put<ClassRecord>('class',m.id,{id:m.id,name,teacherId:'',joinCode:randomBytes(8).toString('hex').toUpperCase()});this.store.put('managed_class',m.id,m)}managed.push(m);
   }
   for(const r of plan.rows){let a=this.store.get<Account>('account',r.studentNumber);
    if(!a){a=prepared.get(r.studentNumber)!;(this.auth as LocalAuth).persistPrepared(a);created++}else if(!numbers.has(r.studentNumber))reused++;
    numbers.add(r.studentNumber);const m=managed.find(m=>m.sourceName===r.className)!,mid=keyFor(m.id,a.user.id);
    this.store.put<Member>('member',mid,{id:mid,classId:m.id,studentId:a.user.id});this.store.put('student_identity',r.studentNumber,{studentNumber:r.studentNumber,userId:a.user.id,displayName:r.displayName});
   }
   const receipt:AdminRosterReceipt={imported:plan.rows.length,newAccounts:created,existingAccounts:reused,classes:managed.map(m=>this.info(m))};
   this.store.put<Receipt>('admin_roster_receipt',plan.id,{...receipt,actorId:actor.id,fingerprint:plan.fingerprint});this.admin.audit(actor,'import_class_roster',plan.id);
   // Retain only replay metadata after success, avoiding a duplicate copy of names.
   this.store.put<Plan>('admin_roster_plan',plan.id,{...plan,rows:[]});return receipt;
  });
 }
 claim(actor:User,classId:string){
  this.core.role(actor,'teacher');return this.store.transaction(()=>{
   const m=this.store.get<ManagedClass>('managed_class',classId);ensure(m,404,'NOT_FOUND','此班级未由管理员开放');
   const c=this.store.get<ClassRecord>('class',classId)!;const key=keyFor(classId,actor.id);
   ensure(!this.store.get("class_teacher_block",key),403,"CLASS_CLAIM_REVOKED","管理员已撤销此班级权限，请联系管理员重新分配");
   if(!this.store.get('class_teacher',key)){this.store.put('class_teacher',key,{id:key,classId,teacherId:actor.id});this.store.put('class',c.id,{...c,teacherId:c.teacherId||actor.id,adminVersion:((c as ClassRecord & {adminVersion?:number}).adminVersion??0)+1});this.admin.audit(actor,'claim_class',classId)}
   return this.info(m,actor);
  });
 }
}
export function provisioningRoutes(app:Express,core:Service,auth:AuthProvider){
 const service=new Provisioning(core,auth),u=(res:Response):User=>res.locals.user,ok=(res:Response,data:unknown)=>res.json({ok:true,data,requestId:res.locals.requestId});
 app.post('/api/v1/admin/rosters/files/preview',async(req,res)=>{service.admin.require(u(res));ok(res,await previewFile(req.body))});
 app.post('/api/v1/admin/rosters/preview',(req,res)=>ok(res,service.preview(u(res),req.body)));
 app.post('/api/v1/admin/rosters/commit',async(req,res)=>ok(res,await service.commit(u(res),res.locals.token,req.body)));
 app.get('/api/v1/admin/rosters/pending',(_req,res)=>{service.admin.require(u(res));ok(res,core.store.all<Plan>('admin_roster_plan').filter(p=>p.actorId===u(res).id&&p.rows.length>0).map(p=>({id:p.id,batchName:p.batchName,count:p.rows.length}))) });
 app.post('/api/v1/admin/rosters/pending/:id/select',(req,res)=>{service.admin.require(u(res));const plan=core.store.get<Plan>('admin_roster_plan',id.parse(req.params.id));ensure(plan&&plan.actorId===u(res).id&&plan.rows.length,404,'NOT_FOUND','未找到待建号名单');const fresh=service.preview(u(res),{batchName:plan.batchName,rows:plan.rows});core.store.remove('admin_roster_plan',plan.id);ok(res,fresh)});
 app.get('/api/v1/admin/rosters/classes',(_req,res)=>ok(res,service.list(u(res),true)));
 app.get('/api/v1/teacher/class-catalog',(_req,res)=>ok(res,service.list(u(res))));
 app.post('/api/v1/teacher/classes/:id/claim',(req,res)=>{z.object({}).strict().parse(req.body);ok(res,service.claim(u(res),id.parse(req.params.id)))});
}
