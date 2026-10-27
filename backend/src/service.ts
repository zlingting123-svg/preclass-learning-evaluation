import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type {
  Assignment, AssignmentInput, AssignmentSummary, Answer, ClassInfo, Page, ReportView,
  ReviewRequest, RubricInfo, SaveDraftRequest, ScoreReport, ScoringStatus, Submission,
  SubmissionDetail, SubmissionOverview, User,
} from '../../shared/contracts.js';
import type { Store } from './store.js';
import { ensure } from './errors.js';
import { safeCsv } from './csv.js';

interface ClassRecord { id: string; name: string; teacherId: string; joinCode: string }
interface Member { id: string; classId: string; studentId: string }
interface Replay { fingerprint: string; submission: Submission }
export interface Job {
  id: string; submissionId: string; rubricId: string; rubricVersion: string;
  state: 'queued' | 'processing' | 'completed' | 'failed';
  attempts: number; nextAt: number; leaseUntil: number; leaseToken: string | null;
}
const keyFor = (...values: string[]) => createHash('sha256').update(JSON.stringify(values)).digest('hex');
const sameAnswers = (a: Answer[]) => [...a].sort((x, y) => x.questionId.localeCompare(y.questionId));
const statuses: ScoringStatus[] = ['not_requested', 'awaiting_rubric', 'queued', 'processing', 'scored', 'needs_review', 'failed'];

export class Service {
  constructor(readonly store: Store, readonly now: () => number = Date.now) {}
  iso(): string { return new Date(this.now()).toISOString(); }
  role(user: User, role: User['role']): void { ensure(user.role === role, 403, 'FORBIDDEN', '角色无权执行此操作'); }
  private classRecord(id: string): ClassRecord {
    const c = this.store.get<ClassRecord>('class', id);
    ensure(c, 404, 'NOT_FOUND', '班级不存在或不可访问'); return c;
  }
  classAccess(user: User, classId: string): ClassRecord {
    const c = this.classRecord(classId);
    ensure((user.role === 'teacher' && c.teacherId === user.id) ||
      (user.role === 'student' && this.store.get('member', keyFor(classId, user.id))), 403, 'FORBIDDEN', '无班级权限');
    return c;
  }
  private info(user: User, c: ClassRecord): ClassInfo {
    return { id: c.id, name: c.name, teacherId: c.teacherId,
      memberCount: this.store.all<Member>('member').filter(m => m.classId === c.id).length,
      ...(user.role === 'teacher' && user.id === c.teacherId ? { joinCode: c.joinCode } : {}) };
  }
  classes(user: User): ClassInfo[] {
    return this.store.all<ClassRecord>('class').filter(c => user.role === 'teacher' ? c.teacherId === user.id :
      user.role === 'student' && !!this.store.get('member', keyFor(c.id, user.id))).map(c => this.info(user, c));
  }
  createClass(user: User, name: string): ClassInfo {
    this.role(user, 'teacher');
    return this.store.transaction(() => {
      let joinCode: string;
      do { joinCode = randomBytes(8).toString('hex').toUpperCase(); }
      while (this.store.all<ClassRecord>('class').some(c => c.joinCode === joinCode));
      const c: ClassRecord = { id: randomUUID(), name, teacherId: user.id, joinCode };
      this.store.put('class', c.id, c); return this.info(user, c);
    });
  }
  join(user: User, joinCode: string): ClassInfo {
    this.role(user, 'student');
    return this.store.transaction(() => {
      const c = this.store.all<ClassRecord>('class').find(c => c.joinCode === joinCode);
      ensure(c, 404, 'NOT_FOUND', '加入码无效');
      const id = keyFor(c.id, user.id);
      this.store.put<Member>('member', id, { id, classId: c.id, studentId: user.id });
      return this.info(user, c);
    });
  }
  assignment(user: User, id: string, teacher = false): Assignment {
    if (teacher) this.role(user, 'teacher');
    const a = this.store.get<Assignment>('assignment', id);
    ensure(a, 404, 'NOT_FOUND', '作业不存在或不可访问');
    this.classAccess(user, a.classId);
    ensure(user.role !== 'student' || a.state !== 'draft', 404, 'NOT_FOUND', '作业未发布'); return a;
  }
  assignments(user: User, classId?: string): Assignment[] {
    if (classId) this.classAccess(user, classId);
    const allowed = new Set(this.classes(user).map(c => c.id));
    return this.store.all<Assignment>('assignment').filter(a => allowed.has(a.classId) &&
      (!classId || a.classId === classId) && (user.role !== 'student' || a.state !== 'draft'));
  }
  rubrics(user: User): RubricInfo[] { this.role(user, 'teacher'); return this.store.all<RubricInfo>('rubric'); }
  rubric(id: string): RubricInfo {
    const r = this.store.get<RubricInfo>('rubric', id);
    ensure(r, 400, 'RUBRIC_UNCONFIGURED', '评价体系尚未配置'); return r;
  }
  checkVersion(actual: number, expected: number): void {
    ensure(actual === expected, 409, 'VERSION_CONFLICT', '版本冲突，请重新查询，保留当前输入', { latestVersion: actual });
  }
  saveAssignment(user: User, input: AssignmentInput, id?: string): Assignment {
    this.role(user, 'teacher');
    return this.store.transaction(() => {
      this.classAccess(user, input.classId);
      const old = id ? this.assignment(user, id, true) : undefined;
      ensure(!old || old.state === 'draft', 409, 'ASSIGNMENT_LOCKED', '只能编辑草稿');
      this.checkVersion(old?.version ?? 0, input.expectedVersion);
      const rubric = input.rubricId ? this.rubric(input.rubricId) : null;
      const time = this.iso();
      const a: Assignment = { id: old?.id ?? randomUUID(), classId: input.classId, title: input.title,
        instructions: input.instructions, questions: input.questions, deadlineAt: input.deadlineAt,
        rubricId: rubric?.id ?? null, rubricVersion: rubric?.version ?? null,
        state: 'draft', version: (old?.version ?? 0) + 1, createdAt: old?.createdAt ?? time, updatedAt: time };
      this.store.put('assignment', a.id, a); return a;
    });
  }
  transition(user: User, id: string, expected: number, action: 'publish' | 'close'): Assignment {
    return this.store.transaction(() => {
      const a = this.assignment(user, id, true); this.checkVersion(a.version, expected);
      ensure(action === 'publish' ? a.state === 'draft' : a.state === 'published', 409, 'INVALID_STATE', '作业状态不允许此操作');
      if (action === 'publish') ensure(!a.deadlineAt || Date.parse(a.deadlineAt) > this.now(), 400, 'VALIDATION_ERROR', '截止时间必须在未来');
      a.state = action === 'publish' ? 'published' : 'closed'; a.version++; a.updatedAt = this.iso();
      this.store.put('assignment', a.id, a); return a;
    });
  }
  private enqueue(sub: Submission, a: Assignment): void {
    ensure(a.rubricId && a.rubricVersion, 400, 'RUBRIC_UNCONFIGURED', '评价体系尚未配置');
    const job: Job = { id: sub.id, submissionId: sub.id, rubricId: a.rubricId, rubricVersion: a.rubricVersion,
      state: 'queued', attempts: 0, nextAt: this.now(), leaseUntil: 0, leaseToken: null };
    this.store.put('job', sub.id, job);
  }
  bindRubric(user: User, id: string, rubricId: string, expected: number): Assignment {
    return this.store.transaction(() => {
      const a = this.assignment(user, id, true); this.checkVersion(a.version, expected);
      const r = this.rubric(rubricId);
      ensure(!a.rubricId || (a.rubricId === r.id && a.rubricVersion === r.version), 409, 'RUBRIC_LOCKED', '不能替换已有规则或历史评分');
      if (a.rubricId) return a;
      a.rubricId = r.id; a.rubricVersion = r.version; a.version++; a.updatedAt = this.iso();
      this.store.put('assignment', a.id, a);
      for (const sub of this.store.all<Submission>('submission').filter(s => s.assignmentId === id && s.scoringStatus === 'awaiting_rubric')) {
        sub.scoringStatus = 'queued'; sub.version++; sub.updatedAt = this.iso();
        this.store.put('submission', sub.id, sub); this.enqueue(sub, a);
      }
      return a;
    });
  }
  private writable(a: Assignment): void {
    ensure(a.state === 'published' && (!a.deadlineAt || Date.parse(a.deadlineAt) > this.now()), 409, 'ASSIGNMENT_CLOSED', '作业已截止或关闭');
  }
  private validateAnswers(a: Assignment, answers: Answer[], complete: boolean): void {
    const ids = new Set(answers.map(x => x.questionId));
    ensure(ids.size === answers.length, 400, 'VALIDATION_ERROR', '题目ID重复');
    for (const ans of answers) {
      const q = a.questions.find(q => q.id === ans.questionId);
      ensure(q && ans.text.length <= q.maxLength, 400, 'VALIDATION_ERROR', '题目ID或答案长度无效');
      if (complete) ensure(ans.text.trim(), 400, 'VALIDATION_ERROR', '正式答案不可为空');
    }
    if (complete) ensure(answers.length === a.questions.length, 400, 'VALIDATION_ERROR', '请完成所有题目');
  }
  mySubmission(user: User, assignmentId: string): SubmissionDetail {
    this.role(user, 'student'); this.assignment(user, assignmentId);
    const sub = this.store.get<Submission>('submission', keyFor(assignmentId, user.id));
    return { submission: sub ?? null, report: sub ? this.store.get<ScoreReport>('report', sub.id) ?? null : null };
  }
  saveAnswers(user: User, assignmentId: string, input: SaveDraftRequest, idempotencyKey?: string): Submission {
    this.role(user, 'student');
    return this.store.transaction(() => {
      const a = this.assignment(user, assignmentId);
      const id = keyFor(a.id, user.id);
      const replayId = idempotencyKey ? keyFor(id, idempotencyKey) : null;
      const fingerprint = JSON.stringify({ answers: sameAnswers(input.answers), expectedVersion: input.expectedVersion });
      if (replayId) {
        const replay = this.store.get<Replay>('replay', replayId);
        if (replay) {
          ensure(replay.fingerprint === fingerprint, 409, 'IDEMPOTENCY_CONFLICT', '同一幂等键不能用于不同内容');
          return replay.submission;
        }
      }
      this.writable(a); this.validateAnswers(a, input.answers, !!idempotencyKey);
      const old = this.store.get<Submission>('submission', id);
      ensure(old?.state !== 'submitted', 409, 'ALREADY_SUBMITTED', '已提交，不能覆盖');
      this.checkVersion(old?.version ?? 0, input.expectedVersion);
      const sub: Submission = { id, assignmentId, studentId: user.id, studentName: user.displayName,
        state: idempotencyKey ? 'submitted' : 'draft',
        scoringStatus: idempotencyKey ? (a.rubricId ? 'queued' : 'awaiting_rubric') : 'not_requested',
        answers: input.answers, version: (old?.version ?? 0) + 1, updatedAt: this.iso(),
        submittedAt: idempotencyKey ? this.iso() : null, failureMessage: null };
      this.store.put('submission', sub.id, sub);
      if (idempotencyKey && a.rubricId) this.enqueue(sub, a);
      if (replayId) this.store.put<Replay>('replay', replayId, { fingerprint, submission: sub });
      return sub;
    });
  }
  submission(user: User, id: string, teacherOnly = false): SubmissionDetail & { submission: Submission } {
    if (teacherOnly) this.role(user, 'teacher');
    const sub = this.store.get<Submission>('submission', id);
    ensure(sub, 404, 'NOT_FOUND', '答卷不存在或不可访问');
    const a = this.assignment(user, sub.assignmentId);
    ensure(user.role === 'teacher' || (user.role === 'student' && sub.studentId === user.id), 403, 'FORBIDDEN', '无答卷权限');
    this.classAccess(user, a.classId);
    return { submission: sub, report: this.store.get<ScoreReport>('report', sub.id) ?? null };
  }
  report(user: User, id: string): ReportView {
    const { submission, report } = this.submission(user, id);
    return { submissionId: id, scoringStatus: submission.scoringStatus, report };
  }
  overviews(user: User, id: string): SubmissionOverview[] {
    this.assignment(user, id, true);
    return this.store.all<Submission>('submission').filter(s => s.assignmentId === id).map(({ answers: _answers, ...rest }) => rest);
  }
  summary(user: User, id: string): AssignmentSummary {
    const a = this.assignment(user, id, true);
    const subs = this.overviews(user, id).filter(s => s.state === 'submitted');
    const memberCount = this.info(user, this.classRecord(a.classId)).memberCount;
    const scoringCounts = Object.fromEntries(statuses.map(s => [s, subs.filter(sub => sub.scoringStatus === s).length])) as Record<ScoringStatus, number>;
    return { assignmentId: id, memberCount, submittedCount: subs.length, unsubmittedCount: Math.max(0, memberCount - subs.length), scoringCounts };
  }
  retry(user: User, id: string, expected: number): Submission {
    return this.store.transaction(() => {
      const { submission: sub } = this.submission(user, id, true); this.checkVersion(sub.version, expected);
      ensure(sub.scoringStatus === 'failed', 409, 'INVALID_STATE', '仅失败评分可人工重试');
      const a = this.assignment(user, sub.assignmentId, true);
      sub.scoringStatus = 'queued'; sub.failureMessage = null; sub.version++; sub.updatedAt = this.iso();
      this.enqueue(sub, a); this.store.put('submission', sub.id, sub); return sub;
    });
  }
  review(user: User, id: string, input: ReviewRequest): ScoreReport {
    return this.store.transaction(() => {
      const { report, submission } = this.submission(user, id, true);
      ensure(report, 409, 'REPORT_UNAVAILABLE', '尚无系统评价可复核');
      this.checkVersion(report.version, input.expectedReportVersion);
      const rubric = this.rubric(report.rubricId);
      ensure(rubric.version === report.rubricVersion, 409, 'RUBRIC_VERSION_MISMATCH', '规则版本不匹配');
      const ids = new Set(input.dimensions.map(d => d.dimensionId));
      ensure(ids.size === rubric.dimensions.length && input.dimensions.length === rubric.dimensions.length, 400, 'VALIDATION_ERROR', '复核维度必须完整且唯一');
      const dimensions = rubric.dimensions.map(d => {
        const score = input.dimensions.find(x => x.dimensionId === d.id);
        ensure(score && score.score <= d.maxScore && score.score >= 0 && Number.isFinite(score.score), 400, 'VALIDATION_ERROR', '维度分值超出范围');
        return { dimensionId: d.id, name: d.name, maxScore: d.maxScore, score: score.score, rationale: score.rationale };
      });
      // No configured aggregation implementation: totals remain null, never guessed.
      const rev = { id: randomUUID(), teacherId: user.id, reviewedAt: this.iso(), reason: input.reason,
        scores: { dimensions, totalScore: null, totalMaxScore: null, feedback: input.feedback } };
      report.reviews.push(rev); report.latestReview = rev; report.version++;
      if (submission.scoringStatus === 'needs_review') {
        submission.scoringStatus = 'scored'; submission.version++; submission.updatedAt = this.iso();
        this.store.put('submission', id, submission);
      }
      this.store.put('report', id, report); return report;
    });
  }
  export(user: User, id: string): string {
    this.assignment(user, id, true);
    const rows: unknown[][] = [['submissionId', 'studentName', 'state', 'scoringStatus', 'submittedAt', 'answers', 'feedback']];
    for (const sub of this.store.all<Submission>('submission').filter(s => s.assignmentId === id)) {
      const report = this.store.get<ScoreReport>('report', sub.id);
      rows.push([sub.id, sub.studentName, sub.state, sub.scoringStatus, sub.submittedAt,
        JSON.stringify(sub.answers), (report?.latestReview?.scores ?? report?.systemScores)?.feedback ?? '']);
    }
    return safeCsv(rows);
  }
}

export function page<T extends { id: string }>(items: T[], limit: number, cursor?: string): Page<T> {
  const sorted = [...items].sort((a, b) => a.id.localeCompare(b.id));
  let start = 0;
  if (cursor) {
    const id = Buffer.from(cursor, 'base64url').toString('utf8');
    const index = sorted.findIndex(item => item.id === id);
    ensure(index >= 0, 400, 'INVALID_CURSOR', '分页位置无效，请从首页重新查询'); start = index + 1;
  }
  const selected = sorted.slice(start, start + limit);
  return { items: selected, nextCursor: start + limit < sorted.length ? Buffer.from(selected.at(-1)!.id).toString('base64url') : null };
}
