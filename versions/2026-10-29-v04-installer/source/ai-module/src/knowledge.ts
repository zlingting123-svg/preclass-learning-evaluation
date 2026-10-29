import type { KnowledgeProvider, Source, Retrieval } from "./contracts.js";
/** Explicit baseline, NOT a calibrated semantic similarity model. No query embeddings or histories saved. */
export class KeywordKnowledge implements KnowledgeProvider {
  constructor(
    readonly sources: Source[],
    readonly courses: Record<string, { keywords: string[]; threshold: number }>,
  ) {}
  async retrieve(input: {
    courseId: string;
    scopeIds: string[];
    question: string;
    signal: AbortSignal;
  }): Promise<Retrieval> {
    input.signal.throwIfAborted();
    const rule = this.courses[input.courseId];
    if (
      !rule ||
      !rule.keywords.some((k) =>
        input.question.toLowerCase().includes(k.toLowerCase()),
      )
    )
      return {
        status: "out_of_scope",
        evidence: [],
        scoreType: "keyword_coverage",
      };
    const evidence = this.sources
      .filter((s) => s.approved && input.scopeIds.includes(s.scopeId))
      .map((s) => ({
        ...s,
        score: s.keywords.length
          ? s.keywords.filter((k) =>
              input.question.toLowerCase().includes(k.toLowerCase()),
            ).length / s.keywords.length
          : 0,
      }))
      .filter((s) => s.score >= rule.threshold)
      .sort((a, b) => b.score - a.score)
      .slice(0, 4);
    return {
      status: evidence.length ? "supported" : "insufficient",
      evidence,
      scoreType: "keyword_coverage",
    };
  }
}
