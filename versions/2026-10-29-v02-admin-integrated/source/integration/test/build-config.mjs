import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';

const project = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const frontend = resolve(project, 'frontend');
const requireFront = createRequire(resolve(frontend, 'package.json'));
const viteCli = resolve(dirname(requireFront.resolve('vite/package.json')), 'bin/vite.js');
const results = [];
for (const [mode, marker] of [['mock', '生产构建禁止 mock'], ['invalid', 'VITE_API_MODE 必须为 http 或 mock']]) {
  const child = spawnSync(process.execPath, [viteCli, 'build'], { cwd: frontend, env: { ...process.env, VITE_API_MODE: mode }, windowsHide: true, encoding: 'utf8' });
  assert.notEqual(child.status, 0); assert.ok((child.stderr + child.stdout).includes(marker));
  results.push({ name: `生产构建拒绝VITE_API_MODE=${mode}`, result: 'pass' });
}
const assets = resolve(frontend, 'dist/assets');
const scripts = readdirSync(assets).filter(name => name.endsWith('.js')).map(name => readFileSync(resolve(assets, name), 'utf8')).join('\n');
for (const marker of ['demo123', 'u_stu_demo', '示例班级·一班']) assert.equal(scripts.includes(marker), false, '生产包包含模拟登录/数据');
results.push({ name: '生产包无演示口令、模拟用户与班级标记', result: 'pass' });
mkdirSync(resolve(project, 'integration/verification'), { recursive: true });
writeFileSync(resolve(project, 'integration/verification/2026-10-27-build-config.json'), JSON.stringify({ results }, null, 2));
for (const result of results) process.stdout.write(`PASS ${result.name}\n`);
