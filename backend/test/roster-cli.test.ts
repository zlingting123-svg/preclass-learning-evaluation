import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { SqliteStore } from '../src/store.js';

test('构建产物CLI：批次/班级→名单预览→指纹确认；stdout不输出学生姓名或口令', () => {
  mkdirSync('work', { recursive: true }); const directory = mkdtempSync(resolve('work', 'synthetic-cli-'));
  const dbPath = resolve(directory, 'private.sqlite');
  const seed = new SqliteStore(dbPath);
  const actorId = randomUUID(), teacherId = randomUUID();
  seed.put('user', actorId, { id: actorId, displayName: '模拟管理员', role: 'admin' });
  seed.put('user', teacherId, { id: teacherId, displayName: '模拟教师', role: 'teacher' }); seed.close();
  const entry = resolve('dist/backend/src/roster-cli.js');
  const run = (operation: string, extra: Record<string, string> = {}, input = '') => {
    const child = spawnSync(process.execPath, [entry, operation], { cwd: directory,
      env: { ...process.env, NODE_ENV: 'test', DB_PATH: dbPath, STORAGE_MODE: 'local-sqlite', AUTH_MODE: 'local-bcrypt', ACTOR_ID: actorId, ...extra },
      input, encoding: 'utf8', windowsHide: true });
    assert.equal(child.status, 0, child.stderr); return { text: child.stdout, data: JSON.parse(child.stdout).data };
  };
  const cohort = run('cohort', {}, JSON.stringify({ name: 'CLI模拟批次', courseName: 'CLI模拟课程', startsOn: '2026-11-01', endsOn: '2027-01-31', teacherIds: [teacherId] })).data;
  const cls = run('class', {}, JSON.stringify({ teacherId, cohortId: cohort.id, name: 'CLI模拟班级' })).data;
  const csvPath = resolve(directory, 'synthetic.csv'); writeFileSync(csvPath, '学号,姓名\n0000456,仅私密名单可见的模拟姓名\n');
  const preview = run('preview', { ROSTER_FILE: csvPath, CLASS_ID: cls.id });
  assert.equal(preview.data.executed, false); assert.equal(preview.data.counts.newAccounts, 1);
  assert.equal(preview.text.includes('仅私密名单可见的模拟姓名'), false);
  const result = run('commit', { IMPORT_PLAN_ID: preview.data.planId, IMPORT_PLAN_HASH: preview.data.hash });
  const privateOutput = JSON.parse(readFileSync(result.data.credentialsFile, 'utf8'));
  assert.equal(privateOutput.accounts[0].studentNumber, '0000456'); assert.equal(result.text.includes(privateOutput.accounts[0].password), false);
  const final = new SqliteStore(dbPath);
  try { assert.equal(final.all('account').length, 1); assert.equal(final.all('member').length, 1); }
  finally { final.close(); }
});
