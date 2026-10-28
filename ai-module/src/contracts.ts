export type Purpose = "student_qa" | "teacher_analytics" | "system_admin";
export interface Principal {
  subjectId: string;
  role: "student" | "teacher" | "admin";
}
export interface IdentityResolver {
  verify(token: string): Promise<Principal>;
}
export interface CourseAuthorizer {
  authorize(
    user: Principal,
    courseId: string,
    action: "ask" | "topics",
  ): Promise<{ scopeIds: string[] }>;
}
export interface Source {
  id: string;
  scopeId: string;
  topicId: string;
  title: string;
  content: string;
  url?: string;
  version: string;
  approved: boolean;
  keywords: string[];
}
export interface Evidence extends Source {
  score: number;
}
export interface Retrieval {
  status: "supported" | "out_of_scope" | "insufficient";
  evidence: Evidence[];
  scoreType: string;
}
export interface KnowledgeProvider {
  retrieve(input: {
    courseId: string;
    scopeIds: string[];
    question: string;
    signal: AbortSignal;
  }): Promise<Retrieval>;
}
export interface Usage {
  inputTokens: number;
  outputTokens: number;
  cacheHitTokens: number;
}
export type ProviderEvent =
  | { type: "model"; model: string }
  | { type: "delta"; text: string }
  | { type: "usage"; usage: Usage }
  | { type: "finish"; reason: "stop" | "length" };
export interface UpstreamInput {
  question: string;
  evidence: Evidence[];
  userId: string;
  maxOutputTokens: number;
  signal: AbortSignal;
}
export interface ModelProvider {
  model: string;
  stream(input: UpstreamInput): AsyncIterable<ProviderEvent>;
  balance?(
    signal: AbortSignal,
  ): Promise<{ currency: string; balance: string; available: boolean }>;
}
export interface Deployment {
  id: string;
  accountId: string;
  quotaGroup: string;
  purposes: Purpose[];
  maxConcurrency: number;
  provider: ModelProvider;
}
export interface Rates {
  inputPerMillion: number;
  cacheHitPerMillion: number;
  outputPerMillion: number;
  currency: string;
  version: string;
}
export interface Policy {
  enabled: boolean;
  dailyRequests: number;
  dailyUserBudgetMicros: number;
  monthlyBudgetMicros: number;
  maxInputBytes: number;
  maxOutputTokens: number;
  reserveMicros: number;
  maxQueue: number;
  queueTimeoutMs: number;
  requestTimeoutMs: number;
  topicsMinCount: number;
  rates: Rates;
}
export interface GateDependencies {
  identity: IdentityResolver;
  authorization: CourseAuthorizer;
  knowledge: KnowledgeProvider;
}
export type Emit = (event: string, data: unknown) => Promise<void>;
