import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtempSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { createServer } from 'node:net';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';

mkdirSync('work', { recursive: true });
const folder = mkdtempSync(resolve('work', 'synthetic-smoke-'));
const databasePath = resolve(folder, 'source.sqlite');
const password = randomUUID();
let stage = 'create-account';
process.on('exit', code => { if (code) process.stderr.write(`SMOKE_FAILED stage=${stage} exit=${code}\n`); });
const env = { ...process.env, NODE_ENV: 'test', STORAGE_MODE: 'local-sqlite', AUTH_MODE: 'local-bcrypt',
  DB_PATH: databasePath, HOST: '127.0.0.1', USERNAME: 'synthetic-cli-teacher', DISPLAY_NAME: '模拟命令行账号', ROLE: 'teacher' };
async function manage(action, input, extra = {}) {
  const processChild = spawn(process.execPath, ['dist/backend/src/manage.js', action], { env: { ...env, ...extra }, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
  let output = '';
  processChild.stdout.on('data', chunk => { output += chunk; });
  let diagnostics = '';
  processChild.stderr.on('data', chunk => { diagnostics += chunk; });
  processChild.stdin.end(input);
  const [exitCode] = await once(processChild, 'exit');
  assert.equal(exitCode, 0, `管理命令失败 action=${action}: ${diagnostics.slice(-1000)}`); return output;
}
await manage('user', password + '\n');
stage = 'start-server'; process.stdout.write('SMOKE create-account passed\n');
const probe = createServer().listen(0, '127.0.0.1'); await once(probe, 'listening');
const port = probe.address().port; await new Promise(done => probe.close(done));
const child = spawn(process.execPath, ['dist/backend/src/server.js'], { env: { ...env, PORT: String(port) }, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
let serverOutput = '', serverErrors = '';
child.stdout.on('data', chunk => { serverOutput += chunk; });
child.stderr.on('data', chunk => { serverErrors += chunk; });
try {
  const base = `http://127.0.0.1:${port}/api/v1`;
  let ready = false;
  for (let i = 0; i < 50; i++) {
    try { const response = await fetch(base + '/health'); if (response.ok) { ready = true; break; } } catch {}
    await new Promise(done => setTimeout(done, 100));
  }
  assert.ok(ready, '构建后的服务未就绪: ' + serverErrors);
  stage = 'health-login-me'; process.stdout.write('SMOKE server-ready\n');
  const health = await (await fetch(base + '/health')).json();
  assert.equal(health.data.productionReady, false); assert.equal(health.data.contractVersion, '0.5.0');
  const login = await (await fetch(base + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: env.USERNAME, password }) })).json();
  assert.equal(login.ok, true);
  const me = await (await fetch(base + '/auth/me', { headers: { Authorization: `Bearer ${login.data.accessToken}` } })).json();
  assert.equal(me.data.role, 'teacher');
  assert.ok(serverOutput.includes('local_server_started'));
} finally {
  stage = 'stop-server'; process.stdout.write('SMOKE stopping-server\n');
  if (child.exitCode === null && child.signalCode === null) {
    const ended = once(child, 'exit'); child.kill(); await ended;
  }
}
const restoredPath = resolve(folder, 'restored.sqlite');
stage = 'backup'; process.stdout.write('SMOKE backup\n');
await manage('backup', '', { BACKUP_PATH: restoredPath });
const db = new DatabaseSync(restoredPath);
stage = 'verify-restore';
try {
  assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check, 'ok');
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM records WHERE kind='user'").get().count, 1);
} finally { db.close(); }
process.stdout.write('PASS: 构建产物启动、受控账号命令、HTTP登录/me、备份命令和恢复副本完整性；仅本机模拟账号。\n');
