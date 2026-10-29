import { existsSync, accessSync, constants, mkdirSync, lstatSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { config } from "../backend/dist/backend/src/config.js";
if (process.platform !== "linux")
  throw Error("This preflight targets the prepared Linux server");
const [major, minor] = process.versions.node.split(".").map(Number);
if (major !== 24 || minor < 15)
  throw Error("Use project-compatible Node 24.15+ (<25)");
if (process.getuid?.() === 0)
  throw Error("Application must run as preclass, not root");
const c = config();
if (!c.production || !c.staticDir || !existsSync(c.staticDir + "/index.html"))
  throw Error("Production frontend/config missing");
if(!existsSync(c.staticDir+"/design-preview.html"))throw Error("Learning-space production entry missing");
const python=spawnSync(process.env.REFERENCE_PYTHON??'python3',['-c','import pypdf; print(pypdf.__version__)'],{encoding:'utf8',timeout:10000});
if(python.status!==0)throw Error("PDF parser unavailable: install backend/scripts/requirements.txt in REFERENCE_PYTHON venv");
accessSync(dirname(c.dbPath), constants.W_OK);
for(const name of ['reference-files','ai']){const path=dirname(c.dbPath)+'/'+name;if(existsSync(path)&&lstatSync(path).isSymbolicLink())throw Error('Private storage cannot be a symlink');mkdirSync(path,{recursive:true,mode:0o700});accessSync(path,constants.W_OK);}

if (!existsSync(c.dbPath))
  throw Error(
    "Create the database and a private administrator first; no demo seeding",
  );
const db = new DatabaseSync(c.dbPath, { readOnly: true });
try {
  const active = db
    .prepare("SELECT payload FROM records WHERE kind='account'")
    .all()
    .some((r) => {
      const a = JSON.parse(r.payload);
      return a.user?.role === "admin" && !a.disabled;
    });
  if (!active)
    throw Error(
      "No active administrator; run the controlled account command before enabling service",
    );
} finally {
  db.close();
}
console.log(
  "Preflight passed: Linux, unprivileged user, private data, frontend and administrator. TLS/filing/load still need external verification.",
);
