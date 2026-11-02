import { createHmac } from "node:crypto";
import type {
  GateDependencies,
  Policy,
  Deployment,
  Principal,
  Purpose,
  Emit,
  Usage,
  HistoryMessage,
} from "./contracts.js";
import type { BillingStore } from "./ledger.js";
import { Scheduler, type AdmissionScheduler, type Lease } from "./scheduler.js";
import { ModuleError, requireValue } from "./errors.js";
import type { BalanceMonitor } from "./balance.js";
import { messages } from "./deepseek.js";
export class Gateway {
  readonly scheduler: AdmissionScheduler;
  constructor(
    readonly deps: GateDependencies,
    readonly store: BillingStore,
    readonly policy: Policy,
    readonly deployments: Deployment[],
    private readonly fingerprintKey: string,
    private readonly balances?: BalanceMonitor,
    scheduler?: AdmissionScheduler,
  ) {
    this.scheduler = scheduler ?? new Scheduler(deployments, policy);
    requireValue(fingerprintKey.length >= 32, 500, "FINGERPRINT_KEY_REQUIRED");
  }
  async prepare(
    user: Principal,
    input: { courseId: string; question: string; clientRequestId: string; history?:HistoryMessage[]; purpose?:Purpose },
  ) {
    requireValue(user.role === "student" || (user.role === "teacher" && this.deps.allowTeacherQuestions === true), 403, "QUESTION_ROLE_REQUIRED");
    requireValue(!input.purpose || input.purpose === "teacher_analytics" && user.role === "teacher",403,"INVALID_PURPOSE");
    await this.deps.authorization.authorize(user, input.courseId, "ask");
    requireValue(this.policy.enabled, 503, "AI_DISABLED");
    requireValue(
      Buffer.byteLength(input.question) <= this.policy.maxInputBytes,
      400,
      "QUESTION_TOO_LONG",
    );
    const hash = (v: string) =>
      createHmac("sha256", this.fingerprintKey).update(v).digest("hex");
    const id = hash(
      JSON.stringify([user.subjectId, input.courseId, input.clientRequestId]),
    );
    await this.store.reserve(
      {
        id,
        fingerprint: hash(JSON.stringify(input)),
        subjectId: user.subjectId,
        purpose: input.purpose ?? (user.role === "teacher" ? "teacher_qa" : "student_qa"),
        courseId: input.courseId,
      },
      this.policy,
    );
    return id;
  }
  async answer(
    user: Principal,
    input: { courseId: string; question: string; history?:HistoryMessage[]; purpose?:Purpose },
    id: string,
    signal: AbortSignal,
    emit: Emit,
  ) {
    let lease: Lease | undefined;
    let called = false,
      usage: Usage | undefined,
      finished = false;
    let inputBytes = 0;
    try {
      await emit("accepted", { requestId: id });
      const grants = await this.deps.authorization.authorize(
        user,
        input.courseId,
        "ask",
      );
      requireValue(!input.purpose || input.purpose === "teacher_analytics" && user.role === "teacher",403,"INVALID_PURPOSE");
      const found = input.purpose === "teacher_analytics" ? {status:"general_knowledge" as const,evidence:[],scoreType:"anonymous_survey_summary"} : await this.deps.knowledge.retrieve({
        ...input,
        scopeIds: grants.scopeIds,
        signal,
      });
      if (found.status !== "supported" && found.status !== "general_knowledge") {
        const status =
          found.status === "out_of_scope" ? "refusal" : "insufficient_evidence";
        await this.store.noCall(id, status);
        await emit(status, {
          requestId: id,
          message:
            status === "refusal"
              ? "此问题不在本课程范围内。"
              : "课程资料暂不足以支持回答。",
        });
        return;
      }
      requireValue(
        (found.status === "general_knowledge" ? found.evidence.length === 0 : found.evidence.length > 0) &&
          found.evidence.every(
            (e) => e.approved && grants.scopeIds.includes(e.scopeId),
          ),
        403,
        "RETRIEVAL_SCOPE_VIOLATION",
      );
      const upstream = {
        task: input.purpose === "teacher_analytics" ? "survey_analysis" as const : undefined,
        answerBasis: found.status === "general_knowledge" ? "general_knowledge" as const : "course_evidence" as const,
        question: input.question,
        history: input.history ? [...input.history] : undefined,
        evidence: found.evidence,
        userId: createHmac("sha256", this.fingerprintKey)
          .update(user.subjectId)
          .digest("hex"),
        maxOutputTokens: this.policy.maxOutputTokens,
        signal,
      };
      inputBytes = Buffer.byteLength(JSON.stringify(messages(upstream)));
      while(inputBytes>this.policy.maxInputBytes && upstream.history?.length){upstream.history.splice(0,2);inputBytes=Buffer.byteLength(JSON.stringify(messages(upstream)));}
      requireValue(
        inputBytes <= this.policy.maxInputBytes,
        400,
        "CONTEXT_TOO_LONG",
      );
      await emit("queued", { requestId: id });
      const purpose=input.purpose ?? (user.role==="teacher"&&this.deployments.some(d=>d.purposes.includes("teacher_qa"))?"teacher_qa":"student_qa");
      lease = await this.scheduler.take(user.subjectId, signal, purpose);
      signal.throwIfAborted();
      await this.deps.authorization.authorize(user, input.courseId, "ask");
      if (this.balances) await this.balances.admit(lease.deployment, signal);
      await this.store.update(id, {
        state: "calling",
        deploymentId: lease.deployment.id,
        accountId: lease.deployment.accountId,
        model: lease.deployment.provider.model,
      });
      called = true;
      await emit("sources", {
        requestId: id,
        sources: found.evidence.map(({ id, title, url, version }) => ({
          id,
          title,
          url,
          version,
        })),
        scoreType: found.scoreType,
      });
      if (found.status === "general_knowledge" && !input.purpose) await emit("delta", {text:"【一般知识解释，未依据已上传课程资料】\n\n"});
      for await (const event of lease.deployment.provider.stream(upstream)) {
        if (event.type === "model")
          await this.store.update(id, { model: event.model });
        else if (event.type === "delta") {
          requireValue(!finished, 502, "CONTENT_AFTER_FINISH");
          await emit("delta", { text: event.text });
        } else if (event.type === "usage") {
          const u = event.usage;
          requireValue(!usage, 502, "DUPLICATE_USAGE");
          requireValue(
            Object.values(u).every((n) => Number.isSafeInteger(n) && n >= 0) &&
              u.cacheHitTokens <= u.inputTokens,
            502,
            "INVALID_USAGE",
          );
          usage = u;
        } else {
          requireValue(!finished, 502, "DUPLICATE_FINISH");
          finished = true;
        }
      }
      requireValue(finished && usage, 502, "UPSTREAM_INCOMPLETE");
      await this.store.finish(id, usage, this.policy);
      for (const topic of user.role==="student"?new Set(found.evidence.map((e) => e.topicId)):[])
        await this.store.topic(input.courseId, topic);
      await emit("done", { requestId: id, usage, usageState: "settled" });
    } catch (error) {
      const code = signal.aborted
        ? "CANCELLED"
        : error instanceof ModuleError
          ? error.code
          : "REQUEST_FAILED";
      const current = await this.store.get(id);
      if (current?.state !== "completed") {
        if (called) {
          await this.store.update(id, {
            state: "usage_unknown",
            errorCode: code,
          });
          if (lease) await this.scheduler.fail(lease.deployment.quotaGroup);
        } else await this.store.noCall(id, code);
      }
      try {
        await emit("error", {
          requestId: id,
          code,
          usageState:
            current?.state === "completed"
              ? "settled"
              : called
                ? "unknown"
                : "not_called",
          retryable: false,
        });
      } catch {
        /* Closed socket: never log content. */
      }
    } finally {
      await lease?.release();
    }
  }
}
