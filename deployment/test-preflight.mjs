import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { SqliteStore } from "../backend/dist/backend/src/store.js";
import { LocalAuth } from "../backend/dist/backend/src/auth.js";
import { DatabaseSync } from "node:sqlite";
const root = resolve(dirname(fileURLToPath(import.meta.url)), ".."),
  work = mkdtempSync(resolve(tmpdir(), "preclass-preflight-")),
  dbPath = resolve(work, "fixture.sqlite"),
  store = new SqliteStore(dbPath);
try {
  await new LocalAuth(store).createUser(
    "fixture-admin",
    randomUUID(),
    "模拟部署管理员",
    "admin",
  );
} finally {
  store.close();
}
const env = {
  ...process.env,
  NODE_ENV: "production",
  DEPLOYMENT_MODE: "single-host",
  APP_ORIGIN: "https://classroom.example.test",
  STATIC_DIR: resolve(root, "frontend/dist"),
  DB_PATH: dbPath,
  BACKUP_DIR: resolve(work, "backups"),
};
if (process.platform === "linux") {
  const check = spawnSync(
    process.execPath,
    [resolve(root, "deployment/preflight.mjs")],
    { env, encoding: "utf8" },
  );
  if (check.status !== 0) throw Error(check.stderr);
  console.log(check.stdout.trim());
}
const result = spawnSync(
  process.execPath,
  [resolve(root, "deployment/backup.mjs")],
  { env, encoding: "utf8" },
);
if (result.status !== 0) throw Error(result.stderr);
const report = JSON.parse(result.stdout);
const restored = new DatabaseSync(report.backup, { readOnly: true });
try {
  if (
    restored
      .prepare("SELECT count(*) AS n FROM records WHERE kind='user'")
      .get().n !== 1
  )
    throw Error("Restored account count mismatch");
} finally {
  restored.close();
}
console.log("PASS online backup and isolated restore; synthetic DB only");
