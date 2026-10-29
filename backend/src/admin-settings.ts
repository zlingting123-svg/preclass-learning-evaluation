import { z } from 'zod';
import type { ServerSettings, ApiSettings } from '../../shared/admin.js';
import type { Store } from './store.js';
const positive=z.number().int().positive().safe();
const identifier=z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/);
export const serverSettingsBody=z.object({maintenance:z.boolean(),sessionHours:z.number().int().nonnegative().max(24),expectedVersion:z.number().int().nonnegative()}).strict();
export function serverSettings(store:Store):ServerSettings { return store.get<ServerSettings>('server_settings','current')??{maintenance:false,sessionHours:8,version:0}; }
export const apiSettingsBody=z.object({
 credentialUpdates:z.array(z.object({deploymentId:identifier,apiKey:z.string().trim().regex(/^sk-[A-Za-z0-9_-]{10,250}$/)}).strict()).max(20).optional(),
 expectedVersion:z.number().int().nonnegative(), enabled:z.boolean(),dailyRequests:z.number().int().nonnegative().safe().max(100000),
 dailyUserBudgetMicros:z.number().int().nonnegative().safe().max(100000000000),monthlyBudgetMicros:z.number().int().nonnegative().safe().max(1000000000000),
 maxOutputTokens:positive.max(8192),maxQueue:positive.max(1000),queueTimeoutMs:positive.max(120000),requestTimeoutMs:positive.max(180000),topicsMinCount:positive.min(2).max(1000),
 warningMicros:positive.max(1000000000000),stopMicros:positive.max(1000000000000),
 deployments:z.array(z.object({id:identifier,accountId:identifier,quotaGroup:identifier,purposes:z.array(z.enum(['student_qa','teacher_qa','questionnaire_generate','teacher_analytics','system_admin'])).min(1).max(5),maxConcurrency:positive.max(1000),credentialEnv:z.string().regex(/^AI_PROVIDER_[A-Z0-9_]{1,64}$/).optional()}).strict()).min(1).max(20),
}).strict().superRefine((v,ctx)=>{if(v.warningMicros<=v.stopMicros)ctx.addIssue({code:'custom',message:'预警值须高于停止值'});});
export type ManagedApi=Omit<ApiSettings,'version'>;
