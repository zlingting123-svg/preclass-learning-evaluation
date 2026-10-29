import { test } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync, mkdirSync } from "node:fs";
import { createFixture } from "./fixture.js";

// No retries. TCP handshakes are bounded at 1 / 10ms to avoid a local 128-SYN backlog storm.
// Requests already connected remain concurrent; the fake provider holds responses for 6s.
test("300 simultaneous in-flight upstream API jobs over real HTTP; 350-slot configured headroom; synthetic only", async () => {
  const f = await createFixture({
    students: 300,
    connections: 512,
    concurrency: 350,
    delayMs: 6000,
    policy: { maxQueue: 600, queueTimeoutMs: 30000, requestTimeoutMs: 60000 },
  });
  const start = performance.now();
  try {
    const results = await Promise.all(
      Array.from({ length: 300 }, async (_, i) => {
        const r = await f.ask(
          "s" + i,
          "环境评价的作用是什么？",
          "capacity-" + i,
        );
        assert.equal(r.status, 200);
        return r.text();
      }),
    );
    assert.equal(results.filter((r) => r.includes("event: done")).length, 300);
    assert.equal(f.provider.calls, 300);
    assert.equal(f.provider.peak, 300);
    mkdirSync("verification", { recursive: true });
    writeFileSync(
      "verification/capacity-300-api.json",
      JSON.stringify(
        {
          date: "2026-10-28",
          kind: "real local HTTP + fake model; NOT DeepSeek capacity",
          offered: 300,
          completed: 300,
          actualPeakInFlightProvider: f.provider.peak,
          configuredGenerationSlots: 350,
          queueSlots: 600,
          elapsedMs: Math.round(performance.now() - start),
          clientConnections: 512,
          tcpHandshakesAtOnce: 1,
          tcpHandshakePacingMs: 10,
          autoRetries: 0,
        },
        null,
        2,
      ),
    );
  } finally {
    await f.close();
  }
});
test("500 authenticated requests and simultaneously established TCP connections (paced arrival); no frontend/system capacity claim", async () => {
  const f = await createFixture({ students: 500, connections: 600 });
  try {
    const start = performance.now();
    const results = await Promise.all(
      Array.from({ length: 500 }, async (_, i) => {
        const r = await f.get("s" + i, "/usage/me");
        assert.equal(r.status, 200);
        await r.json();
        return r.status;
      }),
    );
    assert.equal(results.length, 500);
    const connections = await f.connections();
    assert.ok(
      connections >= 500,
      `only ${connections} concurrent established sockets`,
    );
    mkdirSync("verification", { recursive: true });
    writeFileSync(
      "verification/capacity-500-access.json",
      JSON.stringify(
        {
          date: "2026-10-28",
          kind: "AI module authenticated usage endpoint; NOT whole-site online users",
          requests: 500,
          success: 500,
          establishedConnections: connections,
          elapsedMs: Math.round(performance.now() - start),
          clientConnections: 600,
          tcpHandshakesAtOnce: 1,
          tcpHandshakePacingMs: 10,
          autoRetries: 0,
        },
        null,
        2,
      ),
    );
  } finally {
    await f.close();
  }
});
