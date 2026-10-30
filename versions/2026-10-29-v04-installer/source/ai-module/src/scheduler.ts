import type { Deployment, Policy } from "./contracts.js";
import { ModuleError, requireValue } from "./errors.js";
interface Waiting {
  subjectId: string;
  resolve: (lease: Lease) => void;
  reject: (e: unknown) => void;
  cleanup: () => void;
  signal: AbortSignal;
}
export interface Lease {
  deployment: Deployment;
  release: () => void | Promise<void>;
}
export interface AdmissionScheduler {
  take(subjectId: string, signal: AbortSignal): Promise<Lease>;
  fail(group: string): void | Promise<void>;
  status():
    | ReturnType<Scheduler["status"]>
    | Promise<ReturnType<Scheduler["status"]>>;
}
/** Single-process RAM queue. Metadata only is durable; request text never enters a broker. */
export class Scheduler {
  private readonly users = new Set<string>();
  private readonly active = new Map<string, number>();
  private readonly cooldown = new Map<string, number>();
  private readonly queue: Waiting[] = [];
  private turn = 0;
  constructor(
    readonly deployments: Deployment[],
    readonly policy: Policy,
  ) {
    requireValue(
      new Set(deployments.map((d) => d.id)).size === deployments.length,
      500,
      "DUPLICATE_DEPLOYMENT",
    );
  }
  get queued() {
    return this.queue.length;
  }
  private capacity(group: string) {
    return Math.min(
      ...this.deployments
        .filter((d) => d.quotaGroup === group)
        .map((d) => d.maxConcurrency),
    );
  }
  private drain() {
    for (let i = 0; i < this.queue.length; ) {
      const w = this.queue[i];
      const candidates = this.deployments.filter(
        (d) =>
          d.purposes.includes("student_qa") &&
          (this.active.get(d.quotaGroup) ?? 0) < this.capacity(d.quotaGroup) &&
          (this.cooldown.get(d.quotaGroup) ?? 0) <= Date.now(),
      );
      if (!candidates.length) break;
      const d = candidates[this.turn++ % candidates.length];
      this.queue.splice(i, 1);
      w.cleanup();
      this.active.set(d.quotaGroup, (this.active.get(d.quotaGroup) ?? 0) + 1);
      let released = false;
      w.resolve({
        deployment: d,
        release: () => {
          if (released) return;
          released = true;
          this.users.delete(w.subjectId);
          this.active.set(
            d.quotaGroup,
            (this.active.get(d.quotaGroup) ?? 1) - 1,
          );
          this.drain();
        },
      });
    }
  }
  take(subjectId: string, signal: AbortSignal): Promise<Lease> {
    requireValue(!signal.aborted, 499, "CANCELLED");
    requireValue(!this.users.has(subjectId), 429, "USER_CONCURRENCY_LIMIT");
    requireValue(this.queue.length < this.policy.maxQueue, 429, "QUEUE_FULL");
    this.users.add(subjectId);
    return new Promise((resolve, reject) => {
      let timer: ReturnType<typeof setTimeout>;
      const w: Waiting = {
        subjectId,
        signal,
        resolve,
        reject,
        cleanup: () => {
          clearTimeout(timer);
          signal.removeEventListener("abort", cancel);
        },
      };
      const remove = (code: string) => {
        const index = this.queue.indexOf(w);
        if (index < 0) return;
        this.queue.splice(index, 1);
        w.cleanup();
        this.users.delete(subjectId);
        reject(new ModuleError(429, code));
      };
      const cancel = () => remove("CANCELLED");
      timer = setTimeout(
        () => remove("QUEUE_TIMEOUT"),
        this.policy.queueTimeoutMs,
      );
      signal.addEventListener("abort", cancel, { once: true });
      this.queue.push(w);
      this.drain();
    });
  }
  fail(group: string) {
    this.cooldown.set(group, Date.now() + 10000);
    const timer = setTimeout(() => this.drain(), 10010);
    timer.unref();
  }
  status() {
    return {
      queued: this.queue.length,
      accounts: this.deployments.map((d) => ({
        deploymentId: d.id,
        accountId: d.accountId,
        quotaGroup: d.quotaGroup,
        purposes: d.purposes,
        active: this.active.get(d.quotaGroup) ?? 0,
        capacity: this.capacity(d.quotaGroup),
        cooling: (this.cooldown.get(d.quotaGroup) ?? 0) > Date.now(),
      })),
    };
  }
}
