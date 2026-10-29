import { Agent, buildConnector, fetch as pooledFetch } from "undici";
import { once } from "node:events";
import { randomBytes } from "node:crypto";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import { SignJWT } from "jose";
import { Ledger } from "../src/ledger.js";
import { Gateway } from "../src/gateway.js";
import { StaticAuthorization, jwtIdentity } from "../src/auth.js";
import { KeywordKnowledge } from "../src/knowledge.js";
import { MockProvider } from "../src/mock.js";
import { createModuleApp } from "../src/app.js";
import type { Policy, Deployment } from "../src/contracts.js";
export async function createFixture(
  options: {
    mode?: "ok" | "broken";
    students?: number;
    concurrency?: number;
    delayMs?: number;
    connections?: number;
    policy?: Partial<Policy>;
    deployments?: (p: MockProvider) => Deployment[];
  } = {},
) {
  const key = randomBytes(32),
    directory = mkdtempSync(join(tmpdir(), "course-ai-test-"));
  const path = join(directory, "metadata.sqlite");
  const store = new Ledger(path);
  const grants: Record<
    string,
    Record<string, { actions: ("ask" | "topics")[]; scopeIds: string[] }>
  > = {
    student: { course: { actions: ["ask"], scopeIds: ["scope-a"] } },
    teacher: { course: { actions: ["topics"], scopeIds: ["scope-a"] } },
  };
  const principals = [
    "student",
    "teacher",
    "outsider",
    "admin",
    ...Array.from({ length: options.students ?? 0 }, (_, i) => "s" + i),
  ];
  for (const s of principals.filter((s) => s.startsWith("s")))
    grants[s] = { course: { actions: ["ask"], scopeIds: ["scope-a"] } };
  const tokens: Record<string, string> = {};
  for (const s of principals)
    tokens[s] = await new SignJWT({
      role: s === "teacher" ? "teacher" : s === "admin" ? "admin" : "student",
    })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(s)
      .setIssuer("test-host")
      .setAudience("course-ai")
      .setIssuedAt()
      .setJti(randomBytes(8).toString("hex"))
      .setExpirationTime("10m")
      .sign(key);
  tokens.expired = await new SignJWT({ role: "student" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject("student")
    .setIssuer("test-host")
    .setAudience("course-ai")
    .setIssuedAt(Math.floor(Date.now() / 1000) - 100)
    .setJti("expired-test")
    .setExpirationTime(Math.floor(Date.now() / 1000) - 1)
    .sign(key);
  const provider = new MockProvider(options.mode, options.delayMs ?? 1);
  const policy: Policy = {
    enabled: true,
    dailyRequests: 100,
    dailyUserBudgetMicros: 1000000,
    monthlyBudgetMicros: 100000000,
    maxInputBytes: 12000,
    maxOutputTokens: 200,
    reserveMicros: 2000,
    maxQueue: 300,
    queueTimeoutMs: 20000,
    requestTimeoutMs: 30000,
    topicsMinCount: 2,
    rates: {
      inputPerMillion: 10000,
      cacheHitPerMillion: 1000,
      outputPerMillion: 20000,
      currency: "CNY",
      version: "synthetic-only",
    },
    ...options.policy,
  };
  const deployments = options.deployments?.(provider) ?? [
    {
      id: "fake-a",
      accountId: "account-a",
      quotaGroup: "account-a",
      purposes: ["student_qa"],
      maxConcurrency: options.concurrency ?? 4,
      provider,
    },
  ];
  const gateway = new Gateway(
    {
      identity: jwtIdentity({
        key,
        issuer: "test-host",
        audience: "course-ai",
        algorithm: "HS256",
      }),
      authorization: new StaticAuthorization(grants),
      knowledge: new KeywordKnowledge(
        [
          {
            id: "doc-a",
            scopeId: "scope-a",
            topicId: "topic-eia",
            title: "模拟课程资料",
            content: "环境评价用于分析项目影响，明确说明依据。",
            approved: true,
            version: "test-1",
            keywords: ["环境评价", "作用"],
          },
        ],
        { course: { keywords: ["环境评价"], threshold: 1 } },
      ),
    },
    store,
    policy,
    deployments,
    randomBytes(32).toString("hex"),
  );
  const connector = buildConnector({});
  let connecting = 0;
  const connects: (() => void)[] = [];
  const drainConnects = () => {
    while (connecting < 1 && connects.length) {
      connecting++;
      connects.shift()!();
    }
  };
  const dispatcher = new Agent({
    connections: options.connections ?? 64,
    connect: (opts, callback) => {
      connects.push(() =>
        connector(opts, (error, socket) => {
          connecting--;
          if (error || !socket)
            callback(error ?? new Error("connect failed"), null);
          else callback(null, socket);
          setTimeout(drainConnects, 10);
        }),
      );
      drainConnects();
    },
  });
  const server = createModuleApp(gateway).listen({
    port: 0,
    host: "127.0.0.1",
    backlog: 2048,
  });
  await once(server, "listening");
  server.keepAliveTimeout = 30000;
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/ai/v1`;
  return {
    provider,
    store,
    gateway,
    tokens,
    path,
    directory,
    base,
    ask: (
      subject: string,
      question: string,
      clientRequestId = randomBytes(8).toString("hex"),
    ) =>
      pooledFetch(base + "/questions", {
        dispatcher,
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokens[subject]}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ courseId: "course", question, clientRequestId }),
      }),
    get: (subject: string, path: string) =>
      pooledFetch(base + path, {
        dispatcher,
        headers: { Authorization: `Bearer ${tokens[subject]}` },
      }).then((r) => r as unknown as Response),
    connections: () =>
      new Promise<number>((resolve, reject) =>
        server.getConnections((error, count) =>
          error ? reject(error) : resolve(count),
        ),
      ),
    raw: () => readFileSync(path),
    close: async () => {
      await dispatcher.close();
      await new Promise<void>((resolve) => server.close(() => resolve()));
      store.close();
    },
  };
}
