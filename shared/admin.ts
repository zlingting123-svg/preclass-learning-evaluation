/** Service administration metadata only; never course content, passwords or API secrets. */
export interface AdminAccount { id:string; username:string; displayName:string; role:'student'|'teacher'|'admin'; disabled:boolean; version:number; }
export interface ServerSettings { maintenance:boolean; sessionHours:number; version:number; }
export interface ApiSettings {
 version:number;
 enabled:boolean; dailyRequests:number; dailyUserBudgetMicros:number; monthlyBudgetMicros:number;
 maxOutputTokens:number; maxQueue:number; queueTimeoutMs:number; requestTimeoutMs:number; topicsMinCount:number;
 warningMicros:number; stopMicros:number;
 deployments:Array<{id:string;accountId:string;quotaGroup:string;purposes:Array<'student_qa'|'teacher_analytics'|'system_admin'>;maxConcurrency:number;credentialEnv?:string}>;
}
export interface AdminAudit { id:string; actorId:string; action:string; targetId:string; createdAt:string; }
