export interface SurveyQuestion {
  id: string;
  title: string;
  type: "text" | "single" | "multiple";
  required: boolean;
  options: string[];
}
export interface Survey {
  id: string;
  classId: string;
  title: string;
  questions: SurveyQuestion[];
  state: "draft" | "published" | "closed";
  deadlineAt: string | null;
  durationMinutes: number | null;
  version: number;
}
export interface SurveyResponse {
  id: string;
  surveyId: string;
  studentId: string;
  studentNumber: string;
  studentName: string;
  startedAt: string;
  submittedAt: string | null;
  answers: Record<string, string | string[]>;
}
export interface SurveySession {
  survey: Survey;
  response: SurveyResponse;
  serverNow: string;
  expiresAt: string | null;
}
export interface SurveyStats {
  survey: Survey;
  students: Array<{
    studentId: string;
    studentNumber: string;
    studentName: string;
    status: string;
    responseId: string | null;
  }>;
  questions: Array<{
    id: string;
    title: string;
    type: string;
    answered: number;
    counts: Array<{ name: string; value: number }>;
    texts: string[];
  }>;
}
export interface FilePreview {
  format: string;
  sheets: Array<{ name: string; rows: string[][] }>;
  text: string;
  warnings: string[];
}
export interface RosterRow {
  studentNumber: string;
  displayName: string;
}
export interface RosterPlan {
  id: string;
  classId: string;
  fingerprint: string;
  rows: RosterRow[];
  errors: string[];
  expiresAt: number;
}
