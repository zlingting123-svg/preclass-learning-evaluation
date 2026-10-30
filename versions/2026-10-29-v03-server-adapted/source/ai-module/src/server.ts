import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { readConfig } from "./config.js";
import { jwtIdentity, StaticAuthorization } from "./auth.js";
import { KeywordKnowledge } from "./knowledge.js";
import { Ledger } from "./ledger.js";
import { DeepSeekProvider } from "./deepseek.js";
import { MockProvider } from "./mock.js";
import { Gateway } from "./gateway.js";
import { BalanceMonitor } from "./balance.js";
import { createModuleApp } from "./app.js";
import { requireValue } from "./errors.js";
try {
  const path = process.env.AI_CONFIG;
  requireValue(path, 503, "AI_CONFIG_REQUIRED");
  const c = readConfig(path);
  requireValue(
    process.env.NODE_ENV !== "production",
    503,
    "PRODUCTION_REQUIRES_HOST_AUTH_AND_DISTRIBUTED_STORE",
  );
  const secretPath = process.env.AI_AUTH_SECRET_FILE;
  requireValue(secretPath, 503, "AUTH_KEY_REQUIRED");
  const key = readFileSync(secretPath);
  requireValue(key.length >= 32, 503, "AUTH_KEY_TOO_SHORT");
  const fingerprintPath = process.env.AI_FINGERPRINT_SECRET_FILE;
  requireValue(fingerprintPath, 503, "FINGERPRINT_KEY_REQUIRED");
  const fingerprint = readFileSync(fingerprintPath, "utf8");
  const host = process.env.AI_HOST ?? "127.0.0.1";
  requireValue(
    ["127.0.0.1", "::1", "localhost"].includes(host),
    503,
    "LOCAL_ONLY",
  );
  const port = Number(process.env.AI_PORT ?? 8891);
  requireValue(
    Number.isInteger(port) && port > 0 && port < 65536,
    400,
    "INVALID_PORT",
  );
  const store = new Ledger(
    resolve(process.env.AI_DB_PATH ?? "work/metadata.sqlite"),
  );
  const deployments = c.deployments.map((d) => ({
    ...d,
    provider:
      c.mode === "mock"
        ? new MockProvider()
        : new DeepSeekProvider(process.env[d.credentialEnv!]!),
  }));
  const balances =
    c.mode === "deepseek" ? new BalanceMonitor(c.balance) : undefined;
  const gateway = new Gateway(
    {
      identity: jwtIdentity({
        key,
        issuer: "course-platform",
        audience: "course-ai",
        algorithm: "HS256",
      }),
      authorization: new StaticAuthorization(c.grants),
      knowledge: new KeywordKnowledge(c.sources, c.courses),
    },
    store,
    c.policy,
    deployments,
    fingerprint,
    balances,
  );
  const server = createModuleApp(gateway, balances).listen(port, host, () =>
    console.log(
      JSON.stringify({
        event: "module_started",
        mode: c.mode,
        host,
        port,
        productionReady: false,
      }),
    ),
  );
  const stop = () => {
    server.close(() => {
      store.close();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 5000).unref();
  };
  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);
} catch {
  process.stderr.write(
    "AI模块启动失败：检查配置、密钥文件、预算和模式；敏感配置不打印。\n",
  );
  process.exitCode = 1;
}
