import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { createApp } from '../src/app.js';
import { Service } from '../src/service.js';
import { SqliteStore } from '../src/store.js';
import type { AuthProvider } from '../src/auth.js';
import { AppError } from '../src/errors.js';
import { safeCsv } from '../src/csv.js';
import { parse } from 'csv-parse/sync';

test('开源CSV往返保留前导零、逗号、引号、中文、换行并防公式', () => {
  const csv = safeCsv([['studentNumber', 'text'], ['0000123', '中文,"引号"\n下一行'], ['0000124', '  =SUM(1,2)'], ['0000125', '@formula']]);
  const rows = parse(csv, { bom: true, cast: false }) as string[][];
  assert.equal(rows[1][0], '0000123'); assert.equal(rows[1][1], '中文,"引号"\n下一行');
  assert.equal(rows[2][1], "'  =SUM(1,2)"); assert.equal(rows[3][1], "'@formula");
});

test('成熟限流器：同NAT不同账号不互相锁定，成功不消耗失败额度，429信封和安全头正确', async () => {
  const store = new SqliteStore(':memory:');
  const auth: AuthProvider = {
    async login(body) {
      const input = body as { username: string; password: string };
      if (input.password !== 'synthetic-valid') throw new AppError(401, 'UNAUTHENTICATED', '模拟错误口令');
      return { user: { id: 'synthetic-user', displayName: '模拟用户', role: 'student' }, accessToken: 'synthetic-token', expiresAt: new Date().toISOString() };
    },
    authenticate() { throw new Error('unused'); }, logout() {},
  };
  const server = createApp(new Service(store), auth).listen(0, '127.0.0.1'); await once(server, 'listening');
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const login = (username: string, password: string) => fetch(base + '/api/v1/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) });
  try {
    for (let i = 0; i < 12; i++) assert.equal((await login('account-success', 'synthetic-valid')).status, 200);
    for (let i = 0; i < 10; i++) assert.equal((await login('account-failure', 'synthetic-invalid')).status, 401);
    const blocked = await login('account-failure', 'synthetic-invalid'); assert.equal(blocked.status, 429);
    const error = await blocked.json(); assert.equal(error.error.code, 'RATE_LIMITED'); assert.ok(error.requestId);
    assert.ok(blocked.headers.get('Retry-After')); assert.equal(blocked.headers.get('X-Content-Type-Options'), 'nosniff');
    assert.equal(blocked.headers.get('X-Frame-Options'), 'SAMEORIGIN');
    assert.equal((await login('other-student', 'synthetic-valid')).status, 200);
  } finally { await new Promise<void>(done => server.close(() => done())); store.close(); }
});
