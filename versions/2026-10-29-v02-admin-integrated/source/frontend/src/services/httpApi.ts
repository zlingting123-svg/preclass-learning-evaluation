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
  Submission,
  SubmissionDetail,
  SubmissionOverview,
  SubmitRequest,
  User,
} from '@shared/contracts'
import { getAccessToken } from './authStore'
import { apiRequest, parseApiResponse } from './httpClient'
import { API_BASE_URL } from '../config'
import { ApiError } from './apiError'
import type { FrontendApi, PageQuery } from './apiTypes'

function qs(params?: Record<string, string | number | undefined>): string {
  if (!params) return ''
  const parts = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
  return parts.length ? `?${parts.join('&')}` : ''
}

function pageQuery(params?: PageQuery): Record<string, string | number | undefined> {
  return { limit: params?.limit, cursor: params?.cursor }
}

export const httpApi: FrontendApi = {
  async login(input: LoginRequest): Promise<AuthSession> {
    return apiRequest('POST', '/auth/login', { body: input })
  },
  async me(): Promise<User> {
    return apiRequest('GET', '/auth/me')
  },
  async logout(): Promise<{ success: true }> {
    return apiRequest('POST', '/auth/logout')
  },

  async listCohorts(params?: PageQuery): Promise<Page<CohortInfo>> {
    return apiRequest('GET', `/cohorts${qs(pageQuery(params))}`)
  },
  async listClasses(params?: PageQuery & { cohortId?: ID }): Promise<Page<ClassInfo>> {
    return apiRequest('GET', `/classes${qs({ ...pageQuery(params), cohortId: params?.cohortId })}`)
  },
  async joinClass(input: { joinCode: string }): Promise<ClassInfo> {
    return apiRequest('POST', '/classes/join', { body: input })
  },
  async createClass(input: { name: string; cohortId?: ID }): Promise<ClassInfo> {
    return apiRequest('POST', '/teacher/classes', { body: input })
  },

  async listAssignments(params: { classId?: string } & PageQuery): Promise<Page<Assignment>> {
    return apiRequest('GET', `/assignments${qs({ ...pageQuery(params), classId: params?.classId })}`)
  },
  async getAssignment(id: ID): Promise<Assignment> {
    return apiRequest('GET', `/assignments/${id}`)
  },

  async listRubrics(params?: PageQuery): Promise<Page<RubricInfo>> {
    return apiRequest('GET', `/teacher/rubrics${qs(pageQuery(params))}`)
  },

  async createAssignment(input: AssignmentInput): Promise<Assignment> {
    return apiRequest('POST', '/teacher/assignments', { body: input })
  },
  async updateAssignment(id: ID, input: AssignmentInput): Promise<Assignment> {
    return apiRequest('PUT', `/teacher/assignments/${id}`, { body: input })
  },
  async publishAssignment(id: ID, input: { expectedVersion: number }): Promise<Assignment> {
    return apiRequest('POST', `/teacher/assignments/${id}/publish`, { body: input })
  },
  async closeAssignment(id: ID, input: { expectedVersion: number }): Promise<Assignment> {
    return apiRequest('POST', `/teacher/assignments/${id}/close`, { body: input })
  },
  async bindRubric(id: ID, input: { rubricId: ID; expectedVersion: number }): Promise<Assignment> {
    return apiRequest('PUT', `/teacher/assignments/${id}/rubric`, { body: input })
  },

  async getMySubmission(assignmentId: ID): Promise<SubmissionDetail> {
    return apiRequest('GET', `/assignments/${assignmentId}/my-submission`)
  },
  async saveDraft(assignmentId: ID, input: SaveDraftRequest): Promise<Submission> {
    return apiRequest('PUT', `/assignments/${assignmentId}/my-draft`, { body: input })
  },
  async submit(assignmentId: ID, input: SubmitRequest, idempotencyKey: string): Promise<Submission> {
    return apiRequest('POST', `/assignments/${assignmentId}/submit`, {
      body: input,
      idempotencyKey,
    })
  },
  async getReport(submissionId: ID): Promise<ReportView> {
    return apiRequest('GET', `/submissions/${submissionId}/report`)
  },

  async listSubmissions(assignmentId: ID, params?: PageQuery): Promise<Page<SubmissionOverview>> {
    return apiRequest('GET', `/teacher/assignments/${assignmentId}/submissions${qs(pageQuery(params))}`)
  },
  async getSubmissionDetail(submissionId: ID): Promise<SubmissionDetail> {
    return apiRequest('GET', `/teacher/submissions/${submissionId}`)
  },
  async getAssignmentSummary(assignmentId: ID): Promise<AssignmentSummary> {
    return apiRequest('GET', `/teacher/assignments/${assignmentId}/summary`)
  },
  async retryScoring(submissionId: ID, input: { expectedVersion: number }): Promise<Submission> {
    return apiRequest('POST', `/teacher/submissions/${submissionId}/retry`, { body: input })
  },
  async review(submissionId: ID, input: ReviewRequest): Promise<ScoreReport> {
    return apiRequest('PUT', `/teacher/submissions/${submissionId}/review`, { body: input })
  },

  async exportCsv(assignmentId: ID): Promise<{ blob: Blob; filename: string }> {
    // CSV 导出返回二进制流，不走 JSON 信封；失败时同样抛出错误，不回退模拟。
    const token = getAccessToken()
    let res: Response
    try { res = await fetch(`${API_BASE_URL}/api/v1/teacher/assignments/${assignmentId}/export`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }) } catch { throw new ApiError('NETWORK_ERROR', '无法连接服务器，导出未完成', 0) }
    if (!res.ok) {
      await parseApiResponse(res, !!token)
      throw new ApiError('EXPORT_FAILED', '导出失败', res.status)
    }
    if (!res.headers.get('Content-Type')?.includes('text/csv')) throw new ApiError('INVALID_RESPONSE', '服务器未返回CSV文件', res.status)
    const disposition = res.headers.get('Content-Disposition') ?? ''
    const match = /filename="?([^";]+)"?/i.exec(disposition)
    const filename = match?.[1] ?? `export-${assignmentId}.csv`
    const blob = await res.blob()
    return { blob, filename }
  },
}
