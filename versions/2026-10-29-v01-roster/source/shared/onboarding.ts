export interface AdminRosterRow { studentNumber:string; displayName:string; className:string }
export interface AdminRosterPlan { id:string; fingerprint:string; batchName:string; rows:AdminRosterRow[]; errors:string[]; expiresAt:number; newAccounts:number; existingAccounts:number; classes:Array<{name:string;memberCount:number}> }
export interface ManagedClassInfo { id:string;name:string;batchName:string;memberCount:number;teacherCount:number;teacherNames:string[];claimed?:boolean }
export interface AdminRosterReceipt { imported:number;newAccounts:number;existingAccounts:number;classes:ManagedClassInfo[] }
