import { createHmac } from "node:crypto";
import type {
  GateDependencies,
  Policy,
  Deployment,
  Principal,
  Emit,
  Usage,
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
    input: { courseId: string; question: string; clientRequestId: string },
  ) {
    requireValue(user.role === "student", 403, "STUDENT_REQUIRED");
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
        courseId: input.courseId,
      },
      this.policy,
    );
    return id;
  }
  async answer(
    user: Principal,
    input: { courseId: string; question: string },
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
      const found = await this.deps.knowledge.retrieve({
        ...input,
        scopeIds: grants.scopeIds,
        signal,
      });
      if (found.status !== "supported") {
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
        found.evidence.length > 0 &&
          found.evidence.every(
            (e) => e.approved && grants.scopeIds.includes(e.scopeId),
          ),
        403,
        "RETRIEVAL_SCOPE_VIOLATION",
      );
      const upstream = {
        question: input.question,
        evidence: found.evidence,
        userId: createHmac("sha256", this.fingerprintKey)
          .update(user.subjectId)
          .digest("hex"),
        maxOutputTokens: this.policy.maxOutputTokens,
        signal,
      };
      inputBytes = Buffer.byteLength(JSON.stringify(messages(upstream)));
      requireValue(
        inputBytes <= this.policy.maxInputBytes,
        400,
        "CONTEXT_TOO_LONG",
      );
      await emit("queued", { requestId: id });
      lease = await this.scheduler.take(user.subjectId, signal);
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
      for (const topic of new Set(found.evidence.map((e) => e.topicId)))
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
