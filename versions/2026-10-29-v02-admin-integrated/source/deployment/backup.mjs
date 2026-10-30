import { DatabaseSync, backup } from "node:sqlite";
import { resolve } from "node:path";
import { mkdirSync, existsSync } from "node:fs";
const source = process.env.DB_PATH;
if (!source || !existsSync(source))
  throw Error(
    "Existing DB_PATH required; refusing to back up a new empty database",
  );
const directory = process.env.BACKUP_DIR ?? "/var/backups/preclass";
mkdirSync(directory, { recursive: true, mode: 0o700 });
const target = resolve(
  directory,
  `preclass-${new Date().toISOString().replaceAll(":", "-")}-${process.pid}.sqlite`,
);
const db = new DatabaseSync(source, { readOnly: true });
try {
  await backup(db, target);
  const copy = new DatabaseSync(target, { readOnly: true });
  try {
    if (copy.prepare("PRAGMA integrity_check").get().integrity_check !== "ok")
      throw Error("Backup integrity failed");
  } finally {
    copy.close();
  }
  console.log(JSON.stringify({ backup: target, integrity: "ok" }));
} finally {
  db.close();
}
