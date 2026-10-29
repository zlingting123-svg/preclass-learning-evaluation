import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { once } from "node:events";
import { request as httpRequest } from "node:http";
import { config } from "../src/config.js";
import { SqliteStore } from "../src/store.js";
import { LocalAuth } from "../src/auth.js";
import { Service } from "../src/service.js";
import { createApp } from "../src/app.js";
// Raw HTTP is required here: the Fetch implementation may normalize the forbidden Host header.
function fetch(
  url: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  } = {},
): Promise<Response> {
  return new Promise((done, fail) => {
    const req = httpRequest(
      url,
      { method: options.method ?? "GET", headers: options.headers },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c) => chunks.push(Buffer.from(c)));
        res.on("end", () =>
          done(
            new Response(new Uint8Array(Buffer.concat(chunks)), {
              status: res.statusCode,
              headers: Object.fromEntries(
                Object.entries(res.headers).map(([k, v]) => [
                  k,
                  Array.isArray(v) ? v.join(",") : (v ?? ""),
                ]),
              ),
            }),
          ),
        );
      },
    );
    req.on("error", fail);
    req.end(options.body);
  });
}
test("单机生产配置需显式开启、HTTPS来源和独立持久目录，默认生产仍拒绝", () => {
  const keys = [
    "NODE_ENV",
    "DEPLOYMENT_MODE",
    "APP_ORIGIN",
    "STATIC_DIR",
    "DB_PATH",
  ];
  const before = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
  const folder = mkdtempSync(resolve(tmpdir(), "deploy-config-"));
  try {
    process.env.NODE_ENV = "production";
    delete process.env.DEPLOYMENT_MODE;
    assert.throws(() => config());
    process.env.DEPLOYMENT_MODE = "single-host";
    process.env.APP_ORIGIN = "https://classroom.example.test";
    process.env.STATIC_DIR = resolve(folder, "public");
    process.env.DB_PATH = resolve(folder, "private/app.sqlite");
    assert.equal(config().production, true);
    process.env.DB_PATH = resolve(folder, "public/app.sqlite");
    assert.throws(() => config(), /数据库不能/);
    process.env.DB_PATH = "relative.sqlite";
    assert.throws(() => config());
    process.env.DB_PATH = resolve(folder, "private/app.sqlite");
    process.env.APP_ORIGIN = "http://classroom.example.test";
    assert.throws(() => config());
    process.env.APP_ORIGIN = "https://classroom.example.test/path";
    assert.throws(() => config());
  } finally {
    for (const k of keys) {
      if (before[k] === undefined) delete process.env[k];
      else process.env[k] = before[k];
    }
  }
});
test("生产同源静态页面/API/深链接，拒绝错误Host/Origin且不暴露源码数据库", async () => {
  const folder = mkdtempSync(resolve(tmpdir(), "deploy-static-")),
    site = resolve(folder, "site");
  mkdirSync(resolve(site, "assets"), { recursive: true });
  writeFileSync(
    resolve(site, "index.html"),
    "<!doctype html><title>deployment-fixture</title>",
  );
  writeFileSync(resolve(site, "assets/app.js"), 'console.log("fixture")');
  const store = new SqliteStore(":memory:"),
    auth = new LocalAuth(store);
  await auth.createUser(
    "deploy-user",
    "SyntheticPassword123!",
    "模拟部署教师",
    "teacher",
  );
  const server = createApp(new Service(store), auth, undefined, {
    appOrigin: "https://classroom.example.test",
    staticDir: site,
  }).listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`,
    headers = { Host: "classroom.example.test" };
  try {
    for (const path of ["/", "/admin", "/student/assignments"]) {
      const r = await fetch(base + path, { headers });
      assert.equal(r.status, 200);
      assert.match(await r.text(), /deployment-fixture/);
      assert.equal(r.headers.get("cache-control"), "no-store");
    }
    const asset = await fetch(base + "/assets/app.js", { headers });
    assert.equal(asset.status, 200);
    assert.match(asset.headers.get("cache-control") ?? "", /immutable/);
    for (const path of [
      "/.env",
      "/backend/src/auth.ts",
      "/work/app.sqlite",
      "/assets/missing.js",
    ])
      assert.equal((await fetch(base + path, { headers })).status, 404);
    assert.equal(
      (await fetch(base + "/api/v1/auth/me", { headers })).status,
      401,
    );
    assert.equal((await fetch(base + "/api/v1/health")).status, 400);
    assert.equal(
      (
        await fetch(base + "/api/v1/health", {
          headers: { ...headers, Origin: "https://untrusted.example" },
        })
      ).status,
      403,
    );
    const login = await fetch(base + "/api/v1/auth/login", {
      method: "POST",
      headers: {
        ...headers,
        Origin: "https://classroom.example.test",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        username: "deploy-user",
        password: "SyntheticPassword123!",
      }),
    });
    assert.equal(login.status, 200);
    assert.ok((await login.json()).data.accessToken);
  } finally {
    server.close();
    await once(server, "close");
    store.close();
  }
});
