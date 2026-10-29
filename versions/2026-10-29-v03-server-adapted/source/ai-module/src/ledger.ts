import { DatabaseSync } from "node:sqlite";
import {
  mkdirSync,
  openSync,
  writeFileSync,
  readFileSync,
  unlinkSync,
  closeSync,
} from "node:fs";
import { dirname } from "node:path";
import type { Policy, Usage } from "./contracts.js";
import { requireValue } from "./errors.js";
export interface Entry {
  id: string;
  fingerprint: string;
  subjectId: string;
  courseId: string;
  createdAt: string;
  state: string;
  reservedMicros: number;
  costMicros: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
  cacheHitTokens: number | null;
  deploymentId: string | null;
  accountId: string | null;
  model: string | null;
  purpose: "student_qa";
  currency: string;
  pricingVersion: string;
  errorCode: string | null;
}
export type Awaitable<T> = T | Promise<T>;
/** Host may replace SQLite with an async PostgreSQL adapter. reserve MUST be atomic across instances. */
export interface BillingStore {
  rows(): Awaitable<Entry[]>;
  get(id: string): Awaitable<Entry | undefined>;
  reserve(
    input: {
      id: string;
      fingerprint: string;
      subjectId: string;
      courseId: string;
    },
    policy: Policy,
  ): Awaitable<void>;
  update(id: string, patch: Partial<Entry>): Awaitable<void>;
  finish(id: string, usage: Usage, policy: Policy): Awaitable<void>;
  noCall(id: string, state: string): Awaitable<void>;
  topic(course: string, topic: string): Awaitable<void>;
  topics(course: string, min: number): Awaitable<unknown[]>;
  summary(subjectId?: string): Awaitable<unknown>;
}
export class Ledger {
  readonly db: DatabaseSync;
  private lockPath?: string;
  constructor(path: string) {
    if (path !== ":memory:")
      mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
    if (path !== ":memory:") {
      const lock = path + ".owner";
      try {
        const fd = openSync(lock, "wx", 0o600);
        writeFileSync(fd, JSON.stringify({ pid: process.pid }));
        closeSync(fd);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
        let pid: number;
        try {
          pid = JSON.parse(readFileSync(lock, "utf8")).pid;
          requireValue(
            Number.isInteger(pid) && pid > 0,
            503,
            "INVALID_STORE_LOCK",
          );
        } catch {
          throw new Error("INVALID_STORE_LOCK");
        }
        let alive = true;
        try {
          process.kill(pid, 0);
        } catch (e) {
          if ((e as NodeJS.ErrnoException).code === "ESRCH") alive = false;
        }
        requireValue(!alive, 503, "STORE_ALREADY_OWNED");
        unlinkSync(lock);
        const fd = openSync(lock, "wx", 0o600);
        writeFileSync(fd, JSON.stringify({ pid: process.pid }));
        closeSync(fd);
      }
      this.lockPath = lock;
    }
    this.db = new DatabaseSync(path);
    this.db
      .exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;
 CREATE TABLE IF NOT EXISTS usage_ledger(id TEXT PRIMARY KEY,payload TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS topic_buckets(course TEXT,bucket TEXT,topic TEXT,count INTEGER NOT NULL,PRIMARY KEY(course,bucket,topic));`);
    // One process owns this SQLite file. A crash cannot safely refund requests already sent upstream.
    for (const row of this.rows())
      if (row.state === "calling")
        this.update(row.id, {
          state: "usage_unknown",
          errorCode: "PROCESS_RESTART",
        });
      else if (row.state === "reserved")
        this.update(row.id, {
          state: "failed_not_called",
          reservedMicros: 0,
          errorCode: "PROCESS_RESTART",
        });
  }
  rows(): Entry[] {
    return this.db
      .prepare("SELECT payload FROM usage_ledger")
      .all()
      .map((r) => JSON.parse(String(r.payload)) as Entry);
  }
  get(id: string): Entry | undefined {
    const r = this.db
      .prepare("SELECT payload FROM usage_ledger WHERE id=?")
      .get(id);
    return r ? JSON.parse(String(r.payload)) : undefined;
  }
  private write(row: Entry) {
    this.db
      .prepare(
        "INSERT INTO usage_ledger VALUES(?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload",
      )
      .run(row.id, JSON.stringify(row));
  }
  update(id: string, patch: Partial<Entry>) {
    const r = this.get(id);
    requireValue(r, 500, "LEDGER_MISSING");
    this.write({ ...r, ...patch });
  }
  reserve(
    input: {
      id: string;
      fingerprint: string;
      subjectId: string;
      courseId: string;
    },
    p: Policy,
  ) {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const old = this.get(input.id);
      requireValue(
        !old,
        409,
        old?.fingerprint === input.fingerprint
          ? "REQUEST_ALREADY_HANDLED"
          : "IDEMPOTENCY_CONFLICT",
      );
      requireValue(
        !this.rows().some(
          (r) =>
            r.errorCode === "RESERVATION_EXCEEDED" &&
            r.pricingVersion === p.rates.version,
        ),
        503,
        "BUDGET_ESTIMATE_UNSAFE",
      );
      const now = new Date().toISOString(),
        day = now.slice(0, 10),
        month = now.slice(0, 7);
      const rows = this.rows();
      const spent = (r: Entry) => r.costMicros ?? r.reservedMicros;
      const mine = rows.filter(
        (r) => r.subjectId === input.subjectId && r.createdAt.startsWith(day),
      );
      requireValue(p.dailyRequests === 0 || mine.length < p.dailyRequests, 429, "DAILY_REQUEST_LIMIT");
      requireValue(
        p.dailyUserBudgetMicros === 0 || mine.reduce((n, r) => n + spent(r), 0) + p.reserveMicros <=
          p.dailyUserBudgetMicros,
        429,
        "USER_BUDGET_LIMIT",
      );
      requireValue(
        p.monthlyBudgetMicros === 0 || rows
          .filter((r) => r.createdAt.startsWith(month))
          .reduce((n, r) => n + spent(r), 0) +
          p.reserveMicros <=
          p.monthlyBudgetMicros,
        429,
        "SYSTEM_BUDGET_LIMIT",
      );
      this.write({
        ...input,
        createdAt: now,
        state: "reserved",
        reservedMicros: p.reserveMicros,
        costMicros: null,
        inputTokens: null,
        outputTokens: null,
        cacheHitTokens: null,
        deploymentId: null,
        accountId: null,
        model: null,
        purpose: "student_qa",
        currency: p.rates.currency,
        pricingVersion: p.rates.version,
        errorCode: null,
      });
      this.db.exec("COMMIT");
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
  }
  finish(id: string, usage: Usage, p: Policy) {
    const cost = Math.ceil(
      ((usage.inputTokens - usage.cacheHitTokens) * p.rates.inputPerMillion +
        usage.cacheHitTokens * p.rates.cacheHitPerMillion +
        usage.outputTokens * p.rates.outputPerMillion) /
        1e6,
    );
    this.update(id, {
      state: "completed",
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      cacheHitTokens: usage.cacheHitTokens,
      costMicros: cost,
      reservedMicros: 0,
      errorCode: cost > p.reserveMicros ? "RESERVATION_EXCEEDED" : null,
    });
  }
  noCall(id: string, state: string) {
    this.update(id, { state, reservedMicros: 0, costMicros: 0 });
  }
  topic(course: string, topic: string) {
    this.db
      .prepare(
        "INSERT INTO topic_buckets VALUES(?,?,?,1) ON CONFLICT(course,bucket,topic) DO UPDATE SET count=count+1",
      )
      .run(course, new Date().toISOString().slice(0, 7), topic);
  }
  topics(course: string, min: number) {
    return this.db
      .prepare(
        "SELECT bucket,topic,count FROM topic_buckets WHERE course=? AND count>=?",
      )
      .all(course, min);
  }
  summary(subjectId?: string) {
    const r = this.rows().filter(
      (r) => !subjectId || r.subjectId === subjectId,
    );
    return {
      requests: r.length,
      modelCalls: r.filter((x) => x.deploymentId).length,
      completed: r.filter((x) => x.state === "completed").length,
      usageUnknown: r.filter((x) => x.state === "usage_unknown").length,
      inputTokens: r.reduce((n, x) => n + (x.inputTokens ?? 0), 0),
      outputTokens: r.reduce((n, x) => n + (x.outputTokens ?? 0), 0),
      costMicros: r.reduce((n, x) => n + (x.costMicros ?? 0), 0),
      heldMicros: r.reduce((n, x) => n + x.reservedMicros, 0),
    };
  }
  close() {
    this.db.close();
    if (this.lockPath) {
      unlinkSync(this.lockPath);
      this.lockPath = undefined;
    }
  }
}
