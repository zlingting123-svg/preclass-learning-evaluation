import type {
  Assignment,
  AssignmentInput,
  AssignmentSummary,
  AuthSession,
  ClassInfo,
  ID,
  LoginRequest,
  Page,
  ReportView,
  ReviewRequest,
  RubricInfo,
  SaveDraftRequest,
  ScoreReport,
  Submission,
  SubmissionDetail,
  SubmissionOverview,
  SubmitRequest,
  User,
} from '@shared/contracts'

export interface PageQuery {
  limit?: number
  cursor?: string
}

/**
 * 统一数据访问层接口。页面组件只依赖此接口，不直接接触 mock/http 细节。
 * mock 与 http 两个适配器实现同一份契约语义。
 */
export interface FrontendApi {
  // 认证
  login(input: LoginRequest): Promise<AuthSession>
  me(): Promise<User>
  logout(): Promise<{ success: true }>

  // 班级
  listClasses(params?: PageQuery): Promise<Page<ClassInfo>>
  joinClass(input: { joinCode: string }): Promise<ClassInfo>
  createClass(input: { name: string }): Promise<ClassInfo>

  // 作业（学生仅见已发布且所属；教师仅见负责范围）
  listAssignments(params: { classId?: string } & PageQuery): Promise<Page<Assignment>>
  getAssignment(id: ID): Promise<Assignment>

  // 评价规则（由后台配置，前端不发明正式体系）
  listRubrics(params?: PageQuery): Promise<Page<RubricInfo>>

  // 教师作业管理
  createAssignment(input: AssignmentInput): Promise<Assignment>
  updateAssignment(id: ID, input: AssignmentInput): Promise<Assignment>
  publishAssignment(id: ID, input: { expectedVersion: number }): Promise<Assignment>
  closeAssignment(id: ID, input: { expectedVersion: number }): Promise<Assignment>
  bindRubric(id: ID, input: { rubricId: ID; expectedVersion: number }): Promise<Assignment>

  // 学生答卷
  getMySubmission(assignmentId: ID): Promise<SubmissionDetail>
  saveDraft(assignmentId: ID, input: SaveDraftRequest): Promise<Submission>
  submit(assignmentId: ID, input: SubmitRequest, idempotencyKey: string): Promise<Submission>
  getReport(submissionId: ID): Promise<ReportView>

  // 教师答卷
  listSubmissions(assignmentId: ID, params?: PageQuery): Promise<Page<SubmissionOverview>>
  getSubmissionDetail(submissionId: ID): Promise<SubmissionDetail>
  getAssignmentSummary(assignmentId: ID): Promise<AssignmentSummary>
  retryScoring(submissionId: ID, input: { expectedVersion: number }): Promise<Submission>
  review(submissionId: ID, input: ReviewRequest): Promise<ScoreReport>
  exportCsv(assignmentId: ID): Promise<{ blob: Blob; filename: string }>
}
