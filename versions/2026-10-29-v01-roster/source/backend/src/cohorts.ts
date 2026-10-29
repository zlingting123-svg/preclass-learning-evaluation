import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { CohortInfo, User } from '../../shared/contracts.js';
import type { Store } from './store.js';
import { ensure } from './errors.js';

export interface CohortRecord extends Omit<CohortInfo, 'teacherCount'> { teacherIds: string[] }
export const cohortInput = z.object({
  name: z.string().trim().min(1).max(200), courseName: z.string().trim().min(1).max(200),
  startsOn: z.iso.date(), endsOn: z.iso.date(),
  teacherIds: z.array(z.string().min(1).max(128)).min(1).max(100).refine(ids => new Set(ids).size === ids.length, '教师ID重复'),
  plannedStudentCount: z.number().int().min(1).max(100000).nullable().default(null),
  plannedTeacherCount: z.number().int().min(1).max(1000).nullable().default(null),
  assignmentsPerStudent: z.number().int().min(1).max(1000).nullable().default(null),
}).strict().refine(v => v.endsOn >= v.startsOn, '结束日期早于开始日期');

export function requireLocalAdmin(store: Store, actor: User): void {
  const current = store.get<User>('user', actor.id);
  ensure(actor.role === 'admin' && current?.role === 'admin', 403, 'FORBIDDEN', '仅受控管理员可执行本机名单管理');
}
export function requireCohort(store: Store, id: string): CohortRecord {
  const cohort = store.get<CohortRecord>('cohort', id);
  ensure(cohort, 404, 'COHORT_NOT_FOUND', '教学批次不存在'); return cohort;
}
export function publicCohort(cohort: CohortRecord): CohortInfo {
  const { teacherIds, ...info } = cohort; return { ...info, teacherCount: teacherIds.length };
}
export function createCohort(store: Store, actor: User, input: unknown, now = Date.now): CohortInfo {
  requireLocalAdmin(store, actor);
  const parsed = cohortInput.parse(input);
  return store.transaction(() => {
    for (const id of parsed.teacherIds) ensure(store.get<User>('user', id)?.role === 'teacher', 400, 'INVALID_TEACHER', '教师必须是已配置的教师账号');
    const cohort: CohortRecord = { ...parsed, id: randomUUID(), createdAt: new Date(now()).toISOString() };
    store.put('cohort', cohort.id, cohort); return publicCohort(cohort);
  });
}
