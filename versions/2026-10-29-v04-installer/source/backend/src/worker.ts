import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { Assignment, RubricInfo, ScoreReport, ScoreValue, Submission } from '../../shared/contracts.js';
import { Service, type Job } from './service.js';

export interface ScoreResult {
  scores: ScoreValue;
  method: 'rule' | 'ai';
  modelProvider: string | null;
  modelVersion: string | null;
  needsReview: boolean;
}
export interface Scorer {
  score(input: { submission: Submission; assignment: Assignment; rubric: RubricInfo }, signal: AbortSignal): Promise<ScoreResult>;
}
export const unconfiguredScorer: Scorer = {
  async score() { throw new Error('SCORER_UNCONFIGURED'); },
};
const valueSchema = z.object({
  scores: z.object({
    dimensions: z.array(z.object({ dimensionId: z.string(), name: z.string().max(200), score: z.number().finite().nonnegative(),
      maxScore: z.number().finite().positive(), rationale: z.string().max(4000) }).strict()).min(1).max(20),
    // Aggregation is not implemented without approved teaching rules.
    totalScore: z.null(), totalMaxScore: z.null(), feedback: z.string().max(10000),
  }).strict(),
  method: z.enum(['rule', 'ai']), modelProvider: z.string().max(200).nullable(), modelVersion: z.string().max(200).nullable(), needsReview: z.boolean(),
}).strict();

/** Persistent lease, bounded attempts, fencing token; one claim per tick. */
export class Worker {
  constructor(private service: Service, private scorer: Scorer = unconfiguredScorer) {}
  private claim(): Job | undefined {
    const { store, now } = this.service;
    return store.transaction(() => {
      for (const job of store.all<Job>('job')) {
        if (!(job.state === 'queued' && job.nextAt <= now()) && !(job.state === 'processing' && job.leaseUntil <= now())) continue;
        const sub = store.get<Submission>('submission', job.submissionId);
        if (!sub) { job.state = 'failed'; store.put('job', job.id, job); continue; }
        if (job.attempts >= 3) {
          job.state = 'failed'; job.leaseToken = null;
          sub.scoringStatus = 'failed'; sub.failureMessage = '评分重试达到上限，请教师检查后重试';
          sub.version++; sub.updatedAt = this.service.iso();
          store.put('job', job.id, job); store.put('submission', sub.id, sub); continue;
        }
        job.state = 'processing'; job.attempts++; job.leaseToken = randomUUID(); job.leaseUntil = now() + 30000;
        sub.scoringStatus = 'processing'; sub.version++; sub.updatedAt = this.service.iso();
        store.put('job', job.id, job); store.put('submission', sub.id, sub); return job;
      }
      return undefined;
    });
  }
  async tick(): Promise<boolean> {
    const job = this.claim();
    if (!job) return false;
    const { store, now } = this.service;
    const controller = new AbortController();
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      const submission = store.get<Submission>('submission', job.submissionId)!;
      const assignment = store.get<Assignment>('assignment', submission.assignmentId)!;
      const rubric = this.service.rubric(job.rubricId);
      if (rubric.version !== job.rubricVersion) throw new Error('RUBRIC_VERSION_MISMATCH');
      const response = await Promise.race([
        this.scorer.score({ submission, assignment, rubric }, controller.signal),
        new Promise<never>((_, reject) => { timeout = setTimeout(() => { controller.abort(); reject(new Error('SCORING_TIMEOUT')); }, 10000); }),
      ]);
      const result = valueSchema.parse(response);
      const dimensions = result.scores.dimensions;
      if (dimensions.length !== rubric.dimensions.length || new Set(dimensions.map(d => d.dimensionId)).size !== dimensions.length) throw new Error('INVALID_DIMENSIONS');
      result.scores.dimensions = rubric.dimensions.map(d => {
        const value = dimensions.find(s => s.dimensionId === d.id);
        if (!value || value.score > d.maxScore || value.maxScore !== d.maxScore) throw new Error('INVALID_SCORE');
        return { ...value, name: d.name };
      });
      if (result.method === 'ai' && (!result.modelProvider || !result.modelVersion)) throw new Error('MODEL_METADATA_REQUIRED');
      store.transaction(() => {
        const current = store.get<Job>('job', job.id);
        if (current?.leaseToken !== job.leaseToken || current.state !== 'processing' || current.leaseUntil <= now()) return;
        const sub = store.get<Submission>('submission', job.submissionId)!;
        const report: ScoreReport = { id: randomUUID(), submissionId: sub.id, rubricId: rubric.id,
          rubricVersion: rubric.version, method: result.method, modelProvider: result.modelProvider,
          modelVersion: result.modelVersion, generatedAt: this.service.iso(), systemScores: result.scores,
          reviews: [], latestReview: null, version: 1 };
        sub.scoringStatus = result.needsReview ? 'needs_review' : 'scored'; sub.failureMessage = null; sub.version++; sub.updatedAt = this.service.iso();
        current.state = 'completed'; current.leaseToken = null;
        store.put('report', sub.id, report); store.put('submission', sub.id, sub); store.put('job', current.id, current);
      });
    } catch {
      store.transaction(() => {
        const current = store.get<Job>('job', job.id);
        if (current?.leaseToken !== job.leaseToken || current.state !== 'processing' || current.leaseUntil <= now()) return;
        const terminal = current.attempts >= 3;
        current.state = terminal ? 'failed' : 'queued'; current.nextAt = now() + 1000 * 2 ** current.attempts; current.leaseToken = null;
        const sub = store.get<Submission>('submission', job.submissionId)!;
        sub.scoringStatus = terminal ? 'failed' : 'queued'; sub.version++; sub.updatedAt = this.service.iso();
        sub.failureMessage = terminal ? '评分失败，请教师检查评价配置后重试' : '评分暂时失败，等待重试';
        store.put('job', current.id, current); store.put('submission', sub.id, sub);
      });
    } finally { clearTimeout(timeout); }
    return true;
  }
}
