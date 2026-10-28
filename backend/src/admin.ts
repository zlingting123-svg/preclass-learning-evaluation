import type { Express, Response } from 'express';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { LocalAuth, type AuthProvider, type Account, type AccountControl } from './auth.js';
import { Service, page } from './service.js';
import { ensure } from './errors.js';
import type { User } from '../../shared/contracts.js';
import type { AdminAccount, AdminAudit, ApiSettings } from '../../shared/admin.js';
import { serverSettings, serverSettingsBody, apiSettingsBody } from './admin-settings.js';
import type { CourseAi } from './ai.js';
import { safeCsv } from './csv.js';
const id=z.string().min(1).max(128), version=z.number().int().nonnegative();
const password=z.string().min(12).max(72).refine(v=>Buffer.byteLength(v)<=72);
const createBody=z.object({username:z.string().regex(/^[a-zA-Z0-9_.@-]{3,100}$/),displayName:z.string().trim().min(1).max(100),role:z.enum(['student','teacher']),password}).strict();
const updateBody=z.object({displayName:z.string().trim().min(1).max(100),role:z.enum(['student','teacher','admin']),disabled:z.boolean(),expectedVersion:version}).strict();
export function adminRoutes(app:Express,core:Service,auth:AuthProvider,ai?:CourseAi) {
 const store=core.store,ok=(res:Response,data:unknown)=>res.json({ok:true,data,requestId:res.locals.requestId});
 const actor=(res:Response):User=>res.locals.user;
 const local=()=>{ensure(auth instanceof LocalAuth,503,'LOCAL_AUTH_REQUIRED','该认证提供方尚不支持账户管理');return auth;};
 const audit=(who:User,action:string,targetId:string)=>{const row:AdminAudit={id:randomUUID(),actorId:who.id,action,targetId,createdAt:new Date().toISOString()};store.put('admin_audit',row.id,row);};
 function accounts():AdminAccount[] {return store.all<Account>('account').flatMap(a=>{
  const user=store.get<User>('user',a.user.id);if(!user)return[];const control=store.get<AccountControl>('account_control',user.id);
  return [{id:user.id,username:a.username,displayName:user.displayName,role:user.role,disabled:control?.disabled??false,version:control?.version??0}];
 });}
 function account(userId:string) {const a=accounts().find(a=>a.id===userId);ensure(a,404,'ACCOUNT_NOT_FOUND','账户不存在');return a;}
 function checkVersion(actual:number,expected:number) {ensure(actual===expected,409,'VERSION_CONFLICT','设置已被其他管理员修改，请刷新后重试');}
 function revoke(userId:string) {const old=store.get<AccountControl>('account_control',userId)??{disabled:false,version:0};store.put<AccountControl>('account_control',userId,{...old,version:old.version+1});}
 app.use('/api/v1/admin',(_req,res,next)=>{core.role(actor(res),'admin');next();});
 app.get('/api/v1/admin/overview',async(_req,res)=>{
  const list=accounts();ok(res,{counts:{users:list.length,enabled:list.filter(a=>!a.disabled).length,disabled:list.filter(a=>a.disabled).length,students:list.filter(a=>a.role==='student').length,teachers:list.filter(a=>a.role==='teacher').length,admins:list.filter(a=>a.role==='admin').length},server:serverSettings(store),ai:{mode:ai?.mode??'disabled',liveReady:false,summary:ai?await ai.store.summary():null,scheduler:ai?await ai.gateway.scheduler.status():null},productionReady:false});
 });
 app.get('/api/v1/admin/accounts',(req,res)=>{
  const q=z.object({search:z.string().max(100).default(''),role:z.enum(['student','teacher','admin']).optional(),limit:z.coerce.number().int().min(1).max(100).default(20),cursor:z.string().max(256).optional()}).strict().parse(req.query);
  const needle=q.search.toLowerCase();ok(res,page(accounts().filter(a=>(!q.role||a.role===q.role)&&(!needle||[a.username,a.displayName,a.id].some(v=>v.toLowerCase().includes(needle)))),q.limit,q.cursor));
 });
 app.post('/api/v1/admin/accounts',async(req,res)=>{
  const b=createBody.parse(req.body),prepared=await local().prepareUser(b.username,b.password,b.displayName,b.role);
  const result=store.transaction(()=>{core.role(auth.authenticate(res.locals.token),'admin');const user=local().persistPrepared(prepared);audit(actor(res),'account.create',user.id);return account(user.id);});ok(res,result);
 });
 app.patch('/api/v1/admin/accounts/:id',(req,res)=>{
  const userId=id.parse(req.params.id),b=updateBody.parse(req.body);
  const result=store.transaction(()=>{
   const old=account(userId);checkVersion(old.version,b.expectedVersion);
   ensure(old.role===b.role||b.role!=='admin',403,'ADMIN_PROVISION_CLI','新增管理员请使用受控命令');
   ensure(old.id!==actor(res).id||(!b.disabled&&b.role==='admin'),409,'SELF_LOCKOUT','不能停用自己或修改自己的管理员角色');
   if(old.role==='admin'&&!old.disabled&&(b.disabled||b.role!=='admin'))ensure(accounts().filter(a=>a.role==='admin'&&!a.disabled).length>1,409,'LAST_ADMIN','必须保留至少一个可用管理员');
   const record=store.all<Account>('account').find(a=>a.user.id===userId)!;
   const user:User={id:userId,displayName:b.displayName,role:b.role};
   store.put('user',userId,user);store.put('account',record.username,{...record,user});
   store.put<AccountControl>('account_control',userId,{disabled:b.disabled,version:old.version+1});
   audit(actor(res),'account.update',userId);return account(userId);
  });ok(res,result);
 });
 app.post('/api/v1/admin/accounts/:id/revoke',(req,res)=>{
  const userId=id.parse(req.params.id),b=z.object({expectedVersion:version}).strict().parse(req.body);
  store.transaction(()=>{checkVersion(account(userId).version,b.expectedVersion);revoke(userId);audit(actor(res),'account.revoke_sessions',userId);});ok(res,{success:true});
 });
 app.post('/api/v1/admin/accounts/:id/password',async(req,res)=>{
  const userId=id.parse(req.params.id),b=z.object({password,expectedVersion:version}).strict().parse(req.body);local();
  const old=account(userId);checkVersion(old.version,b.expectedVersion);
  const passwordHash=await bcrypt.hash(b.password,12);
  store.transaction(()=>{
   core.role(auth.authenticate(res.locals.token),'admin');checkVersion(account(userId).version,b.expectedVersion);const a=store.all<Account>('account').find(a=>a.user.id===userId)!;
   store.put<Account>('account',a.username,{...a,passwordHash});revoke(userId);audit(actor(res),'account.reset_password',userId);
  });ok(res,{success:true});
 });
 app.get('/api/v1/admin/server',(_req,res)=>ok(res,serverSettings(store)));
 app.put('/api/v1/admin/server',(req,res)=>{
  const b=serverSettingsBody.parse(req.body);
  const result=store.transaction(()=>{checkVersion(serverSettings(store).version,b.expectedVersion);const settings={maintenance:b.maintenance,sessionHours:b.sessionHours,version:b.expectedVersion+1};store.put('server_settings','current',settings);audit(actor(res),'server.configure','current');return settings;});ok(res,result);
 });
 app.get('/api/v1/admin/api',async(_req,res)=>{
  ok(res,{mode:ai?.mode??'disabled',liveReady:false,settings:ai?.management()??null,status:ai?await ai.gateway.scheduler.status():null,credentials:ai?.management().deployments.map(d=>({id:d.id,configured:!!(d.credentialEnv&&process.env[d.credentialEnv])})),balanceState:'not_configured'});
 });
 app.put('/api/v1/admin/api',(req,res)=>{
  ensure(ai,503,'AI_NOT_CONNECTED','请先在服务器启用模拟AI模块');const {expectedVersion,...value}=apiSettingsBody.parse(req.body);
  checkVersion(ai.management().version,expectedVersion);
  ai.configure(value,()=>store.transaction(()=>{checkVersion(store.get<ApiSettings>('ai_admin_settings','current')?.version??0,expectedVersion);store.put<ApiSettings>('ai_admin_settings','current',{...value,version:expectedVersion+1});audit(actor(res),'api.configure','current');}));ok(res,ai.management());
 });
 app.get('/api/v1/admin/usage',async(req,res)=>{
  const q=z.object({userId:id.optional(),limit:z.coerce.number().int().min(1).max(100).default(20),cursor:z.string().max(256).optional()}).strict().parse(req.query);
  const entries=ai?(await ai.store.rows()).filter(r=>!q.userId||r.subjectId===q.userId).map(r=>({id:r.id,userId:r.subjectId,createdAt:r.createdAt,state:r.state,purpose:r.purpose,accountId:r.accountId,model:r.model,inputTokens:r.inputTokens,outputTokens:r.outputTokens,costMicros:r.costMicros,currency:r.currency,pricingVersion:r.pricingVersion,errorCode:r.errorCode})):[];
  ok(res,page(entries,q.limit,q.cursor));
 });
 app.get('/api/v1/admin/audit',(req,res)=>{
  const q=z.object({limit:z.coerce.number().int().min(1).max(100).default(20),cursor:z.string().max(256).optional()}).strict().parse(req.query);ok(res,page(store.all<AdminAudit>('admin_audit'),q.limit,q.cursor));
 });
 app.get('/api/v1/admin/accounts/export',(_req,res)=>{
  const csv=safeCsv([['账号','姓名','角色','状态'],...accounts().map(a=>[a.username,a.displayName,a.role,a.disabled?'停用':'启用'])]);audit(actor(res),'account.export','accounts');res.type('text/csv; charset=utf-8').setHeader('Content-Disposition','attachment; filename="accounts.csv"');res.send(csv);
 });
}
