import { z } from 'zod';

export const id = z.string().min(1).max(128);
export const version = z.number().int().min(0);
export const versionBody = z.object({ expectedVersion: version }).strict();
export const assignmentBody = z.object({
  classId: id,
  title: z.string().trim().min(1).max(200),
  instructions: z.string().max(10000),
  questions: z.array(z.object({ id, prompt: z.string().trim().min(1).max(10000), maxLength: z.number().int().min(1).max(20000) }).strict()).min(1).max(20)
    .refine(q => new Set(q.map(v => v.id)).size === q.length, '题目ID重复'),
  deadlineAt: z.iso.datetime({ offset: false }).nullable(),
  rubricId: id.nullable(),
  expectedVersion: version,
}).strict();
export const answersBody = z.object({
  answers: z.array(z.object({ questionId: id, text: z.string().max(20000) }).strict()).max(20),
  expectedVersion: version,
}).strict();
export const reviewBody = z.object({
  expectedReportVersion: version,
  dimensions: z.array(z.object({ dimensionId: id, score: z.number().finite().nonnegative(), rationale: z.string().max(4000) }).strict()).min(1).max(20),
  feedback: z.string().max(10000),
  reason: z.string().trim().min(1).max(4000),
}).strict();
