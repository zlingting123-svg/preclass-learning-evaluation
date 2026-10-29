import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, existsSync, writeFileSync, symlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import type { User } from '../../shared/contracts.js';
import { SqliteStore, type Store } from '../src/store.js';
import { LocalAuth, type AuthProvider } from '../src/auth.js';
import { createCohort, type CohortRecord } from '../src/cohorts.js';
import { Service } from '../src/service.js';
import { RosterImporter, type StudentIdentity, type RosterPlan } from '../src/roster.js';
import { createApp } from '../src/app.js';

function fixture(adapter?: (store: SqliteStore) => Store) {
  mkdirSync('work', { recursive: true }); const directory = mkdtempSync(resolve('work', 'synthetic-roster-'));
  const sql = new SqliteStore(':memory:'); const store = adapter ? adapter(sql) : sql;
  const users = ['admin', 'teacher', 'teacher', 'admin'].map((role, i): User => ({ id: randomUUID(), role: role as User['role'], displayName: `模拟角色${i}` }));
  for (const u of users) store.put('user', u.id, u);
  const [admin, teacherA, teacherB, otherAdmin] = users;
  const cohort = createCohort(store, admin, { name: '模拟秋季批次', courseName: '模拟课程，非真实教学设置', startsOn: '2026-11-01', endsOn: '2027-01-31',
    teacherIds: [teacherA.id, teacherB.id], plannedStudentCount: 500, plannedTeacherCount: 7, assignmentsPerStudent: 4 });
  const service = new Service(store); const auth = new LocalAuth(store);
  const a = service.createClass(teacherA, '模拟A班', cohort.id); const b = service.createClass(teacherB, '模拟B班', cohort.id);
  const privateRoot = resolve(directory, 'private-data'); const importer = new RosterImporter(store, auth, privateRoot);
  return { sql, store, admin, teacherA, teacherB, otherAdmin, cohort, a, b, service, auth, privateRoot, importer, directory };
}
const rejected = (fn: () => unknown, code: string) => assert.throws(fn, (error: unknown) => (error as { code: string }).code === code);
const asyncRejected = (fn: () => Promise<unknown>, code: string) => assert.rejects(fn, (error: unknown) => (error as { code: string }).code === code);
const csv = '学号,姓名\r\n0000123,模拟学生甲\r\n0000124,"模拟,学生乙"\r\n';

test('批次跨年、教师授权和计划量仅为显式配置，不自动生成7班或500账号', () => {
  const f = fixture();
  try {
    assert.equal(f.cohort.endsOn, '2027-01-31'); assert.equal(f.cohort.plannedTeacherCount, 7); assert.equal(f.cohort.teacherCount, 2);
    assert.equal(f.sql.all('account').length, 0); assert.equal(f.sql.all('class').length, 2);
    rejected(() => createCohort(f.store, f.teacherA, {}), 'FORBIDDEN');
    assert.throws(() => createCohort(f.store, f.admin, { name: '模拟', courseName: '模拟', startsOn: '2026-02-30', endsOn: '2026-03-01', teacherIds: [f.teacherA.id] }));
    assert.throws(() => createCohort(f.store, f.admin, { name: '模拟', courseName: '模拟', startsOn: '2027-01-31', endsOn: '2026-11-01', teacherIds: [f.teacherA.id] }));
    const unassigned: User = { id: randomUUID(), displayName: '未授权模拟教师', role: 'teacher' }; f.store.put('user', unassigned.id, unassigned);
    rejected(() => f.service.createClass(unassigned, '越权模拟班', f.cohort.id), 'COHORT_FORBIDDEN');
    assert.deepEqual(f.service.cohorts(unassigned), []);
  } finally { f.sql.close(); }
});

test('CSV预览使用成熟解析器，保留前导零与引号逗号；预览不创建账号或选课', () => {
  const f = fixture();
  try {
    const plan = f.importer.preview(f.admin, f.a.id, '\uFEFF' + csv);
    assert.equal(plan.rows[0].studentNumber, '0000123'); assert.equal(plan.rows[1].displayName, '模拟,学生乙');
    assert.equal(plan.counts.newAccounts, 2); assert.equal(f.sql.all('account').length, 0); assert.equal(f.sql.all('member').length, 0);
    rejected(() => f.importer.preview(f.teacherA, f.a.id, csv), 'FORBIDDEN');
    rejected(() => f.importer.preview(f.admin, f.a.id, '学号,姓名,role\n000123,模拟,teacher'), 'INVALID_CSV');
    rejected(() => f.importer.preview(f.admin, f.a.id, '学号,学号\n000123,000123'), 'INVALID_CSV');
    rejected(() => f.importer.preview(f.admin, f.a.id, '学号,姓名\n"bad'), 'INVALID_CSV');
  } finally { f.sql.close(); }
});

test('确认导入原子创建账号/身份/选课，随机口令仅在私密文件，重复确认不重复创建', async () => {
  const f = fixture();
  try {
    const plan = f.importer.preview(f.admin, f.a.id, csv); const file = resolve(f.privateRoot, 'credentials.json');
    const receipt = await f.importer.commit(f.admin, plan.id, plan.hash, file);
    assert.equal(receipt.newEnrollments, 2); assert.equal(f.sql.all('account').length, 2); assert.equal(f.sql.all('member').length, 2);
    const credentials = JSON.parse(readFileSync(file, 'utf8')).accounts as Array<{ username: string; password: string }>;
    assert.equal(new Set(credentials.map(c => c.password)).size, 2);
    const credential = credentials.find(c => c.username === '0000123')!;
    const session = await f.auth.login({ username: credential.username, password: credential.password }); assert.equal(session.user.role, 'student'); assert.notEqual(session.user.id, '0000123');
    assert.ok(JSON.stringify(f.sql.all('account')).includes('$2')); assert.equal(JSON.stringify(f.sql.all('account')).includes(credential.password), false);
    assert.equal(f.service.classes(session.user)[0].cohortId, f.cohort.id);
    const again = await f.importer.commit(f.admin, plan.id, plan.hash, resolve(f.privateRoot, 'another.json'));
    assert.deepEqual(again, receipt); assert.equal(existsSync(resolve(f.privateRoot, 'another.json')), false);
    assert.equal(f.sql.all('account').length, 2); assert.equal(f.sql.all('roster_receipt').length, 1);
  } finally { f.sql.close(); }
});

test('同学号跨春秋批次复用账号、不改口令、不移动旧班；教师仍只看自己班', async () => {
  const f = fixture();
  try {
    const plan = f.importer.preview(f.admin, f.a.id, csv); const initial = resolve(f.privateRoot, 'initial.json');
    await f.importer.commit(f.admin, plan.id, plan.hash, initial);
    const credentials = JSON.parse(readFileSync(initial, 'utf8')).accounts;
    const loginInput = { username: credentials[0].username, password: credentials[0].password };
    const student = (await f.auth.login(loginInput)).user;
    const spring = createCohort(f.store, f.admin, { name: '模拟春季', courseName: '模拟课程', startsOn: '2027-02-01', endsOn: '2027-05-31', teacherIds: [f.teacherB.id] });
    const springClass = f.service.createClass(f.teacherB, '模拟春季班', spring.id);
    const second = f.importer.preview(f.admin, springClass.id, csv); assert.equal(second.counts.existingAccounts, 2);
    const existingFile = resolve(f.privateRoot, 'existing.json'); await f.importer.commit(f.admin, second.id, second.hash, existingFile);
    assert.equal(JSON.parse(readFileSync(existingFile, 'utf8')).accounts.length, 0);
    assert.equal((await f.auth.login(loginInput)).user.id, student.id); assert.equal(f.sql.all('account').length, 2);
    assert.equal(f.service.classes(student).length, 2); assert.equal(f.service.cohorts(student).length, 2);
    assert.equal(f.service.classes(f.teacherA, spring.id).length, 0);
    rejected(() => f.service.classAccess(f.teacherA, springClass.id), 'FORBIDDEN');
    const repeat = f.importer.preview(f.admin, f.a.id, csv); assert.equal(repeat.counts.alreadyEnrolled, 2);
  } finally { f.sql.close(); }
});

test('重复/科学计数/身份冲突整批拒绝，不静默覆盖；500行仅解析预览不创建500账号', async () => {
  const f = fixture();
  try {
    const bad = f.importer.preview(f.admin, f.a.id, '学号,姓名\n000123,模拟甲\n000123,模拟乙\n1E10,模拟丙');
    assert.equal(bad.counts.invalid, 3); await asyncRejected(() => f.importer.commit(f.admin, bad.id, bad.hash, resolve(f.privateRoot, 'bad.json')), 'IMPORT_HAS_ERRORS');
    await f.auth.createUser('0000999', randomUUID(), '模拟同名账号', 'teacher');
    const conflict = f.importer.preview(f.admin, f.a.id, '学号,姓名\n0000999,模拟同名账号\n0000888,模拟新用户');
    assert.equal(conflict.counts.conflicts, 1); await asyncRejected(() => f.importer.commit(f.admin, conflict.id, conflict.hash, resolve(f.privateRoot, 'conflict.json')), 'IMPORT_HAS_ERRORS');
    assert.equal(f.sql.all('account').length, 1); assert.equal(f.sql.all('member').length, 0);
    const batch = 'studentNumber,displayName\n' + Array.from({ length: 500 }, (_, i) => `00${String(i).padStart(5, '0')},模拟学生${i}`).join('\n');
    const plan = f.importer.preview(f.admin, f.a.id, batch); assert.equal(plan.counts.newAccounts, 500); assert.equal(f.sql.all('account').length, 1);
  } finally { f.sql.close(); }
});

test('过期/错误确认指纹/其他管理员/预览后账号变化均拒绝确认', async () => {
  const f = fixture(); let now = Date.now(); const importer = new RosterImporter(f.store, f.auth, f.privateRoot, () => now);
  try {
    const plan = importer.preview(f.admin, f.a.id, csv); const file = resolve(f.privateRoot, 'never.json');
    await asyncRejected(() => importer.commit(f.admin, plan.id, 'wrong', file), 'IMPORT_PLAN_MISMATCH');
    await asyncRejected(() => importer.commit(f.otherAdmin, plan.id, plan.hash, file), 'NOT_FOUND');
    now += 31 * 60 * 1000; await asyncRejected(() => importer.commit(f.admin, plan.id, plan.hash, file), 'IMPORT_PLAN_EXPIRED');
    const current = importer.preview(f.admin, f.a.id, csv);
    await f.auth.createUser('0000123', randomUUID(), '模拟账号', 'student');
    await asyncRejected(() => importer.commit(f.admin, current.id, current.hash, file), 'IMPORT_PLAN_STALE'); assert.equal(existsSync(file), false);
  } finally { f.sql.close(); }
});

test('导入事务故障回滚账号、身份和选课，同时清理本次创建的私密凭据文件', async () => {
  let fail = false;
  const f = fixture(sql => ({ get: sql.get.bind(sql), all: sql.all.bind(sql), remove: sql.remove.bind(sql), transaction: sql.transaction.bind(sql),
    put(kind, id, value) { if (fail && kind === 'member') throw new Error('模拟选课持久化故障'); sql.put(kind, id, value); } }));
  try {
    const plan = f.importer.preview(f.admin, f.a.id, csv); const file = resolve(f.privateRoot, 'rollback.json'); fail = true;
    await assert.rejects(() => f.importer.commit(f.admin, plan.id, plan.hash, file));
    assert.equal(f.sql.all('account').length, 0); assert.equal(f.sql.all('student_identity').length, 0); assert.equal(f.sql.all('member').length, 0);
    assert.equal(f.store.get<RosterPlan>('roster_plan', plan.id)?.state, 'preview'); assert.equal(existsSync(file), false);
    fail = false; await f.importer.commit(f.admin, plan.id, plan.hash, file); assert.equal(f.sql.all('account').length, 2);
  } finally { f.sql.close(); }
});

test('私密输出拒绝公开目录、现有文件与目录联接点；旧文件不覆盖', async () => {
  const f = fixture();
  try {
    const plan = f.importer.preview(f.admin, f.a.id, csv);
    await asyncRejected(() => f.importer.commit(f.admin, plan.id, plan.hash, resolve(f.directory, 'public.json')), 'PRIVATE_PATH_REQUIRED');
    mkdirSync(f.privateRoot, { recursive: true }); const existing = resolve(f.privateRoot, 'existing.json'); writeFileSync(existing, 'preserve original');
    await assert.rejects(() => f.importer.commit(f.admin, plan.id, plan.hash, existing)); assert.equal(readFileSync(existing, 'utf8'), 'preserve original');
    assert.equal(f.sql.all('account').length, 0);
    const external = resolve(f.directory, 'outside'); mkdirSync(external);
    symlinkSync(external, resolve(f.privateRoot, 'junction'), process.platform === 'win32' ? 'junction' : 'dir');
    await asyncRejected(() => f.importer.commit(f.admin, plan.id, plan.hash, resolve(f.privateRoot, 'junction/leak.json')), 'PRIVATE_PATH_REQUIRED');
    assert.equal(existsSync(resolve(external, 'leak.json')), false);
  } finally { f.sql.close(); }
});

test('HTTP批次响应不下发教师ID名单；撤销批次授权后旧班级不可访问', async () => {
  const f = fixture();
  const auth: AuthProvider = { async login() { throw new Error('unused'); }, authenticate(token) { return f.store.get<User>('user', token)!; }, logout() {} };
  const server = createApp(f.service, auth).listen(0, '127.0.0.1'); await once(server, 'listening');
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1`;
  const get = (path: string, user: User) => fetch(base + path, { headers: { Authorization: `Bearer ${user.id}` } });
  try {
    const result = await (await get('/cohorts', f.teacherA)).json(); assert.equal(result.data.items[0].teacherIds, undefined); assert.equal(result.data.items[0].teacherCount, 2);
    assert.equal((await get('/classes?cohortId=' + f.cohort.id, f.teacherA)).status, 200);
    const unassigned: User = { id: randomUUID(), displayName: '模拟未授权教师', role: 'teacher' }; f.store.put('user', unassigned.id, unassigned);
    assert.equal((await get('/cohorts/' + f.cohort.id, unassigned)).status, 404);
    const cohort = f.store.get<CohortRecord>('cohort', f.cohort.id)!; cohort.teacherIds = [f.teacherB.id]; f.store.put('cohort', cohort.id, cohort);
    assert.deepEqual(f.service.classes(f.teacherA), []); rejected(() => f.service.classAccess(f.teacherA, f.a.id), 'FORBIDDEN');
    assert.equal(f.sql.all<StudentIdentity>('student_identity').length, 0);
  } finally { await new Promise<void>(done => server.close(() => done())); f.sql.close(); }
});
