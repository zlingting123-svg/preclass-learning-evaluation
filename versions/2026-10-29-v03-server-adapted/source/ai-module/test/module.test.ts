import { test } from "node:test";
import assert from "node:assert/strict";
import { createFixture } from "./fixture.js";

test("student membership and role checked before provider use", async () => {
  const f = await createFixture();
  try {
    const denied = await f.ask("outsider", "环境评价有什么作用？");
    assert.equal(denied.status, 403);
    const teacher = await f.ask("teacher", "环境评价有什么作用？");
    assert.equal(teacher.status, 403);
    assert.equal(f.provider.calls, 0);
  } finally {
    await f.close();
  }
});
test("scope refusal and missing evidence never call the answer model", async () => {
  const f = await createFixture();
  try {
    assert.match(
      await (await f.ask("student", "帮我写游戏外挂")).text(),
      /refusal/,
    );
    assert.match(
      await (await f.ask("student", "环境评价的未收录新制度是什么")).text(),
      /insufficient_evidence/,
    );
    assert.equal(f.provider.calls, 0);
  } finally {
    await f.close();
  }
});
test("SSE result, durable usage and no stored transcript; completed retries never regenerate", async () => {
  const f = await createFixture();
  try {
    const question = "环境评价的作用是什么？不应留存的提问正文987xyz";
    const result = await f.ask("student", question, "request-persistence");
    const body = await result.text();
    assert.match(body, /event: done/);
    assert.match(body, /event: delta/);
    assert.equal(f.provider.calls, 1);
    assert.equal(
      f.store.rows().filter((r) => r.state === "completed").length,
      1,
    );
    assert.ok(!JSON.stringify(f.store.rows()).includes("987xyz"));
    assert.equal(
      (await f.ask("student", question, "request-persistence")).status,
      409,
    );
    assert.equal(f.provider.calls, 1);
    const usage = await (await f.get("student", "/usage/me")).json();
    assert.equal(usage.data.modelCalls, 1);
    assert.equal((await f.get("student", "/admin/usage")).status, 403);
  } finally {
    await f.close();
  }
});
test("incomplete upstream stream retains worst case reserve as usage_unknown", async () => {
  const f = await createFixture({ mode: "broken" });
  try {
    const body = await (
      await f.ask("student", "环境评价的作用是什么？")
    ).text();
    assert.match(body, /event: error/);
    assert.doesNotMatch(body, /event: done/);
    assert.equal(f.store.rows()[0].state, "usage_unknown");
    assert.ok(f.store.rows()[0].reservedMicros > 0);
  } finally {
    await f.close();
  }
});
test("205 HTTP requests with a 64-connection client pool; fake upstream bounded to eight", async () => {
  const f = await createFixture({
    students: 205,
    concurrency: 8,
    delayMs: 100,
  });
  try {
    const results = await Promise.all(
      Array.from({ length: 205 }, async (_, i) =>
        (await f.ask("s" + i, "环境评价的作用是什么？", "burst-" + i)).text(),
      ),
    );
    assert.equal(results.filter((x) => x.includes("event: done")).length, 205);
    assert.ok(f.provider.peak <= 8);
    assert.equal(f.store.rows().length, 205);
  } finally {
    await f.close();
  }
});

test("205 concurrent logical jobs in the RAM scheduler, not 205 TCP sockets or real model calls", async () => {
  const f = await createFixture({ students: 205, concurrency: 8, delayMs: 30 });
  try {
    await Promise.all(
      Array.from({ length: 205 }, async (_, i) => {
        const user = { subjectId: "s" + i, role: "student" as const };
        const input = {
          courseId: "course",
          question: "环境评价的作用是什么？",
          clientRequestId: "logical-" + i,
        };
        const id = await f.gateway.prepare(user, input);
        let done = false;
        await f.gateway.answer(
          user,
          input,
          id,
          AbortSignal.timeout(15000),
          async (event) => {
            if (event === "done") done = true;
          },
        );
        assert.equal(done, true);
      }),
    );
    assert.equal(f.provider.calls, 205);
    assert.ok(f.provider.peak <= 8);
    assert.equal(
      f.store.rows().filter((x) => x.state === "completed").length,
      205,
    );
  } finally {
    await f.close();
  }
});
