import {createHash,randomUUID} from 'node:crypto';
import {z} from 'zod';
import type {Express,Response} from 'express';
import type {User} from '../../shared/contracts.js';
import type {AdminService} from './admin.js';
import {keyFor,type Member,type ClassRecord} from './service.js';
import type {CohortRecord} from './cohorts.js';
import {ensure} from './errors.js';

interface DeletePlan {id:string;actorId:string;userId:string;fingerprint:string;expiresAt:number}
/** Account-only deletion: preserve course content, responses, conversations and billing history. */
export class AccountDeletion {
 constructor(readonly admin:AdminService){}
 private snapshot(actor:User,userId:string){
  const a=this.admin; a.require(actor);const account=a.account(userId);
  ensure(account.user.role!=='admin'&&userId!==actor.id,403,'ADMIN_PROTECTED','不能删除管理员或当前登录账号');
  const store=a.store;
  const members=store.all<Member>('member').filter(m=>m.studentId===userId);
  const teacherLinks=store.all<{classId:string;teacherId:string}>('class_teacher').filter(t=>t.teacherId===userId);
  const classes=store.all<ClassRecord>('class').filter(c=>c.teacherId===userId||teacherLinks.some(t=>t.classId===c.id));
  const cohorts=store.all<CohortRecord>('cohort').filter(c=>c.teacherIds.includes(userId));
  const threads=store.all<{id:string;ownerId:string}>('ai_thread').filter(t=>t.ownerId===userId);
  const pending=store.all<{threadId:string;outcome:string}>('ai_turn').some(t=>t.outcome==='pending'&&threads.some(thread=>thread.id===t.threadId));
  ensure(!pending,409,'ACCOUNT_BUSY','此账号正在生成AI回答，请完成或停止后再删除');
  const responses=store.all<{studentId:string}>('survey_response').filter(r=>r.studentId===userId).length;
  const submissions=store.all<{studentId:string}>('submission').filter(r=>r.studentId===userId).length;
  const summary={account:a.publicAccount(account),enrollments:members.length,teachingClasses:classes.length,retainedResponses:responses+submissions,retainedConversations:threads.length};
  const fingerprint=createHash('sha256').update(JSON.stringify({summary,members:members.map(m=>m.id).sort(),classes:classes.map(c=>[c.id,c.teacherId]).sort(),cohorts:cohorts.map(c=>c.id).sort()})).digest('hex');
  return {account,members,teacherLinks,classes,cohorts,summary,fingerprint};
 }
 preview(actor:User,userId:string){
  const snapshot=this.snapshot(actor,userId),id=randomUUID(),now=this.admin.core.now();
  // Plans carry no passwords, tokens, answer text or conversation text.
  this.admin.store.put<DeletePlan>('account_delete_plan',id,{id,actorId:actor.id,userId,fingerprint:snapshot.fingerprint,expiresAt:now+5*60000});
  for(const plan of this.admin.store.all<DeletePlan>('account_delete_plan'))if(plan.expiresAt<=now)this.admin.store.remove('account_delete_plan',plan.id);
  return {planId:id,...snapshot.summary};
 }
 remove(actor:User,userId:string,raw:unknown){
  const body=z.object({planId:z.string().uuid(),expectedVersion:z.number().int().nonnegative(),confirmUsername:z.string().min(1).max(100)}).strict().parse(raw);
  return this.admin.store.transaction(()=>{
   const a=this.admin,s=this.snapshot(actor,userId),plan=a.store.get<DeletePlan>('account_delete_plan',body.planId);
   ensure(plan&&plan.actorId===actor.id&&plan.userId===userId&&plan.expiresAt>a.core.now(),409,'DELETE_CONFIRMATION_EXPIRED','删除确认已失效，请重新点击删除并确认');
   a.core.checkVersion(s.account.version??0,body.expectedVersion);
   ensure(body.confirmUsername===s.account.username&&plan.fingerprint===s.fingerprint,409,'DELETE_CONFIRMATION_CHANGED','账号或关联记录已变化，请重新核对后确认删除');
   a.audit(actor,'delete_account',userId);
   a.bumpSessions(userId);
   for(const member of s.members)a.store.remove('member',member.id);
   for(const link of s.teacherLinks)a.store.remove('class_teacher',keyFor(link.classId,userId));
   for(const cls of s.classes){
    if(cls.teacherId===userId){
     const remaining=a.store.all<{classId:string;teacherId:string}>('class_teacher').filter(t=>t.classId===cls.id&&t.teacherId!==userId);
     a.store.put('class',cls.id,{...cls,teacherId:remaining[0]?.teacherId??'',adminVersion:((cls as ClassRecord&{adminVersion?:number}).adminVersion??0)+1});
    }
   }
   for(const cohort of s.cohorts)a.store.put('cohort',cohort.id,{...cohort,teacherIds:cohort.teacherIds.filter(id=>id!==userId)});
   for(const identity of a.store.all<{userId:string;studentNumber:string}>('student_identity'))if(identity.userId===userId)a.store.remove('student_identity',identity.studentNumber);
   a.store.remove('personal_profile',userId);a.store.remove('account',s.account.username);a.store.remove('user',userId);
   for(const p of a.store.all<DeletePlan>('account_delete_plan'))if(p.userId===userId)a.store.remove('account_delete_plan',p.id);
   return {deleted:true,userId,retainedResponses:s.summary.retainedResponses,retainedConversations:s.summary.retainedConversations};
  });
 }
}
export function accountDeletionRoutes(app:Express,admin:AdminService,ok:(res:Response,data:unknown)=>unknown){
 const deletion=new AccountDeletion(admin),id=(value:unknown)=>z.string().min(1).max(128).parse(value);
 app.post('/api/v1/admin/users/:id/delete-preview',(req,res)=>{z.object({}).strict().parse(req.body);ok(res,deletion.preview(res.locals.user,id(req.params.id)))});
 app.delete('/api/v1/admin/users/:id',(req,res)=>ok(res,deletion.remove(res.locals.user,id(req.params.id),req.body)));
}
