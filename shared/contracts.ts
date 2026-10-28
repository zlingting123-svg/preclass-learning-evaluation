/** Shared contract v0.2.0 — additive cohorts and controlled roster tooling. */
export const CONTRACT_VERSION = '0.2.0' as const;
export type ID = string;
/** UTC ISO 8601; display in Asia/Shanghai. */
export type ISODateTime = string;
export type Role = 'student' | 'teacher' | 'admin';
export type ApiMode = 'mock' | 'http';
export type ApiResponse<T> =
  | { ok: true; data: T; requestId: string }
  | { ok: false; error: { code: string; message: string; details?: Record<string, unknown> }; requestId: string };
export interface Page<T> { items: T[]; nextCursor: string | null }
export interface User { id: ID; displayName: string; role: Role }
export interface LoginRequest { username: string; password: string }
export interface AuthSession { user: User; accessToken: string; expiresAt: ISODateTime }
export interface ClassInfo {
  id: ID; name: string; teacherId: ID; memberCount: number;
  /** Present only for the owning teacher, omitted from student responses. */
  joinCode?: string;
  /** Legacy classes omit this field; new controlled cohorts use an opaque ID. */
  cohortId?: ID | null;
}
export interface CohortInfo {
  id: ID;
  name: string;
  courseName: string;
  startsOn: string;
  endsOn: string;
  plannedStudentCount: number | null;
  plannedTeacherCount: number | null;
  assignmentsPerStudent: number | null;
  teacherCount: number;
  createdAt: ISODateTime;
}
export interface RosterImportCounts {
  newAccounts: number; existingAccounts: number; alreadyEnrolled: number; invalid: number; conflicts: number;
}
export interface Question { id: ID; prompt: string; maxLength: number }
export interface RubricDimension { id: ID; name: string; description: string; maxScore: number }
export interface RubricInfo {
  id: ID;
  name: string;
  version: string;
  dimensions: RubricDimension[];
  /** Explanation only; never execute arbitrary text as scoring code. */
  aggregationDescription: string;
}
export type AssignmentState = 'draft' | 'published' | 'closed';
export interface Assignment {
  id: ID;
  classId: ID;
  title: string;
  instructions: string;
  questions: Question[];
  state: AssignmentState;
  deadlineAt: ISODateTime | null;
  rubricId: ID | null;
  rubricVersion: string | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  version: number;
}
export interface AssignmentInput {
  classId: ID;
  title: string;
  instructions: string;
  questions: Question[];
  deadlineAt: ISODateTime | null;
  rubricId: ID | null;
  /** 0 when creating; current Assignment.version when updating. */
  expectedVersion: number;
}
export interface Answer { questionId: ID; text: string }
export interface SaveDraftRequest { answers: Answer[]; expectedVersion: number }
/** HTTP header Idempotency-Key is required; reuse key for the same retry. */
export interface SubmitRequest { answers: Answer[]; expectedVersion: number }
export type SubmissionState = 'draft' | 'submitted';
export type ScoringStatus =
  | 'not_requested' | 'awaiting_rubric' | 'queued' | 'processing'
  | 'scored' | 'needs_review' | 'failed';
export interface Submission {
  id: ID;
  assignmentId: ID;
  studentId: ID;
  studentName: string;
  state: SubmissionState;
  scoringStatus: ScoringStatus;
  answers: Answer[];
  version: number;
  updatedAt: ISODateTime;
  submittedAt: ISODateTime | null;
  failureMessage: string | null;
}
export interface DimensionScore {
  dimensionId: ID;
  name: string;
  score: number;
  maxScore: number;
  rationale: string;
}
/** List data omits full answers; load details only when authorized and needed. */
export type SubmissionOverview = Omit<Submission, 'answers'>;
export interface ScoreValue {
  dimensions: DimensionScore[];
  /** Values supplied by configured backend aggregation; not inferred by UI. */
  totalScore: number | null;
  totalMaxScore: number | null;
  feedback: string;
}
export interface TeacherReview {
  id: ID;
  teacherId: ID;
  reviewedAt: ISODateTime;
  scores: ScoreValue;
  reason: string;
}
export interface ScoreReport {
  id: ID;
  submissionId: ID;
  rubricId: ID;
  rubricVersion: string;
  method: 'rule' | 'ai' | 'manual';
  modelProvider: string | null;
  modelVersion: string | null;
  generatedAt: ISODateTime;
  systemScores: ScoreValue | null;
  reviews: TeacherReview[];
  latestReview: TeacherReview | null;
  version: number;
}
export interface ReportView { submissionId: ID; scoringStatus: ScoringStatus; report: ScoreReport | null }
export interface SubmissionDetail { submission: Submission | null; report: ScoreReport | null }
export interface ReviewRequest {
  expectedReportVersion: number;
  dimensions: Array<{ dimensionId: ID; score: number; rationale: string }>;
  feedback: string;
  reason: string;
}
export interface AssignmentSummary {
  assignmentId: ID;
  memberCount: number;
  submittedCount: number;
  unsubmittedCount: number;
  /** Counts formal submissions only; keep draft out of scoring totals. */
  scoringCounts: Record<ScoringStatus, number>;
}
