import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync, unlinkSync, lstatSync, realpathSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { parse } from 'csv-parse/sync';
import { z } from 'zod';
import type { RosterImportCounts, User } from '../../shared/contracts.js';
import { LocalAuth, type Account } from './auth.js';
import type { Store } from './store.js';
import { ensure } from './errors.js';
import { keyFor, type ClassRecord, type Member } from './service.js';
import { requireCohort, requireLocalAdmin } from './cohorts.js';

export interface StudentIdentity { studentNumber: string; userId: string; displayName: string }
export interface RosterRow {
  rowNumber: number; studentNumber: string; displayName: string;
  status: 'new' | 'existing' | 'already_enrolled' | 'invalid' | 'conflict';
  message: string | null; userId: string | null;
}
export interface ImportReceipt {
  planId: string; classId: string; cohortId: string; counts: RosterImportCounts;
  newEnrollments: number; credentialsFile: string; completedAt: string;
}
export interface RosterPlan {
  id: string; actorId: string; classId: string; cohortId: string; teacherId: string;
  hash: string; expiresAt: number; rows: RosterRow[]; counts: RosterImportCounts;
  state: 'preview' | 'completed'; receipt: ImportReceipt | null;
}
const rowSchema = z.object({
  studentNumber: z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9_.-]{2,63}$/).refine(v => !/^\d+(?:\.\d+)?e[+-]?\d+$/i.test(v), '疑似科学计数，须从文本学号重新导出'),
  displayName: z.string().min(1).max(100).refine(v => v === v.trim() && !/[\u0000-\u001f]/.test(v), '姓名含首尾空格或控制字符'),
});
function parseRoster(csv: string): Array<{ studentNumber: string; displayName: string }> {
  ensure(Buffer.byteLength(csv) <= 2 * 1024 * 1024, 400, 'INVALID_CSV', '名单最大2MB');
  let records: string[][];
  try { records = parse(csv, { bom: true, cast: false, skip_empty_lines: true, max_record_size: 4096 }) as string[][]; }
  catch { ensure(false, 400, 'INVALID_CSV', 'CSV格式无效；请保留学号为文本并使用UTF-8'); }
  ensure(records.length >= 2 && records.length <= 1001, 400, 'INVALID_CSV', '每次导入1至1000条名单');
  const aliases: Record<string, string> = { studentNumber: 'studentNumber', displayName: 'displayName', '学号': 'studentNumber', '姓名': 'displayName' };
  const headers = records[0].map(header => aliases[header]);
  ensure(headers.length === 2 && new Set(headers).size === 2 && headers.includes('studentNumber') && headers.includes('displayName'),
    400, 'INVALID_CSV', '列必须且只能是学号、姓名，或studentNumber、displayName，不允许角色/教师归属列');
  return records.slice(1).map(record => ({ studentNumber: record[headers.indexOf('studentNumber')], displayName: record[headers.indexOf('displayName')] }));
}
function countsFor(rows: RosterRow[]): RosterImportCounts {
  return { newAccounts: rows.filter(r => r.status === 'new').length, existingAccounts: rows.filter(r => r.status === 'existing').length,
    alreadyEnrolled: rows.filter(r => r.status === 'already_enrolled').length, invalid: rows.filter(r => r.status === 'invalid').length, conflicts: rows.filter(r => r.status === 'conflict').length };
}

/** Controlled OS-local tooling only; no public/teacher roster-write endpoint. */
export class RosterImporter {
  constructor(private store: Store, private auth: LocalAuth, private privateRoot: string, private now = Date.now) {}
  private target(actor: User, classId: string): ClassRecord & { cohortId: string } {
    requireLocalAdmin(this.store, actor);
    const c = this.store.get<ClassRecord>('class', classId);
    ensure(c?.cohortId, 400, 'COHORT_REQUIRED', '名单仅导入到已明确绑定批次的班级');
    const cohort = requireCohort(this.store, c.cohortId);
    ensure(cohort.teacherIds.includes(c.teacherId) && this.store.get<User>('user', c.teacherId)?.role === 'teacher', 409, 'INVALID_TEACHER', '班级教师与批次授权不一致');
    return { ...c, cohortId: c.cohortId };
  }
  private classify(classId: string, source: Array<{ studentNumber: string; displayName: string }>): RosterRow[] {
    const frequency = new Map<string, number>();
    for (const row of source) frequency.set(row.studentNumber, (frequency.get(row.studentNumber) ?? 0) + 1);
    return source.map((row, index) => {
      const base = { ...row, rowNumber: index + 1, userId: null };
      if (!rowSchema.safeParse(row).success) return { ...base, status: 'invalid', message: '学号/姓名格式无效；保留前导零，拒绝科学计数和首尾空格' };
      if (frequency.get(row.studentNumber)! > 1) return { ...base, status: 'invalid', message: '同一名单中学号重复，不自动合并' };
      const identity = this.store.get<StudentIdentity>('student_identity', row.studentNumber);
      const account = this.store.get<Account>('account', row.studentNumber);
      if (!identity) return account ? { ...base, status: 'conflict', message: '已有同名账号但未核实学号身份，不自动接管' } : { ...base, status: 'new', message: null };
      const user = this.store.get<User>('user', identity.userId);
      if (!user || user.role !== 'student' || account?.user.id !== user.id || account.user.role !== 'student' || account.user.displayName !== row.displayName || identity.displayName !== row.displayName || user.displayName !== row.displayName)
        return { ...base, status: 'conflict', message: '已有学号的姓名、账号或角色不一致，不覆盖' };
      return { ...base, userId: user.id, status: this.store.get('member', keyFor(classId, user.id)) ? 'already_enrolled' : 'existing', message: null };
    });
  }
  private hash(actor: User, c: ClassRecord, rows: RosterRow[]): string {
    return createHash('sha256').update(JSON.stringify({ actorId: actor.id, classId: c.id, cohortId: c.cohortId, teacherId: c.teacherId, rows })).digest('hex');
  }
  preview(actor: User, classId: string, csv: string): RosterPlan {
    const c = this.target(actor, classId); const rows = this.classify(classId, parseRoster(csv));
    const plan: RosterPlan = { id: randomUUID(), actorId: actor.id, classId, cohortId: c.cohortId, teacherId: c.teacherId,
      hash: this.hash(actor, c, rows), expiresAt: this.now() + 30 * 60 * 1000, rows, counts: countsFor(rows), state: 'preview', receipt: null };
    this.store.put('roster_plan', plan.id, plan); return plan;
  }
  private validate(actor: User, planId: string, hash: string): RosterPlan {
    requireLocalAdmin(this.store, actor);
    const plan = this.store.get<RosterPlan>('roster_plan', planId);
    ensure(plan && plan.actorId === actor.id, 404, 'NOT_FOUND', '导入计划不存在或不可访问');
    ensure(plan.hash === hash, 409, 'IMPORT_PLAN_MISMATCH', '确认指纹不一致，请重新核对预览');
    if (plan.state === 'completed') return plan;
    ensure(plan.expiresAt > this.now(), 409, 'IMPORT_PLAN_EXPIRED', '导入预览已过期，请重新预览');
    ensure(plan.counts.invalid === 0 && plan.counts.conflicts === 0, 409, 'IMPORT_HAS_ERRORS', '先修正所有错误/冲突，不部分导入');
    const c = this.target(actor, plan.classId);
    const rows = this.classify(c.id, plan.rows.map(({ studentNumber, displayName }) => ({ studentNumber, displayName })));
    ensure(this.hash(actor, c, rows) === plan.hash, 409, 'IMPORT_PLAN_STALE', '账号、名单或班级已变化，请重新预览');
    return plan;
  }
  private path(destination: string): string {
    const root = resolve(this.privateRoot); const target = resolve(destination); const rel = relative(root, target);
    ensure(rel && !rel.startsWith('..') && !isAbsolute(rel), 400, 'PRIVATE_PATH_REQUIRED', '输出必须位于backend/private-data内');
    mkdirSync(root, { recursive: true });
    ensure(!lstatSync(root).isSymbolicLink(), 400, 'PRIVATE_PATH_REQUIRED', '私密输出目录不能是符号链接或联接点');
    mkdirSync(dirname(target), { recursive: true });
    const actual = relative(realpathSync(root), realpathSync(dirname(target)));
    ensure(!actual.startsWith('..') && !isAbsolute(actual), 400, 'PRIVATE_PATH_REQUIRED', '私密输出路径不能跳转到目录外');
    return target;
  }
  writePreview(plan: RosterPlan, destination: string): void {
    const path = this.path(destination); mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify(plan, null, 2), { flag: 'wx', mode: 0o600 });
  }
  async commit(actor: User, planId: string, hash: string, destination: string): Promise<ImportReceipt> {
    const plan = this.validate(actor, planId, hash); if (plan.receipt) return plan.receipt;
    const file = this.path(destination);
    const prepared = new Map<string, Account>();
    const credentials: Array<{ studentNumber: string; username: string; password: string }> = [];
    // Bounded concurrency without holding a database lock while bcrypt hashes.
    const newRows = plan.rows.filter(row => row.status === 'new');
    for (let i = 0; i < newRows.length; i += 4) await Promise.all(newRows.slice(i, i + 4).map(async row => {
      const password = randomBytes(24).toString('base64url');
      prepared.set(row.studentNumber, await this.auth.prepareUser(row.studentNumber, password, row.displayName, 'student'));
      credentials.push({ studentNumber: row.studentNumber, username: row.studentNumber, password });
    }));
    let createdFile = false;
    try {
      return this.store.transaction(() => {
        const current = this.validate(actor, planId, hash); if (current.receipt) return current.receipt;
        mkdirSync(dirname(file), { recursive: true });
        writeFileSync(file, JSON.stringify({ notice: '私密初始口令，仅交付对应学生；不得上传GitHub。已有账号口令不变。', planId, accounts: credentials }, null, 2), { flag: 'wx', mode: 0o600 });
        createdFile = true;
        let newEnrollments = 0;
        for (const row of current.rows) {
          let userId = row.userId;
          if (row.status === 'new') {
            const account = prepared.get(row.studentNumber)!; userId = this.auth.persistPrepared(account).id;
            this.store.put<StudentIdentity>('student_identity', row.studentNumber, { studentNumber: row.studentNumber, userId, displayName: row.displayName });
          }
          ensure(userId, 409, 'IMPORT_PLAN_STALE', '身份状态已变化');
          const id = keyFor(current.classId, userId);
          if (!this.store.get('member', id)) { this.store.put<Member>('member', id, { id, classId: current.classId, studentId: userId }); newEnrollments++; }
        }
        const receipt: ImportReceipt = { planId, classId: current.classId, cohortId: current.cohortId, counts: current.counts,
          newEnrollments, credentialsFile: file, completedAt: new Date(this.now()).toISOString() };
        current.state = 'completed'; current.receipt = receipt;
        this.store.put('roster_plan', planId, current); this.store.put('roster_receipt', planId, { ...receipt, actorId: actor.id });
        return receipt;
      });
    } catch (error) { if (createdFile) unlinkSync(file); throw error; }
  }
}
