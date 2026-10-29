import { execFileSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  readdirSync,
  copyFileSync,
} from "node:fs";
import { createHash } from "node:crypto";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const git = (...args) =>
  execFileSync("git", args, { cwd: root, encoding: "utf8" });
if (git("status", "--porcelain").trim())
  throw Error("Release requires a clean committed checkout");
const commit = git("rev-parse", "HEAD").trim(),
  output = resolve(
    process.argv[2] ?? resolve(root, "integration/work/releases"),
  );
mkdirSync(output, { recursive: true });
execFileSync("npm", ["--prefix", "frontend", "run", "build"], {
  cwd: root,
  stdio: "inherit",
  shell: process.platform === "win32",
});
const staging = mkdtempSync(resolve(output, "staging-")),
  files = git("ls-tree", "-r", "--name-only", "-z", "HEAD")
    .split("\0")
    .filter(Boolean)
    .filter(
      (p) =>
        /^(backend\/(src|test)\/|shared\/|frontend\/(src|public)\/|deployment\/)/.test(
          p,
        ) ||
        /^(backend|frontend)\/(package(?:-lock)?\.json|tsconfig(?:\.app|\.node)?\.json|vite.config.ts|index.html|design-preview.html)$/.test(
          p,
        ),
    );
const inventory = [];
function record(path, bytes) {
  mkdirSync(dirname(resolve(staging, path)), { recursive: true });
  writeFileSync(resolve(staging, path), bytes);
  inventory.push({
    path,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  });
}
for (const p of files) {
  if (
    p
      .split("/")
      .some((x) =>
        [
          "node_modules",
          "work",
          ".git",
          "private-data",
          "credentials",
        ].includes(x),
      ) ||
    /\.(sqlite|db|pem|key)$/.test(p)
  )
    throw Error("Forbidden release file");
  record(
    p,
    execFileSync("git", ["show", `HEAD:${p}`], {
      cwd: root,
      maxBuffer: 8 * 1024 * 1024,
    }),
  );
}
function built(directory, prefix) {
  for (const item of readdirSync(directory, { withFileTypes: true })) {
    if (item.isSymbolicLink()) throw Error("Release symlinks forbidden");
    const path = resolve(directory, item.name),
      name = prefix + "/" + item.name;
    if (item.isDirectory()) built(path, name);
    else record(name, readFileSync(path));
  }
}
built(resolve(root, "frontend/dist"), "frontend/dist");
writeFileSync(
  resolve(staging, "release-manifest.json"),
  JSON.stringify(
    {
      commit,
      frontendEntry: "index.html",
      deployment: "single-host behind HTTPS proxy",
      files: inventory,
    },
    null,
    2,
  ),
);
const archive = resolve(output, `preclass-${commit.slice(0, 12)}.tar.gz`);
execFileSync("tar", ["-czf", archive, "-C", staging, "."], {
  stdio: "inherit",
});
const digest = createHash("sha256").update(readFileSync(archive)).digest("hex");
writeFileSync(
  archive + ".sha256",
  digest + "  " + archive.split(/[\\/]/).pop() + "\n",
);
console.log(
  JSON.stringify({ archive, sha256: digest, commit, files: inventory.length }),
);
