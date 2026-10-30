import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtempSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import type { Assignment, RubricInfo, Submission, User } from '../../shared/contracts.js';
import { SqliteStore, type Store } from '../src/store.js';
import { LocalAuth } from '../src/auth.js';
import { Service, type Job } from '../src/service.js';
import { AdminService } from '../src/admin.js';
import { createApp } from '../src/app.js';
import { Worker, type Scorer } from '../src/worker.js';
import { config } from '../src/config.js';

// Explicitly synthetic accounts/material; no production credentials or rubric.
const password = randomUUID();
const store = new SqliteStore(':memory:');
let time = Date.parse('2026-10-27T00:00:00Z');
const now = () => time;
const service = new Service(store, now);
const auth = new LocalAuth(store, now);
let teacher: User, student: User, otherStudent: User, otherTeacher: User;
let teacherToken: string, studentToken: string, otherStudentToken: string, otherTeacherToken: string;
let server: Server, base: string;
const rubric: RubricInfo = { id: 'synthetic-rubric', name: '模拟测试规则，非教学标准', version: 'test-1',
  dimensions: [{ id: 'synthetic-dimension', name: '模拟维度', description: '仅验证结构', maxScore: 10 }], aggregationDescription: '未配置总分' };
const fakeScorer: Scorer = { async score() { return {
  method: 'rule', modelProvider: null, modelVersion: null, needsReview: true,
  scores: { dimensions: [{ dimensionId: 'synthetic-dimension', name: '模拟维度', score: 5, maxScore: 10, rationale: '模拟测试输出' }],
    totalScore: null, totalMaxScore: null, feedback: '模拟反馈，不用于教学' },
}; } };

before(async () => {
  teacher = await auth.createUser('test-teacher', password, '测试教师', 'teacher');
  student = await auth.createUser('test-student', password, '=测试学生', 'student');
  otherStudent = await auth.createUser('test-other-student', password, '其他测试学生', 'student');
  otherTeacher = await auth.createUser('test-other-teacher', password, '其他测试教师', 'teacher');
  teacherToken = (await auth.login({ username: 'test-teacher', password })).accessToken;
  studentToken = (await auth.login({ username: 'test-student', password })).accessToken;
  otherStudentToken = (await auth.login({ username: 'test-other-student', password })).accessToken;
  otherTeacherToken = (await auth.login({ username: 'test-other-teacher', password })).accessToken;
  server = createApp(service, auth).listen(0, '127.0.0.1'); await once(server, 'listening');
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1`;
});
after(async () => { if (server) await new Promise<void>((done, reject) => server.close(e => e ? reject(e) : done())); store.close(); });

async function request(path: string, token?: string, method = 'GET', body?: unknown, key?: string) {
  const response = await fetch(base + path, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(body ? { 'Content-Type': 'application/json' } : {}), ...(key ? { 'Idempotency-Key': key } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}) });
  return { status: response.status, body: await response.json() };
}
function fixture(svc = service, withRubric = false) {
  const c = svc.createClass(teacher, '模拟班级'); svc.join(student, c.joinCode!);
  if (withRubric) svc.store.put('rubric', rubric.id, rubric);
  const draft = svc.saveAssignment(teacher, { classId: c.id, title: '模拟问题', instructions: '仅测试',
    questions: [{ id: 'q1', prompt: '模拟材料', maxLength: 200 }], deadlineAt: null, rubricId: withRubric ? rubric.id : null, expectedVersion: 0 });
  return { c, a: svc.transition(teacher, draft.id, 1, 'publish') };
}
const input = (text = '模拟答案', expectedVersion = 0) => ({ answers: [{ questionId: 'q1', text }], expectedVersion });
const rejected = (fn: () => unknown, code: string) => assert.throws(fn, (error: unknown) => (error as { code: string }).code === code);

test('HTTP管理员建班→发布→加入→草稿版本冲突→完整提交→awaiting_rubric；幂等且不伪造报告', async () => {
  assert.equal((await request('/teacher/classes', teacherToken, 'POST', { name: '模拟HTTP班级' })).status,403);
  const admin=await auth.createUser('legacy-http-admin',password,'模拟管理人员','admin');
  const c=new AdminService(service).saveClass(admin,{name:'模拟HTTP班级',teacherId:teacher.id,expectedVersion:0})!;
  const joinCode=store.get<{joinCode:string}>('class',c.id)!.joinCode;
  const joined = await request('/classes/join', studentToken, 'POST', { joinCode });
  assert.equal(joined.status, 200); assert.equal(joined.body.data.joinCode, undefined);
  const draft = await request('/teacher/assignments', teacherToken, 'POST', { classId: c.id, title: '模拟HTTP问题', instructions: '模拟',
    questions: [{ id: 'q1', prompt: '模拟问题', maxLength: 200 }], deadlineAt: null, rubricId: null, expectedVersion: 0 });
  const a = draft.body.data as Assignment;
  assert.equal((await request(`/assignments/${a.id}`, studentToken)).status, 404);
  assert.equal((await request(`/teacher/assignments/${a.id}/publish`, teacherToken, 'POST', { expectedVersion: 1 })).status, 200);
  const empty = await request(`/assignments/${a.id}/my-submission`, studentToken);
  assert.deepEqual(empty.body.data, { submission: null, report: null });
  assert.equal((await request(`/assignments/${a.id}/my-draft`, studentToken, 'PUT', input())).status, 200);
  const conflict = await request(`/assignments/${a.id}/my-draft`, studentToken, 'PUT', input());
  assert.equal(conflict.status, 409); assert.equal(conflict.body.error.details.latestVersion, 1);
  const submitted = await request(`/assignments/${a.id}/submit`, studentToken, 'POST', input('最终模拟答案', 1), 'same-request');
  assert.equal(submitted.status, 200); assert.equal(submitted.body.data.scoringStatus, 'awaiting_rubric');
  assert.equal(store.get('job', submitted.body.data.id), undefined);
  const repeated = await request(`/assignments/${a.id}/submit`, studentToken, 'POST', input('最终模拟答案', 1), 'same-request');
  assert.deepEqual(repeated.body.data, submitted.body.data);
  const different = await request(`/assignments/${a.id}/submit`, studentToken, 'POST', input('篡改', 1), 'same-request');
  assert.equal(different.status, 409); assert.equal(different.body.error.code, 'IDEMPOTENCY_CONFLICT');
  assert.equal((await request(`/assignments/${a.id}/submit`, studentToken, 'POST', input('篡改', 1), 'another-request')).body.error.code, 'ALREADY_SUBMITTED');
  const report = await request(`/submissions/${submitted.body.data.id}/report`, studentToken);
  assert.equal(report.body.data.report, null);
  const list = await request(`/teacher/assignments/${a.id}/submissions`, teacherToken);
  assert.equal(list.body.data.items.length, 1); assert.equal(list.body.data.items[0].answers, undefined);
});

test('HTTP权限：跨用户、跨班级教师、学生调用教师接口均拒绝；分页在权限过滤后执行', async () => {
  const { c, a } = fixture(); service.join(otherStudent, c.joinCode!);
  const sub = service.saveAnswers(student, a.id, input(), 'privacy-test');
  assert.equal((await request(`/submissions/${sub.id}/report`, otherStudentToken)).status, 403);
  assert.equal((await request(`/teacher/submissions/${sub.id}`, otherTeacherToken)).status, 403);
  assert.equal((await request(`/teacher/assignments/${a.id}/export`, otherTeacherToken)).status, 403);
  assert.equal((await request('/teacher/classes', studentToken, 'POST', { name: '越权' })).status, 403);
  const classes = await request('/classes?limit=1', otherTeacherToken);
  assert.deepEqual(classes.body.data.items, []);
  const first = await request('/classes?limit=1', teacherToken);
  assert.equal(first.body.data.items.length, 1); assert.ok(first.body.data.nextCursor);
  const next = await request('/classes?limit=1&cursor=' + first.body.data.nextCursor, teacherToken);
  assert.notEqual(next.body.data.items[0].id, first.body.data.items[0].id);
});

test('截止与输入检查；截止后的成功请求重放仍返回原结果', () => {
  const { a } = fixture();
  rejected(() => service.saveAnswers(student, a.id, { answers: [{ questionId: 'bad', text: 'x' }], expectedVersion: 0 }, 'bad-question'), 'VALIDATION_ERROR');
  rejected(() => service.saveAnswers(student, a.id, input(''), 'empty-answer'), 'VALIDATION_ERROR');
  rejected(() => service.saveAnswers(student, a.id, input('x'.repeat(201)), 'long-answer'), 'VALIDATION_ERROR');
  const original = service.saveAnswers(student, a.id, input(), 'accepted-key');
  service.transition(teacher, a.id, a.version, 'close');
  assert.deepEqual(service.saveAnswers(student, a.id, input(), 'accepted-key'), original);
  rejected(() => service.saveAnswers(student, a.id, input(), 'different-key'), 'ASSIGNMENT_CLOSED');
  const { a: expired } = fixture(); expired.deadlineAt = new Date(time - 1).toISOString(); store.put('assignment', expired.id, expired);
  rejected(() => service.saveAnswers(student, expired.id, input(), 'expired-key'), 'ASSIGNMENT_CLOSED');
});

test('HTTP同时提交同一幂等键仅产生一份答卷和任务；并发草稿保存仅一个成功', async () => {
  const { a } = fixture(service, true);
  const requests = await Promise.all(Array.from({ length: 8 }, () => request(`/assignments/${a.id}/submit`, studentToken, 'POST', input(), 'concurrent-submit')));
  assert.ok(requests.every(r => r.status === 200));
  assert.equal(new Set(requests.map(r => r.body.data.id)).size, 1);
  const sub = requests[0].body.data as Submission;
  assert.equal(store.all<Submission>('submission').filter(s => s.assignmentId === a.id).length, 1);
  assert.equal(store.all<Job>('job').filter(j => j.submissionId === sub.id).length, 1);
  const { a: drafting } = fixture();
  const drafts = await Promise.all(['模拟输入A', '模拟输入B'].map(text => request(`/assignments/${drafting.id}/my-draft`, studentToken, 'PUT', input(text))));
  assert.deepEqual(drafts.map(r => r.status).sort(), [200, 409]);
  assert.equal(service.mySubmission(student, drafting.id).submission?.version, 1);
});

test('模拟规则后绑定原子建任务；模拟初评、复核版本和历史保留', async () => {
  const local = new SqliteStore(':memory:'); const svc = new Service(local, now);
  try {
    const { a } = fixture(svc); local.put('rubric', rubric.id, rubric);
    const sub = svc.saveAnswers(student, a.id, input(), 'bind-rubric');
    svc.bindRubric(teacher, a.id, rubric.id, a.version);
    assert.equal(local.get<Job>('job', sub.id)?.state, 'queued');
    assert.equal(svc.mySubmission(student, a.id).submission?.scoringStatus, 'queued');
    assert.equal(await new Worker(svc, fakeScorer).tick(), true);
    const initial = svc.report(student, sub.id).report!; assert.equal(initial.systemScores?.dimensions[0].score, 5);
    const review = { expectedReportVersion: 1, dimensions: [{ dimensionId: 'synthetic-dimension', score: 8, rationale: '模拟复核' }], feedback: '模拟教师反馈', reason: '测试审阅历史' };
    rejected(() => svc.review(otherTeacher, sub.id, review), 'FORBIDDEN');
    const reviewed = svc.review(teacher, sub.id, review);
    assert.equal(reviewed.systemScores?.dimensions[0].score, 5); assert.equal(reviewed.latestReview?.scores.dimensions[0].score, 8);
    assert.equal(reviewed.reviews.length, 1); assert.equal(reviewed.latestReview?.scores.totalScore, null);
    assert.equal(svc.report(student, sub.id).scoringStatus, 'scored');
    rejected(() => svc.review(teacher, sub.id, review), 'VERSION_CONFLICT');
    const second = svc.review(teacher, sub.id, { ...review, expectedReportVersion: 2 }); assert.equal(second.reviews.length, 2);
  } finally { local.close(); }
});

test('持久评分有限重试、上限与人工重试；异常模型结构不生成报告', async () => {
  const localStore = new SqliteStore(':memory:'); const svc = new Service(localStore, now);
  try {
    const { a } = fixture(svc, true); const sub = svc.saveAnswers(student, a.id, input(), 'retry-test');
    let calls = 0;
    const worker = new Worker(svc, { async score() { calls++; throw new Error('模拟限流'); } });
    for (let i = 0; i < 3; i++) { assert.equal(await worker.tick(), true); time += 10000; }
    assert.equal(calls, 3); assert.equal(svc.report(student, sub.id).scoringStatus, 'failed');
    assert.equal(await worker.tick(), false); assert.equal(calls, 3);
    const failed = svc.mySubmission(student, a.id).submission!;
    svc.retry(teacher, sub.id, failed.version);
    rejected(() => svc.retry(teacher, sub.id, failed.version), 'VERSION_CONFLICT');
    const invalidScorer: Scorer = { async score(...args) { const result = await fakeScorer.score(...args); result.scores.dimensions[0].score = 999; return result; } };
    await new Worker(svc, invalidScorer).tick();
    assert.equal(svc.report(student, sub.id).report, null);
    assert.equal(localStore.get<Job>('job', sub.id)?.attempts, 1);
  } finally { localStore.close(); }
});

test('SQLite事务失败回滚：答卷、幂等记录与任务不出现部分保存', () => {
  const local = new SqliteStore(':memory:');
  let fail = false;
  const adapter: Store = { get: local.get.bind(local), all: local.all.bind(local), remove: local.remove.bind(local), transaction: local.transaction.bind(local),
    put(kind, id, value) { if (fail && kind === 'job') throw new Error('模拟写任务失败'); local.put(kind, id, value); } };
  const svc = new Service(adapter, now);
  try {
    const { a } = fixture(svc, true); fail = true;
    assert.throws(() => svc.saveAnswers(student, a.id, input(), 'atomic-key'));
    assert.equal(svc.mySubmission(student, a.id).submission, null);
    assert.equal(local.all('replay').length, 0); assert.equal(local.all('job').length, 0);
    fail = false; assert.equal(svc.saveAnswers(student, a.id, input(), 'atomic-key').scoringStatus, 'queued');
  } finally { local.close(); }
});

test('本地重启恢复、SQLite在线备份与独立恢复副本；过期租约防止旧worker覆盖', async () => {
  const scratchRoot = resolve('work');
  const { mkdirSync } = await import('node:fs'); mkdirSync(scratchRoot, { recursive: true });
  const directory = mkdtempSync(resolve(scratchRoot, 'synthetic-test-'));
  const path = resolve(directory, 'source.sqlite'); const restoredPath = resolve(directory, 'restored.sqlite');
  let local = new SqliteStore(path); let svc = new Service(local, now);
  const { a } = fixture(svc, true); const sub = svc.saveAnswers(student, a.id, input(), 'restore-key');
  const originalJob = local.get<Job>('job', sub.id)!;
  originalJob.state = 'processing'; originalJob.attempts = 1; originalJob.leaseUntil = time - 1; originalJob.leaseToken = 'abandoned-worker';
  local.put('job', sub.id, originalJob); local.close();
  local = new SqliteStore(path); svc = new Service(local, now);
  try {
    assert.equal(await new Worker(svc, fakeScorer).tick(), true);
    assert.equal(svc.report(student, sub.id).scoringStatus, 'needs_review');
    assert.equal(local.all('submission').length, 1); assert.equal(local.all('job').length, 1);
    await local.backupTo(restoredPath);
    const restored = new SqliteStore(restoredPath);
    try {
      assert.deepEqual(restored.get('submission', sub.id), local.get('submission', sub.id));
      assert.deepEqual(restored.get('report', sub.id), local.get('report', sub.id));
      assert.equal(restored.db.prepare('PRAGMA integrity_check').get()?.integrity_check, 'ok');
    } finally { restored.close(); }
    const { a: pending } = fixture(svc, true); const pendingSub = svc.saveAnswers(student, pending.id, input(), 'fencing-key');
    let release: () => void = () => {};
    const delayed: Scorer = { async score(...args) { await new Promise<void>(done => { release = done; }); return fakeScorer.score(...args); } };
    const oldWork = new Worker(svc, delayed).tick(); time += 31000;
    assert.equal(await new Worker(svc, fakeScorer).tick(), true);
    const reportId = svc.report(student, pendingSub.id).report!.id;
    release(); await oldWork; assert.equal(svc.report(student, pendingSub.id).report?.id, reportId);
  } finally { local.close(); }
});

test('CSV公式注入、错误JSON、未知路由与请求标识', async () => {
  const { a } = fixture(); service.saveAnswers(student, a.id, input('=SUM(1,2)\n"模拟"'), 'csv-test');
  const csvResponse = await fetch(base + `/teacher/assignments/${a.id}/export`, { headers: { Authorization: `Bearer ${teacherToken}` } });
  assert.equal(csvResponse.status, 200); const csv = await csvResponse.text();
  assert.ok(csv.includes('"\'=测试学生"')); assert.ok(csv.includes('""questionId""')); assert.ok(csv.includes('\r\n'));
  const malformed = await fetch(base + '/classes/join', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${studentToken}` }, body: '{' });
  assert.equal(malformed.status, 400); assert.ok((await malformed.json()).requestId);
  assert.equal((await request('/unknown', teacherToken)).status, 404);
  assert.equal((await request('/classes')).status, 401);
});

test('会话注销/过期、未配置生产和云适配均明确拒绝', async () => {
  const session = await auth.login({ username: 'test-student', password });
  assert.equal((await request('/auth/logout', session.accessToken, 'POST')).status, 200);
  assert.equal((await request('/auth/me', session.accessToken)).status, 401);
  const expiring = await auth.login({ username: 'test-student', password }); time += 9 * 60 * 60 * 1000;
  const expired = await request('/auth/me', expiring.accessToken); assert.equal(expired.body.error.code, 'SESSION_EXPIRED');
  const original = process.env.NODE_ENV; process.env.NODE_ENV = 'production';
  try { rejected(() => config(), 'PRODUCTION_UNCONFIGURED'); }
  finally { if (original === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = original; }
  const storageMode = process.env.STORAGE_MODE; process.env.STORAGE_MODE = 'cloudbase';
  try { rejected(() => config(), 'STORAGE_UNCONFIGURED'); }
  finally { if (storageMode === undefined) delete process.env.STORAGE_MODE; else process.env.STORAGE_MODE = storageMode; }
});
