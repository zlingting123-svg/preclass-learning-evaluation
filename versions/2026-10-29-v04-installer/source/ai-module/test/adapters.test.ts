import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { DeepSeekProvider } from "../src/deepseek.js";
import { BalanceMonitor } from "../src/balance.js";
import { createFixture } from "./fixture.js";
import { configSchema } from "../src/config.js";
import type { UpstreamInput, Deployment } from "../src/contracts.js";
const input: UpstreamInput = {
  question: "环境评价作用？",
  evidence: [
    {
      id: "doc",
      scopeId: "scope",
      topicId: "topic",
      title: "课程资料",
      content: "明确资料",
      version: "1",
      approved: true,
      keywords: [],
      score: 1,
    },
  ],
  userId: "opaque-user",
  maxOutputTokens: 200,
  signal: AbortSignal.timeout(10000),
};
function stream(text: string, chunkSize = 1) {
  const bytes = new TextEncoder().encode(text);
  return new ReadableStream<Uint8Array>({
    start(c) {
      for (let i = 0; i < bytes.length; i += chunkSize)
        c.enqueue(bytes.slice(i, i + chunkSize));
      c.close();
    },
  });
}
test("DeepSeek adapter handles split UTF8/CRLF, one terminal usage and explicit non-thinking/output cap", async () => {
  let request: Record<string, unknown> = {};
  const data =
    ": ping\r\n\r\ndata: " +
    JSON.stringify({
      choices: [{ delta: { content: "环境讲解" }, finish_reason: null }],
      usage: null,
    }) +
    "\r\n\r\ndata: " +
    JSON.stringify({
      choices: [{ delta: {}, finish_reason: "stop" }],
      usage: {
        prompt_tokens: 123,
        completion_tokens: 40,
        prompt_cache_hit_tokens: 23,
      },
    }) +
    "\n\ndata: [DONE]\n\n";
  const fake = (async (_url: unknown, init: RequestInit) => {
    request = JSON.parse(String(init.body));
    return new Response(stream(data), {
      headers: { "Content-Type": "text/event-stream" },
    });
  }) as typeof fetch;
  const provider = new DeepSeekProvider("secret-not-for-logging", fake);
  const events = [];
  for await (const e of provider.stream(input)) events.push(e);
  assert.equal(events[0].type, "delta");
  assert.equal(request.user_id, "opaque-user");
  assert.equal(request.max_tokens, 200);
  assert.deepEqual(request.thinking, { type: "disabled" });
  assert.deepEqual(
    events.find((e) => e.type === "usage"),
    {
      type: "usage",
      usage: { inputTokens: 123, outputTokens: 40, cacheHitTokens: 23 },
    },
  );
  assert.ok(!JSON.stringify(request).includes("secret-not-for-logging"));
});
test("DeepSeek truncated stream, upstream 429 and arbitrary base URL fail closed without exposing upstream body", async () => {
  const truncated = new DeepSeekProvider(
    "private-key",
    async () =>
      new Response(
        stream('data: {"choices":[{"delta":{"content":"partial"}}]}\n\n'),
      ),
  );
  await assert.rejects(async () => {
    for await (const e of truncated.stream(input)) void e;
  }, /UPSTREAM_INCOMPLETE/);
  const limited = new DeepSeekProvider(
    "private-key",
    async () => new Response("private upstream body", { status: 429 }),
  );
  await assert.rejects(async () => {
    for await (const e of limited.stream(input)) void e;
  }, /UPSTREAM_RATE_LIMIT/);
  assert.throws(
    () => new DeepSeekProvider("private-key", fetch, "http://127.0.0.1:1"),
    /UPSTREAM_ORIGIN/,
  );
});
test("balance single-flight across keys under same account; warning vs stop and unknown are distinct", async () => {
  let calls = 0;
  const provider = {
    model: "fake",
    async *stream() {},
    async balance() {
      calls++;
      await new Promise((r) => setTimeout(r, 5));
      return { currency: "CNY", balance: "5.00", available: true };
    },
  };
  const d: Deployment = {
    id: "a",
    accountId: "same-account",
    quotaGroup: "same-account",
    purposes: ["student_qa"],
    maxConcurrency: 4,
    provider,
  };
  const monitor = new BalanceMonitor({
    currency: "CNY",
    warningMicros: 10000000,
    stopMicros: 1000000,
    ttlMs: 10000,
  });
  const results = await Promise.all(
    Array.from({ length: 20 }, () =>
      monitor.inspect(d, AbortSignal.timeout(1000)),
    ),
  );
  assert.equal(calls, 1);
  assert.equal(results[0].state, "warning");
  const stopped = new BalanceMonitor({
    currency: "CNY",
    warningMicros: 20000000,
    stopMicros: 6000000,
    ttlMs: 10000,
  });
  await assert.rejects(
    () => stopped.admit(d, AbortSignal.timeout(1000)),
    /BALANCE_STOPPED/,
  );
  const broken = {
    ...d,
    provider: {
      ...provider,
      async balance() {
        throw new Error("do not leak secret");
      },
    },
  };
  const unknown = new BalanceMonitor({
    currency: "CNY",
    warningMicros: 20000000,
    stopMicros: 1,
    ttlMs: 1000,
  });
  await assert.rejects(
    () => unknown.inspect(broken, AbortSignal.timeout(1000)),
    /BALANCE_UNKNOWN/,
  );
});
test("JWT cannot be forged with X-User headers, wrong signature, expired token, or body supplied user/model/key", async () => {
  const f = await createFixture();
  try {
    assert.equal(
      (
        await fetch(f.base + "/usage/me", {
          headers: { "X-User-Id": "student", "X-Role": "student" },
        })
      ).status,
      401,
    );
    assert.equal(
      (
        await fetch(f.base + "/usage/me", {
          headers: { Authorization: "Bearer " + f.tokens.expired },
        })
      ).status,
      401,
    );
    const malformed = await fetch(f.base + "/questions", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + f.tokens.student,
        "Content-Type": "application/json",
      },
      body: "{",
    });
    assert.equal(malformed.status, 400);
    const forged = f.tokens.student.slice(0, -10) + "AAAAAAAAAA";
    assert.equal(
      (
        await fetch(f.base + "/usage/me", {
          headers: { Authorization: "Bearer " + forged },
        })
      ).status,
      401,
    );
    const response = await fetch(f.base + "/questions", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + f.tokens.student,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        courseId: "course",
        question: "环境评价作用",
        clientRequestId: "strict",
        userId: "admin",
        model: "expensive",
        apiKey: "secret",
      }),
    });
    assert.equal(response.status, 400);
    assert.equal(f.provider.calls, 0);
  } finally {
    await f.close();
  }
});
test("daily limit, global reservation and per-student concurrency do not trigger extra model calls", async () => {
  const f = await createFixture({ policy: { dailyRequests: 1 }, delayMs: 30 });
  try {
    const responses = await Promise.all([
      f.ask("student", "环境评价的作用是什么？", "one"),
      f.ask("student", "环境评价的作用是什么？", "two"),
    ]);
    assert.equal(responses.filter((r) => r.status === 429).length, 1);
    await Promise.all(responses.map((r) => r.text()));
    assert.equal(f.provider.calls, 1);
  } finally {
    await f.close();
  }
  const g = await createFixture({
    policy: { monthlyBudgetMicros: 2000 },
    students: 2,
    delayMs: 30,
  });
  try {
    const r = await Promise.all([
      g.ask("s0", "环境评价的作用是什么？"),
      g.ask("s1", "环境评价的作用是什么？"),
    ]);
    assert.equal(r.filter((x) => x.status === 429).length, 1);
    await Promise.all(r.map((x) => x.text()));
    assert.equal(g.provider.calls, 1);
  } finally {
    await g.close();
  }
});
test("same quotaGroup keys share concurrency and do not access teacher-only deployment; raw SQLite/WAL never contain question or answer", async () => {
  const f = await createFixture({
    students: 20,
    delayMs: 10,
    deployments: (p) => [
      {
        id: "a",
        accountId: "account",
        quotaGroup: "account",
        purposes: ["student_qa"],
        maxConcurrency: 2,
        provider: p,
      },
      {
        id: "b",
        accountId: "account",
        quotaGroup: "account",
        purposes: ["student_qa"],
        maxConcurrency: 2,
        provider: p,
      },
      {
        id: "teacher",
        accountId: "teacher-account",
        quotaGroup: "teacher-account",
        purposes: ["teacher_analytics"],
        maxConcurrency: 50,
        provider: p,
      },
    ],
  });
  try {
    await Promise.all(
      Array.from({ length: 20 }, async (_, i) =>
        (
          await f.ask(
            "s" + i,
            "环境评价的作用是什么？unique-private-canary-737",
          )
        ).text(),
      ),
    );
    assert.ok(f.provider.peak <= 2);
    assert.ok(f.store.rows().every((r) => r.deploymentId !== "teacher"));
    for (const file of readdirSync(f.directory)) {
      if (file.includes("sqlite")) {
        const bytes = readFileSync(f.directory + "/" + file);
        assert.ok(!bytes.includes(Buffer.from("unique-private-canary-737")));
        assert.ok(!bytes.includes(Buffer.from("本地替身测试")));
      }
    }
    const topics = await (
      await f.get("teacher", "/teacher/courses/course/topics")
    ).json();
    assert.equal(topics.data.buckets[0].count, 20);
    assert.ok(!JSON.stringify(topics).includes("s0"));
  } finally {
    await f.close();
  }
});
test("unconfigured policy is rejected, and disabled service makes no upstream calls", async () => {
  assert.equal(configSchema.safeParse({ mode: "deepseek" }).success, false);
  const f = await createFixture({ policy: { enabled: false } });
  try {
    assert.equal(
      (await f.ask("student", "环境评价的作用是什么？")).status,
      503,
    );
    assert.equal(f.provider.calls, 0);
  } finally {
    await f.close();
  }
});

test("store refuses a second process owner and recovers interrupted metadata without transcript", async () => {
  const { Ledger } = await import("../src/ledger.js");
  const f = await createFixture();
  try {
    assert.throws(() => new Ledger(f.path), /STORE_ALREADY_OWNED/);
  } finally {
    await f.close();
  }
  const g = await createFixture();
  const user = { subjectId: "student", role: "student" as const };
  const id = await g.gateway.prepare(user, {
    courseId: "course",
    question: "环境评价的作用是什么？",
    clientRequestId: "restart",
  });
  g.store.update(id, { state: "calling", deploymentId: "fake" });
  await g.close();
  const reopened = new Ledger(g.path);
  try {
    assert.equal(reopened.rows()[0].state, "usage_unknown");
    assert.ok(reopened.rows()[0].reservedMicros > 0);
  } finally {
    reopened.close();
  }
});
test("client cancellation is observed and an active provider is accounted conservatively", async () => {
  const f = await createFixture({ delayMs: 200 });
  try {
    const user = { subjectId: "student", role: "student" as const };
    const input = {
      courseId: "course",
      question: "环境评价的作用是什么？",
      clientRequestId: "cancelled",
    };
    const id = await f.gateway.prepare(user, input);
    const controller = new AbortController();
    await f.gateway.answer(
      user,
      input,
      id,
      controller.signal,
      async (event) => {
        if (event === "sources") controller.abort();
      },
    );
    assert.equal(f.store.get(id)?.state, "usage_unknown");
    assert.equal((await f.gateway.scheduler.status()).accounts[0].active, 0);
  } finally {
    await f.close();
  }
});

test("queued requests recheck revoked course membership before calling provider", async () => {
  const f = await createFixture({ students: 2, concurrency: 1, delayMs: 80 });
  try {
    const first = await f.ask("s0", "环境评价的作用是什么？");
    const second = await f.ask("s1", "环境评价的作用是什么？");
    const { StaticAuthorization } = await import("../src/auth.js");
    delete (
      f.gateway.deps.authorization as InstanceType<typeof StaticAuthorization>
    ).grants.s1;
    const results = await Promise.all([first.text(), second.text()]);
    assert.match(results[1], /COURSE_FORBIDDEN/);
    assert.equal(f.provider.calls, 1);
  } finally {
    await f.close();
  }
});
