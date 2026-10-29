// Learning platform contracts; additive to existing assignment APIs.
import type { ID, ISODateTime } from "./contracts.js";
export interface ProfileQuestion {
  id: string;
  number: number;
  section: string;
  prompt: string;
  sourceLines: string[];
  type: "text" | "matrix_scale" | "multiple_choice" | null;
  required: null;
  scaleAnchors: null;
  rows?: { id: string; label: string }[];
  choices?: { id: string; label: string }[];
}
export type ProfileAnswers = Record<
  string,
  string | string[] | Record<string, number>
>;
export interface ProfileInput {
  schemaVersion: string;
  answers: ProfileAnswers;
  other: Record<string, string>;
  expectedVersion: number;
}
export interface ProfileDraft {
  id: ID;
  classId: ID;
  studentId: ID;
  schemaVersion: string;
  answers: ProfileAnswers;
  other: Record<string, string>;
  version: number;
  updatedAt: ISODateTime;
}
export interface ProfileOverview {
  id: ID;
  studentId: ID;
  studentName: string;
  studentNumber: string | null;
  version: number;
  updatedAt: ISODateTime;
  filledCount: number;
}
export interface CourseMaterial {
  id: ID;
  classId: ID;
  title: string;
  content: string;
  state: "draft" | "published";
  version: number;
  updatedAt: ISODateTime;
}
export interface MaterialInput {
  title: string;
  content: string;
  expectedVersion: number;
}
