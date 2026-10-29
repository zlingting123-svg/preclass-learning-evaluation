import type {
  Assignment,
  AssignmentInput,
  AssignmentSummary,
  AuthSession,
  ClassInfo,
  CohortInfo,
  ID,
  LoginRequest,
  Page,
  ReportView,
  ReviewRequest,
  RubricInfo,
  SaveDraftRequest,
  ScoreReport,
  ScoringStatus,
  Submission,
  SubmissionDetail,
  SubmissionOverview,
  SubmitRequest,
  User,
} from '@shared/contracts'
import { getAccessToken, notifyUnauthorized } from '../services/authStore'
import { ApiError } from '../services/apiError'
import type { FrontendApi, PageQuery } from '../services/apiTypes'
import {
  mockAssignments,
  mockClasses,
  mockReports,
  mockRubrics,
  mockSubmissions,
  mockUsers,
  studentClassIds,
  type MockUser,
} from './data'

/* ------------------------------------------------------------------ */
/* 内存状态：深拷贝初始演示数据，供本次页面会话内交互使用。              */
/* ------------------------------------------------------------------ */
function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

const users = new Map<string, MockUser>(mockUsers.map((u) => [u.id, clone(u)]))
const classes = new Map<string, ClassInfo>(mockClasses.map((c) => [c.id, clone(c)]))
const rubrics = new Map<string, RubricInfo>(mockRubrics.map((r) => [r.id, clone(r)]))
const assignments = new Map<string, Assignment>(mockAssignments.map((a) => [a.id, clone(a)]))
const submissions = new Map<string, Submission>(mockSubmissions.map((s) => [s.id, clone(s)]))
const reports = new Map<string, ScoreReport>(
  mockReports.map((r) => [r.submissionId, clone(r)]),
)

// 登录后生成的令牌 → 用户；刷新页面即清空（与“运行内存保存令牌”一致）。
const tokens = new Map<string, { userId: string }>()
// 幂等键 → 提交内容与结果，模拟服务端幂等重放。
const idempotency = new Map<string, { content: unknown; result: Submission }>()

// 演示账号用户名 → 用户。
const usernameToUser: Record<string, MockUser> = {
  student: users.get('u_stu_demo') as MockUser,
  teacher: users.get('u_tch_demo') as MockUser,
  expired: users.get('u_exp_demo') as MockUser,
}

let seq = 0
function randomId(): string {
  seq += 1
  return `${String(seq).padStart(4, '0')}-${Math.random().toString(36).slice(2, 8)}`
}

function nowIso(): string {
  return new Date().toISOString()
}

function delay(ms = 200): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function apiError(
  code: string,
  message: string,
  status: number,
  details?: Record<string, unknown>,
): ApiError {
  return new ApiError(code, message, status, details, `mock-${randomId()}`)
}

function versionConflict(latest: number): ApiError {
  return apiError('VERSION_CONFLICT', '数据已被其他操作更新，请刷新后重试', 409, {
    latestVersion: latest,
  })
}

function publicUser(user: MockUser): User {
  return { id: user.id, displayName: user.displayName, role: user.role }
}

/** 校验当前令牌并返回用户；无效/过期时触发统一 401 处理。 */
function currentUser(): MockUser {
  const token = getAccessToken()
  if (!token) {
    throw apiError('UNAUTHENTICATED', '请先登录', 401)
  }
  const rec = tokens.get(token)
  const user = rec ? users.get(rec.userId) : undefined
  if (!rec || !user || user.alwaysExpired) {
    notifyUnauthorized()
    throw apiError('SESSION_EXPIRED', '会话已过期，请重新登录', 401)
  }
  return user
}

function requireTeacher(): MockUser {
  const user = currentUser()
  if (user.role !== 'teacher' && user.role !== 'admin') {
    throw apiError('FORBIDDEN', '没有权限执行此操作', 403)
  }
  return user
}

function requireStudent(): MockUser {
  const user = currentUser()
  if (user.role !== 'student' && user.role !== 'admin') {
    throw apiError('FORBIDDEN', '没有权限执行此操作', 403)
  }
  return user
}

function mustGetAssignment(id: ID): Assignment {
  const a = assignments.get(id)
  if (!a) throw apiError('NOT_FOUND', '作业不存在或不可访问', 404)
  return a
}

function assertOwner(a: Assignment, user: MockUser): void {
  if (classes.get(a.classId)?.teacherId !== user.id) {
    throw apiError('FORBIDDEN', '没有权限访问该班级的作业', 403)
  }
}

function paginate<T extends { id: ID }>(items: T[], params?: PageQuery): Page<T> {
  const limit = Math.min(params?.limit ?? 20, 100)
  let start = 0
  if (params?.cursor) {
    const idx = items.findIndex((it) => it.id === params.cursor)
    if (idx >= 0) start = idx + 1
  }
  const page = items.slice(start, start + limit)
  const nextCursor =
    start + limit < items.length ? (page[page.length - 1] as T | undefined)?.id ?? null : null
  return { items: page, nextCursor }
}

function toOverview(sub: Submission): SubmissionOverview {
  const { answers: _answers, ...rest } = sub
  return rest
}

function applyAssignmentInput(a: Assignment, input: AssignmentInput): Assignment {
  const rubricVersion = input.rubricId ? rubrics.get(input.rubricId)?.version ?? null : null
  return {
    ...a,
    classId: input.classId,
    title: input.title,
    instructions: input.instructions,
    questions: input.questions,
    deadlineAt: input.deadlineAt,
    rubricId: input.rubricId,
    rubricVersion,
    updatedAt: nowIso(),
    version: a.version + 1,
  }
}

/** 根据作业演示行为确定提交后的评分状态。 */
function determineStatus(a: Assignment): ScoringStatus {
  if (!a.rubricId) return 'awaiting_rubric'
  switch (a.id) {
    case 'asg_published_queued':
      return 'queued'
    case 'asg_published_failed':
      return 'failed'
    case 'asg_published_review':
      return 'needs_review'
    default:
      return 'scored'
  }
}

function buildDemoReport(sub: Submission, a: Assignment, status: ScoringStatus): ScoreReport {
  const rubric = rubrics.get(a.rubricId as string)
  if (!rubric) {
    // 无规则时不应生成评分；由 determineStatus 保证不会走到这里。
    throw apiError('RUBRIC_UNCONFIGURED', '评价体系尚未配置', 400)
  }
  const factor = status === 'needs_review' ? 0.6 : 0.8
  const dimensions = rubric.dimensions.map((d) => ({
    dimensionId: d.id,
    name: d.name,
    score: Math.round(d.maxScore * factor),
    maxScore: d.maxScore,
    rationale: '（演示自动评分评语）',
  }))
  const totalScore = dimensions.reduce((s, d) => s + d.score, 0)
  const totalMaxScore = dimensions.reduce((s, d) => s + d.maxScore, 0)
  return {
    id: `rep_${randomId()}`,
    submissionId: sub.id,
    rubricId: rubric.id,
    rubricVersion: rubric.version,
    method: 'ai',
    modelProvider: 'demo-model-provider',
    modelVersion: 'demo-1',
    generatedAt: nowIso(),
    systemScores: {
      dimensions,
      totalScore,
      totalMaxScore,
      feedback: status === 'needs_review' ? '系统初评完成，需要教师复核（演示）' : '系统初评完成（演示评语）',
    },
    reviews: [],
    latestReview: null,
    version: 1,
  }
}

function escapeCsvCell(value: string): string {
  // 公式注入防护：以 = + - @ 或制表符开头的单元格前置单引号。
  let out = value
  if (/^[=+\-@\t]/.test(out)) out = `'${out}`
  if (/[",\r\n]/.test(out)) out = `"${out.replace(/"/g, '""')}"`
  return out
}

/* ------------------------------------------------------------------ */
/* mock 实现                                                           */
/* ------------------------------------------------------------------ */
export const mockApi: FrontendApi = {
  async login(input: LoginRequest): Promise<AuthSession> {
    await delay()
    const user = usernameToUser[input.username]
    if (!user || user.password !== input.password) {
      throw apiError('INVALID_CREDENTIALS', '用户名或密码错误（演示账号见登录页提示）', 401)
    }
    const token = `demo-token-${randomId()}`
    tokens.set(token, { userId: user.id })
    return {
      user: publicUser(user),
      accessToken: token,
      expiresAt: new Date(Date.now() + 2 * 3600_000).toISOString(),
    }
  },

  async me(): Promise<User> {
    await delay()
    return publicUser(currentUser())
  },

  async logout(): Promise<{ success: true }> {
    await delay()
    const token = getAccessToken()
    if (token) tokens.delete(token)
    return { success: true }
  },

  async listCohorts(_params?: PageQuery): Promise<Page<CohortInfo>> {
    await delay()
    currentUser()
    // Existing demo fixtures are legacy classes; do not invent teaching cohorts.
    return { items: [], nextCursor: null }
  },
  async listClasses(params?: PageQuery & { cohortId?: ID }): Promise<Page<ClassInfo>> {
    await delay()
    const user = currentUser()
    const items =
      user.role === 'student'
        ? studentClassIds.map((id) => classes.get(id)).filter((c): c is ClassInfo => Boolean(c))
        : [...classes.values()].filter((c) => c.teacherId === user.id)
    const filtered = params?.cohortId ? items.filter(c => c.cohortId === params.cohortId) : items
    return paginate(user.role === 'student' ? filtered.map(({ joinCode: _code, ...c }) => c) : filtered, params)
  },

  async joinClass(input: { joinCode: string }): Promise<ClassInfo> {
    await delay()
    requireStudent()
    const found = [...classes.values()].find((c) => c.joinCode === input.joinCode.toUpperCase())
    if (!found) throw apiError('NOT_FOUND', '班级不存在或加入码无效', 404)
    if (!studentClassIds.includes(found.id)) studentClassIds.push(found.id)
    const { joinCode: _code, ...info } = found
    return info
  },

  async createClass(input: { name: string; cohortId?: ID }): Promise<ClassInfo> {
    await delay()
    const user = requireTeacher()
    if (input.cohortId) throw apiError('NOT_FOUND', '演示中未配置该教学批次', 404)
    if (!input.name.trim()) throw apiError('VALIDATION_ERROR', '班级名称不能为空', 400)
    const c: ClassInfo = {
      id: `cls_${randomId()}`,
      name: input.name.trim(),
      teacherId: user.id,
      memberCount: 0,
      joinCode: `DEMO-${randomId().toUpperCase()}`,
    }
    classes.set(c.id, c)
    return c
  },

  async listAssignments(params: { classId?: string } & PageQuery): Promise<Page<Assignment>> {
    await delay()
    const user = currentUser()
    let items = [...assignments.values()]
    if (params?.classId) items = items.filter((a) => a.classId === params.classId)
    if (user.role === 'student') {
      items = items.filter((a) => a.state === 'published' && studentClassIds.includes(a.classId))
    } else if (user.role === 'teacher') {
      items = items.filter((a) => classes.get(a.classId)?.teacherId === user.id)
    }
    return paginate(items, params)
  },

  async getAssignment(id: ID): Promise<Assignment> {
    await delay()
    const user = currentUser()
    const a = mustGetAssignment(id)
    if (user.role === 'student') {
      if (a.state !== 'published' || !studentClassIds.includes(a.classId)) {
        throw apiError('NOT_FOUND', '作业不存在或不可访问', 404)
      }
    } else if (user.role === 'teacher') {
      assertOwner(a, user)
    }
    return a
  },

  async listRubrics(params?: PageQuery): Promise<Page<RubricInfo>> {
    await delay()
    requireTeacher()
    return paginate([...rubrics.values()], params)
  },

  async createAssignment(input: AssignmentInput): Promise<Assignment> {
    await delay()
    const user = requireTeacher()
    const cls = classes.get(input.classId)
    if (!cls || cls.teacherId !== user.id) {
      throw apiError('FORBIDDEN', '没有权限在该班级创建作业', 403)
    }
    const a: Assignment = {
      id: `asg_${randomId()}`,
      classId: input.classId,
      title: input.title,
      instructions: input.instructions,
      questions: input.questions,
      state: 'draft',
      deadlineAt: input.deadlineAt,
      rubricId: input.rubricId,
      rubricVersion: input.rubricId ? rubrics.get(input.rubricId)?.version ?? null : null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      version: 1,
    }
    assignments.set(a.id, a)
    return a
  },

  async updateAssignment(id: ID, input: AssignmentInput): Promise<Assignment> {
    await delay()
    const user = requireTeacher()
    const a = mustGetAssignment(id)
    assertOwner(a, user)
    if (a.state !== 'draft') throw apiError('VERSION_CONFLICT', '仅草稿可编辑', 409)
    if (input.expectedVersion !== a.version) throw versionConflict(a.version)
    const updated = applyAssignmentInput(a, input)
    assignments.set(id, updated)
    return updated
  },

  async publishAssignment(id: ID, input: { expectedVersion: number }): Promise<Assignment> {
    await delay()
    const user = requireTeacher()
    const a = mustGetAssignment(id)
    assertOwner(a, user)
    if (input.expectedVersion !== a.version) throw versionConflict(a.version)
    if (a.state !== 'draft') throw apiError('VERSION_CONFLICT', '当前状态不可发布', 409)
    if (!a.title.trim() || a.questions.length === 0 || a.questions.some((q) => !q.prompt.trim())) {
      throw apiError('VALIDATION_ERROR', '发布前需要填写标题和至少一道题目', 400)
    }
    const updated: Assignment = { ...a, state: 'published', updatedAt: nowIso(), version: a.version + 1 }
    assignments.set(id, updated)
    return updated
  },

  async closeAssignment(id: ID, input: { expectedVersion: number }): Promise<Assignment> {
    await delay()
    const user = requireTeacher()
    const a = mustGetAssignment(id)
    assertOwner(a, user)
    if (input.expectedVersion !== a.version) throw versionConflict(a.version)
    if (a.state !== 'published') throw apiError('VERSION_CONFLICT', '当前状态不可关闭', 409)
    const updated: Assignment = { ...a, state: 'closed', updatedAt: nowIso(), version: a.version + 1 }
    assignments.set(id, updated)
    return updated
  },

  async bindRubric(id: ID, input: { rubricId: ID; expectedVersion: number }): Promise<Assignment> {
    await delay()
    const user = requireTeacher()
    const a = mustGetAssignment(id)
    assertOwner(a, user)
    if (input.expectedVersion !== a.version) throw versionConflict(a.version)
    if (!rubrics.has(input.rubricId)) throw apiError('NOT_FOUND', '评价规则不存在', 404)
    const updated: Assignment = {
      ...a,
      rubricId: input.rubricId,
      rubricVersion: rubrics.get(input.rubricId)?.version ?? null,
      updatedAt: nowIso(),
      version: a.version + 1,
    }
    assignments.set(id, updated)
    // 为等待规则的已提交答卷建立评分任务（演示：置为排队中）。
    for (const sub of submissions.values()) {
      if (sub.assignmentId === id && sub.scoringStatus === 'awaiting_rubric') {
        submissions.set(sub.id, { ...sub, scoringStatus: 'queued', updatedAt: nowIso() })
      }
    }
    return updated
  },

  async getMySubmission(assignmentId: ID): Promise<SubmissionDetail> {
    await delay()
    const user = requireStudent()
    const a = mustGetAssignment(assignmentId)
    if (!studentClassIds.includes(a.classId)) throw apiError('NOT_FOUND', '作业不存在或不可访问', 404)
    const sub = [...submissions.values()].find(
      (s) => s.assignmentId === assignmentId && s.studentId === user.id,
    )
    if (!sub) return { submission: null, report: null }
    return { submission: sub, report: reports.get(sub.id) ?? null }
  },

  async saveDraft(assignmentId: ID, input: SaveDraftRequest): Promise<Submission> {
    await delay()
    const user = requireStudent()
    const a = mustGetAssignment(assignmentId)
    if (!studentClassIds.includes(a.classId)) throw apiError('NOT_FOUND', '作业不存在或不可访问', 404)
    if (a.state === 'closed') throw apiError('VALIDATION_ERROR', '作业已截止，不能保存', 400)
    const existing = [...submissions.values()].find(
      (s) => s.assignmentId === assignmentId && s.studentId === user.id,
    )
    if (existing?.state === 'submitted') {
      throw apiError('ALREADY_SUBMITTED', '已提交的答卷不能修改', 409)
    }
    if (input.expectedVersion !== (existing?.version ?? 0)) {
      throw versionConflict(existing?.version ?? 0)
    }
    if (existing) {
      const updated: Submission = {
        ...existing,
        answers: input.answers,
        version: existing.version + 1,
        updatedAt: nowIso(),
      }
      submissions.set(existing.id, updated)
      return updated
    }
    const created: Submission = {
      id: `sub_${randomId()}`,
      assignmentId,
      studentId: user.id,
      studentName: user.displayName,
      state: 'draft',
      scoringStatus: 'not_requested',
      answers: input.answers,
      version: 1,
      updatedAt: nowIso(),
      submittedAt: null,
      failureMessage: null,
    }
    submissions.set(created.id, created)
    return created
  },

  async submit(assignmentId: ID, input: SubmitRequest, idempotencyKey: string): Promise<Submission> {
    await delay()
    const user = requireStudent()
    const a = mustGetAssignment(assignmentId)
    if (!studentClassIds.includes(a.classId)) throw apiError('NOT_FOUND', '作业不存在或不可访问', 404)
    if (a.state === 'closed') throw apiError('VALIDATION_ERROR', '作业已截止，不能提交', 400)
    if (a.state !== 'published') throw apiError('VALIDATION_ERROR', '作业尚未发布', 400)

    const content = { assignmentId, answers: input.answers, expectedVersion: input.expectedVersion }
    const replay = idempotency.get(idempotencyKey)
    if (replay) {
      if (JSON.stringify(replay.content) !== JSON.stringify(content)) {
        throw apiError('IDEMPOTENCY_CONFLICT', '同一幂等键用于不同内容，已被拒绝', 409)
      }
      return replay.result
    }

    const existing = [...submissions.values()].find(
      (s) => s.assignmentId === assignmentId && s.studentId === user.id,
    )
    if (existing?.state === 'submitted') {
      throw apiError('ALREADY_SUBMITTED', '该作业已提交，不能重复提交', 409)
    }
    if (input.expectedVersion !== (existing?.version ?? 0)) {
      throw versionConflict(existing?.version ?? 0)
    }

    const scoringStatus = determineStatus(a)
    const created: Submission = {
      id: existing?.id ?? `sub_${randomId()}`,
      assignmentId,
      studentId: user.id,
      studentName: user.displayName,
      state: 'submitted',
      scoringStatus,
      answers: input.answers,
      version: (existing?.version ?? 0) + 1,
      updatedAt: nowIso(),
      submittedAt: nowIso(),
      failureMessage: scoringStatus === 'failed' ? '评分服务在多次重试后仍失败（演示信息）' : null,
    }
    submissions.set(created.id, created)
    if (scoringStatus === 'scored' || scoringStatus === 'needs_review') {
      reports.set(created.id, buildDemoReport(created, a, scoringStatus))
    }
    idempotency.set(idempotencyKey, { content, result: created })
    return created
  },

  async getReport(submissionId: ID): Promise<ReportView> {
    await delay()
    const user = currentUser()
    const sub = submissions.get(submissionId)
    if (!sub) throw apiError('NOT_FOUND', '答卷不存在', 404)
    if (user.role === 'student') {
      if (sub.studentId !== user.id) throw apiError('FORBIDDEN', '没有权限查看该报告', 403)
    } else if (user.role === 'teacher') {
      const a = assignments.get(sub.assignmentId)
      if (!a || classes.get(a.classId)?.teacherId !== user.id) {
        throw apiError('FORBIDDEN', '没有权限查看该报告', 403)
      }
    }
    return { submissionId, scoringStatus: sub.scoringStatus, report: reports.get(submissionId) ?? null }
  },

  async listSubmissions(assignmentId: ID, params?: PageQuery): Promise<Page<SubmissionOverview>> {
    await delay()
    const user = requireTeacher()
    const a = mustGetAssignment(assignmentId)
    assertOwner(a, user)
    const items = [...submissions.values()]
      .filter((s) => s.assignmentId === assignmentId)
      .map(toOverview)
    return paginate(items, params)
  },

  async getSubmissionDetail(submissionId: ID): Promise<SubmissionDetail> {
    await delay()
    const user = requireTeacher()
    const sub = submissions.get(submissionId)
    if (!sub) throw apiError('NOT_FOUND', '答卷不存在', 404)
    const a = assignments.get(sub.assignmentId)
    if (!a || classes.get(a.classId)?.teacherId !== user.id) {
      throw apiError('FORBIDDEN', '没有权限查看该答卷', 403)
    }
    return { submission: sub, report: reports.get(submissionId) ?? null }
  },

  async getAssignmentSummary(assignmentId: ID): Promise<AssignmentSummary> {
    await delay()
    const user = requireTeacher()
    const a = mustGetAssignment(assignmentId)
    assertOwner(a, user)
    const cls = classes.get(a.classId)
    const subs = [...submissions.values()].filter((s) => s.assignmentId === assignmentId)
    const submitted = subs.filter((s) => s.state === 'submitted')
    const scoringCounts: Record<ScoringStatus, number> = {
      not_requested: 0,
      awaiting_rubric: 0,
      queued: 0,
      processing: 0,
      scored: 0,
      needs_review: 0,
      failed: 0,
    }
    for (const s of submitted) scoringCounts[s.scoringStatus] += 1
    const memberCount = cls?.memberCount ?? 0
    return {
      assignmentId,
      memberCount,
      submittedCount: submitted.length,
      unsubmittedCount: Math.max(0, memberCount - submitted.length),
      scoringCounts,
    }
  },

  async retryScoring(submissionId: ID, input: { expectedVersion: number }): Promise<Submission> {
    await delay()
    const user = requireTeacher()
    const sub = submissions.get(submissionId)
    if (!sub) throw apiError('NOT_FOUND', '答卷不存在', 404)
    const a = assignments.get(sub.assignmentId)
    if (!a || classes.get(a.classId)?.teacherId !== user.id) {
      throw apiError('FORBIDDEN', '没有权限操作该答卷', 403)
    }
    if (sub.scoringStatus !== 'failed') throw apiError('VALIDATION_ERROR', '仅失败状态可重试', 400)
    if (input.expectedVersion !== sub.version) throw versionConflict(sub.version)
    const updated: Submission = {
      ...sub,
      scoringStatus: 'scored',
      failureMessage: null,
      version: sub.version + 1,
      updatedAt: nowIso(),
    }
    submissions.set(submissionId, updated)
    reports.set(submissionId, buildDemoReport(updated, a, 'scored'))
    return updated
  },

  async review(submissionId: ID, input: ReviewRequest): Promise<ScoreReport> {
    await delay()
    const user = requireTeacher()
    const sub = submissions.get(submissionId)
    if (!sub) throw apiError('NOT_FOUND', '答卷不存在', 404)
    const a = assignments.get(sub.assignmentId)
    if (!a || classes.get(a.classId)?.teacherId !== user.id) {
      throw apiError('FORBIDDEN', '没有权限复核该答卷', 403)
    }
    const rep = reports.get(submissionId)
    if (!rep) throw apiError('VALIDATION_ERROR', '暂无评分报告可复核', 400)
    if (input.expectedReportVersion !== rep.version) throw versionConflict(rep.version)

    const rubric = rubrics.get(rep.rubricId)
    const dimensions = input.dimensions.map((d) => {
      const rd = rubric?.dimensions.find((x) => x.id === d.dimensionId)
      return {
        dimensionId: d.dimensionId,
        name: rd?.name ?? d.dimensionId,
        score: d.score,
        maxScore: rd?.maxScore ?? 0,
        rationale: d.rationale,
      }
    })
    const totalScore = dimensions.reduce((s, d) => s + d.score, 0)
    const totalMaxScore = dimensions.reduce((s, d) => s + d.maxScore, 0)
    const reviewRecord = {
      id: `rev_${randomId()}`,
      teacherId: user.id,
      reviewedAt: nowIso(),
      scores: {
        dimensions,
        totalScore,
        totalMaxScore,
        feedback: input.feedback,
      },
      reason: input.reason,
    }
    const updatedReport: ScoreReport = {
      ...rep,
      reviews: [...rep.reviews, reviewRecord],
      latestReview: reviewRecord,
      version: rep.version + 1,
    }
    reports.set(submissionId, updatedReport)
    if (sub.scoringStatus === 'needs_review') {
      submissions.set(submissionId, { ...sub, scoringStatus: 'scored', updatedAt: nowIso() })
    }
    return updatedReport
  },

  async exportCsv(assignmentId: ID): Promise<{ blob: Blob; filename: string }> {
    await delay()
    const user = requireTeacher()
    const a = mustGetAssignment(assignmentId)
    assertOwner(a, user)
    const subs = [...submissions.values()].filter((s) => s.assignmentId === assignmentId)
    const header = ['学号', '姓名', '状态', '评分状态', '提交时间']
    const rows = subs.map((s) =>
      [s.studentId, s.studentName, s.state, s.scoringStatus, s.submittedAt ?? '']
        .map(escapeCsvCell)
        .join(','),
    )
    const csv = `\uFEFF${[header.join(','), ...rows].join('\r\n')}`
    return { blob: new Blob([csv], { type: 'text/csv;charset=utf-8' }), filename: `export-${assignmentId}.csv` }
  },
}
