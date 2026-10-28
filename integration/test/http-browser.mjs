import { createRequire } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { mkdirSync, mkdtempSync, existsSync, writeFileSync, readFileSync } from 'node:fs';
import { randomUUID, createHash } from 'node:crypto';
import { once } from 'node:events';
import assert from 'node:assert/strict';

const project = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const frontend = resolve(project, 'frontend');
const requireFront = createRequire(resolve(frontend, 'package.json'));
const { chromium } = requireFront('playwright-core');
const { createServer: createVite } = await import(pathToFileURL(requireFront.resolve('vite')));
const backendModule = name => import(pathToFileURL(resolve(project, `backend/dist/backend/src/${name}.js`)));
const [{ SqliteStore }, { LocalAuth }, { Service }, { createApp }, { Worker }] = await Promise.all(
  ['store', 'auth', 'service', 'app', 'worker'].map(backendModule));
const work = resolve(project, 'backend/work'); mkdirSync(work, { recursive: true });
const runDirectory = mkdtempSync(resolve(work, 'synthetic-browser-'));
const verification = resolve(project, 'integration/verification'); mkdirSync(verification, { recursive: true });
const screenshots = resolve(runDirectory, 'screenshots'); mkdirSync(screenshots);
const dbPath = resolve(runDirectory, 'synthetic.sqlite');
const store = new SqliteStore(dbPath);
const service = new Service(store);
const auth = new LocalAuth(store);
const password = randomUUID();
const teacher = await auth.createUser('synthetic-teacher', password, '集成测试教师（模拟）', 'teacher');
const student = await auth.createUser('synthetic-student', password, '=集成测试学生（模拟）', 'student');
const outsider = await auth.createUser('synthetic-outsider', password, '其他教师（模拟）', 'teacher');
let server, vite, browser;
const results = [], pageErrors = [], unexpectedHttp = [];
const expectedFailures = new Set([400, 401, 403, 409, 503]);
const fixtureNames = { className: 'HTTP集成测试班级（模拟）', title: 'HTTP集成测试作业（模拟）', prompt: '请输入模拟测试材料，仅用于软件验证。' };
let assignmentId, classInfo, submissionId;
const sessions = new Map();
const userNameFor = user => user.id === teacher.id ? 'synthetic-teacher' : user.id === student.id ? 'synthetic-student' : 'synthetic-outsider';

async function check(name, run) {
  process.stdout.write(`RUN ${name}\n`);
  try { await run(); results.push({ name, result: 'pass' }); process.stdout.write(`PASS ${name}\n`); }
  catch (error) { results.push({ name, result: 'fail', message: error.message }); process.stdout.write(`FAIL ${name}: ${error.stack ?? error}\n`); throw error; }
}
async function visible(locator) { await locator.waitFor({ state: 'visible', timeout: 15000 }); }
async function login(page, user) {
  await page.goto('http://127.0.0.1:5173/login');
  await page.getByLabel('用户名', { exact: true }).fill(userNameFor(user));
  await page.getByLabel('密码', { exact: true }).fill(password);
  const responsePromise = page.waitForResponse(r => r.url().endsWith('/auth/login') && r.request().method() === 'POST');
  await page.getByRole('button', { name: '登录', exact: true }).click();
  const response = await responsePromise; const payload = await response.json(); assert.equal(payload.ok, true);
  sessions.set(user.id, payload.data);
  await page.waitForURL(user.role === 'student' ? '**/student/assignments' : '**/teacher/overview');
  await visible(page.getByRole('heading', { name: user.role === 'student' ? '我的任务' : '班级概览', exact: true }));
}
async function navigate(page, path) {
  await page.evaluate(path => { history.pushState({}, '', path); dispatchEvent(new PopStateEvent('popstate')); }, path);
}
async function frontApi(page, method, ...args) {
  return page.evaluate(async ({ method, args }) => {
    const { api } = await import('/src/services/api.ts');
    try { return { ok: true, data: await api[method](...args) }; }
    catch (error) { return { ok: false, code: error.code, status: error.status, requestId: error.requestId }; }
  }, { method, args });
}
function fixtureAssignment(title, rubricId = null) {
  const a = service.saveAssignment(teacher, { classId: classInfo.id, title, instructions: '仅软件测试',
    questions: [{ id: randomUUID(), prompt: fixtureNames.prompt, maxLength: 500 }], deadlineAt: null, rubricId, expectedVersion: 0 });
  return service.transition(teacher, a.id, a.version, 'publish');
}
async function openAnswer(page, assignment) {
  await navigate(page, `/student/assignments/${assignment.id}`);
  await visible(page.getByRole('heading', { name: assignment.title, exact: true }));
  await visible(page.locator('textarea').first());
}
async function waitDraft(page) { await visible(page.getByText(/^草稿已保存 /)); }

try {
  server = createApp(service, auth).listen(3001, '127.0.0.1'); await once(server, 'listening');
  process.env.VITE_API_MODE = 'http';
  process.env.VITE_DEV_PROXY_TARGET = 'http://127.0.0.1:3001';
  vite = await createVite({ root: frontend, configFile: resolve(frontend, 'vite.config.ts'), mode: 'development', logLevel: 'error' });
  await vite.listen();
  const executablePath = process.env.BROWSER_PATH || [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  ].find(existsSync);
  assert.ok(executablePath, '请通过BROWSER_PATH指定本机Chrome/Edge，不自动下载浏览器');
  browser = await chromium.launch({ executablePath, headless: true });
  const contexts = await Promise.all([0, 1, 2].map(() => browser.newContext({ viewport: { width: 1280, height: 900 }, permissions: ['clipboard-read', 'clipboard-write'] })));
  const [teacherPage, studentPage, outsiderPage] = await Promise.all(contexts.map(context => context.newPage()));
  for (const page of [teacherPage, studentPage, outsiderPage]) {
    page.on('pageerror', error => pageErrors.push(error.message));
    page.on('response', response => {
      if (response.status() >= 400 && !expectedFailures.has(response.status())) unexpectedHttp.push({ status: response.status(), path: new URL(response.url()).pathname });
    });
  }
  await check('HTTP登录及真实后端诊断；无演示账号或横幅', async () => {
    await login(teacherPage, teacher); await login(studentPage, student); await login(outsiderPage, outsider);
    const health = await (await fetch('http://127.0.0.1:5173/api/v1/health')).json();
    assert.equal(health.data.storage, 'local-sqlite'); assert.equal(health.data.productionReady, false);
    assert.equal(await teacherPage.getByText('演示数据 / 尚未连接后台', { exact: true }).count(), 0);
    assert.equal(await studentPage.getByRole('heading', { name: '演示账号（仅演示模式）' }).count(), 0);
  });
  await check('教师页面建班、显示及复制加入码；学生页面加入', async () => {
    await teacherPage.getByLabel('班级名称').fill(fixtureNames.className);
    await teacherPage.getByRole('button', { name: '创建', exact: true }).click();
    await visible(teacherPage.getByRole('link', { name: fixtureNames.className, exact: true }));
    const code = await teacherPage.getByTestId('join-code').innerText();
    classInfo = service.classes(teacher).find(c => c.name === fixtureNames.className); assert.equal(code, classInfo.joinCode);
    await teacherPage.getByRole('button', { name: '复制加入码', exact: true }).click();
    assert.equal(await teacherPage.evaluate(() => navigator.clipboard.readText()), code);
    await studentPage.getByPlaceholder('输入教师提供的班级加入码').fill(code);
    await studentPage.getByRole('button', { name: '加入', exact: true }).click();
    await studentPage.getByRole('option', { name: fixtureNames.className, exact: true }).waitFor({ state: 'attached' });
    assert.equal(await studentPage.getByLabel('班级', { exact: true }).inputValue(), classInfo.id);
    assert.equal((await frontApi(studentPage, 'listClasses')).data.items[0].joinCode, undefined);
  });
  await check('教师页面创建草稿并发布；独立学生会话读取题目', async () => {
    await teacherPage.getByRole('link', { name: fixtureNames.className, exact: true }).click();
    await teacherPage.getByRole('link', { name: '新建作业', exact: true }).click();
    await teacherPage.getByLabel('作业标题', { exact: true }).fill(fixtureNames.title);
    await teacherPage.getByLabel('题目 1 内容', { exact: true }).fill(fixtureNames.prompt);
    await teacherPage.getByRole('button', { name: '创建草稿', exact: true }).click();
    await teacherPage.waitForURL(/\/teacher\/assignments\/[^/]+\/edit$/);
    assignmentId = teacherPage.url().split('/').at(-2);
    await visible(teacherPage.getByRole('heading', { name: '编辑作业', exact: true }));
    await teacherPage.getByRole('button', { name: '发布作业', exact: true }).click();
    await visible(teacherPage.getByText('已发布', { exact: true }).first());
    await studentPage.getByRole('link', { name: '我的任务', exact: true }).click();
    await studentPage.getByRole('button', { name: '刷新任务', exact: true }).click();
    await visible(studentPage.getByRole('link', { name: fixtureNames.title, exact: true }));
    await studentPage.getByRole('link', { name: fixtureNames.title, exact: true }).click();
    await visible(studentPage.locator('textarea').first());
  });
  await check('真实草稿持久保存，离开再进入仍可读', async () => {
    await studentPage.locator('textarea').first().fill('模拟草稿：持久保存验证');
    await studentPage.getByRole('button', { name: '保存草稿', exact: true }).click(); await waitDraft(studentPage);
    assert.equal(service.mySubmission(student, assignmentId).submission.answers[0].text, '模拟草稿：持久保存验证');
    await studentPage.getByRole('link', { name: '我的任务', exact: true }).click();
    await studentPage.getByRole('link', { name: fixtureNames.title, exact: true }).click();
    assert.equal(await studentPage.locator('textarea').first().inputValue(), '模拟草稿：持久保存验证');
  });
  await check('提交成功只在数据库确认后显示待配置评价体系；无假分数', async () => {
    await studentPage.locator('textarea').first().fill('模拟最终答案：未经自动评分');
    await studentPage.getByRole('button', { name: '提交', exact: true }).click();
    await studentPage.waitForURL('**/student/report/*');
    submissionId = studentPage.url().split('/').at(-1);
    await visible(studentPage.getByText(/评价体系待配置/));
    assert.equal(service.report(student, submissionId).report, null);
    assert.equal(service.mySubmission(student, assignmentId).submission.state, 'submitted');
    assert.equal(await studentPage.getByRole('heading', { name: '系统初评', exact: true }).count(), 0);
  });
  await check('教师查询答卷原文、完成情况和真实CSV下载', async () => {
    await navigate(teacherPage, `/teacher/assignments/${assignmentId}/submissions`);
    await visible(teacherPage.getByText('已提交：1', { exact: true }));
    const downloadEvent = teacherPage.waitForEvent('download');
    await teacherPage.getByRole('button', { name: '导出 CSV', exact: true }).click();
    const download = await downloadEvent; const path = resolve(runDirectory, 'synthetic.csv'); await download.saveAs(path);
    const csv = readFileSync(path, 'utf8'); assert.ok(csv.startsWith('\uFEFF')); assert.ok(csv.includes("'=集成测试学生（模拟）")); assert.ok(csv.includes('模拟最终答案'));
    await teacherPage.getByRole('link', { name: student.displayName, exact: true }).click();
    await visible(teacherPage.getByText('模拟最终答案：未经自动评分', { exact: true }));
  });
  await check('跨教师/跨学生越权拒绝；403不回退mock', async () => {
    const forbidden = await frontApi(outsiderPage, 'getSubmissionDetail', submissionId);
    assert.equal(forbidden.status, 403); assert.equal(forbidden.code, 'FORBIDDEN'); assert.ok(forbidden.requestId);
    const foreignUser = { id: randomUUID(), role: 'student', displayName: '其他模拟学生' }; service.join(foreignUser, classInfo.joinCode);
    assert.throws(() => service.report(foreignUser, submissionId), error => error.code === 'FORBIDDEN');
  });
  await check('成功响应丢失后重试原幂等请求，仅一份答卷', async () => {
    const a = fixtureAssignment('提交响应丢失测试（模拟）'); await openAnswer(studentPage, a);
    await studentPage.locator('textarea').fill('模拟答案：结果丢失后不改变请求');
    let firstBody, firstKey, secondBody, secondKey;
    await studentPage.route(`**/api/v1/assignments/${a.id}/submit`, async route => {
      firstBody = route.request().postDataJSON(); firstKey = route.request().headers()['idempotency-key'];
      const response = await route.fetch(); assert.equal(response.status(), 200); await route.abort('failed');
    }, { times: 1 });
    await studentPage.getByRole('button', { name: '提交', exact: true }).click();
    await visible(studentPage.getByRole('button', { name: '重试原提交', exact: true }));
    assert.equal(await studentPage.locator('textarea').isDisabled(), true);
    studentPage.once('request', request => { if (request.url().endsWith('/submit')) { secondBody = request.postDataJSON(); secondKey = request.headers()['idempotency-key']; } });
    const requestPromise = studentPage.waitForRequest(r => r.url().endsWith(`/assignments/${a.id}/submit`));
    await studentPage.getByRole('button', { name: '重试原提交', exact: true }).click();
    const replayRequest = await requestPromise; secondBody = replayRequest.postDataJSON(); secondKey = replayRequest.headers()['idempotency-key'];
    await studentPage.waitForURL('**/student/report/*');
    assert.deepEqual(secondBody, firstBody); assert.equal(secondKey, firstKey);
    assert.equal(store.all('submission').filter(s => s.assignmentId === a.id).length, 1);
  });
  await check('草稿在途继续输入后提交，最终内容完整保存', async () => {
    const a = fixtureAssignment('保存与提交交错测试（模拟）'); await openAnswer(studentPage, a);
    let started; const inFlight = new Promise(done => { started = done; });
    await studentPage.route(`**/api/v1/assignments/${a.id}/my-draft`, async route => {
      started(); await new Promise(done => setTimeout(done, 400)); await route.continue();
    }, { times: 1 });
    await studentPage.locator('textarea').fill('模拟较早草稿');
    await studentPage.getByRole('button', { name: '保存草稿', exact: true }).click(); await inFlight;
    await studentPage.locator('textarea').fill('模拟较新内容，必须进入正式答卷');
    await studentPage.getByRole('button', { name: '提交', exact: true }).click(); await studentPage.waitForURL('**/student/report/*');
    assert.equal(service.mySubmission(student, a.id).submission.answers[0].text, '模拟较新内容，必须进入正式答卷');
  });
  await check('版本冲突保留本页输入；显式加载服务器草稿后可继续', async () => {
    const a = fixtureAssignment('多设备版本冲突测试（模拟）'); await openAnswer(studentPage, a);
    service.saveAnswers(student, a.id, { answers: [{ questionId: a.questions[0].id, text: '服务器其他设备模拟草稿' }], expectedVersion: 0 });
    await studentPage.locator('textarea').fill('本页未保存模拟输入');
    await studentPage.getByRole('button', { name: '保存草稿', exact: true }).click();
    await visible(studentPage.getByRole('button', { name: '加载服务器草稿（替换本页内容）', exact: true }));
    assert.equal(await studentPage.locator('textarea').inputValue(), '本页未保存模拟输入');
    assert.equal(service.mySubmission(student, a.id).submission.answers[0].text, '服务器其他设备模拟草稿');
    await studentPage.getByRole('button', { name: '加载服务器草稿（替换本页内容）', exact: true }).click();
    await studentPage.waitForFunction(() => document.querySelector('textarea')?.value === '服务器其他设备模拟草稿');
  });
  await check('会话过期后重新登录返回答题页，保留同用户未提交输入', async () => {
    const a = fixtureAssignment('会话过期输入保留测试（模拟）'); await openAnswer(studentPage, a);
    await studentPage.locator('textarea').fill('过期前本页模拟输入');
    const token = sessions.get(student.id).accessToken;
    store.remove('session', createHash('sha256').update(token).digest('hex'));
    await studentPage.getByRole('button', { name: '保存草稿', exact: true }).click();
    await studentPage.waitForURL('**/login'); await visible(studentPage.getByText('会话已过期，请重新登录。', { exact: true }));
    await studentPage.getByLabel('用户名', { exact: true }).fill('synthetic-student'); await studentPage.getByLabel('密码', { exact: true }).fill(password);
    await studentPage.getByRole('button', { name: '登录', exact: true }).click();
    await studentPage.waitForURL(`**/student/assignments/${a.id}`);
    await visible(studentPage.locator('textarea'));
    assert.equal(await studentPage.locator('textarea').inputValue(), '过期前本页模拟输入');
  });
  await check('绑定测试规则、真实持久任务与评分替身；浏览器复核保留原分及历史', async () => {
    const rubric = { id: 'synthetic-browser-rubric', name: '模拟规则，仅软件验证', version: 'test-1', aggregationDescription: '未配置总分',
      dimensions: [{ id: 'synthetic-dimension', name: '模拟维度', description: '非教学标准', maxScore: 10 }] };
    store.put('rubric', rubric.id, rubric);
    await navigate(teacherPage, `/teacher/assignments/${assignmentId}/edit`);
    await visible(teacherPage.getByLabel('评价规则', { exact: true }));
    assert.equal(await teacherPage.getByLabel('评价规则', { exact: true }).isEnabled(), true);
    await teacherPage.getByLabel('评价规则', { exact: true }).selectOption(rubric.id);
    await teacherPage.getByRole('button', { name: '绑定评价规则', exact: true }).click(); await visible(teacherPage.getByText('已绑定评价规则', { exact: true }));
    const scorer = { async score() { return { method: 'rule', modelProvider: null, modelVersion: null, needsReview: true,
      scores: { dimensions: [{ dimensionId: 'synthetic-dimension', name: '模拟维度', maxScore: 10, score: 5, rationale: '显式评分替身' }], totalScore: null, totalMaxScore: null, feedback: '模拟反馈' } }; } };
    await new Worker(service, scorer).tick();
    await navigate(teacherPage, `/teacher/submissions/${submissionId}`);
    await visible(teacherPage.getByRole('heading', { name: '人工复核', exact: true }));
    await teacherPage.getByLabel('模拟维度（满分 10）', { exact: true }).fill('8');
    await teacherPage.getByRole('button', { name: '保存复核', exact: true }).click();
    await visible(teacherPage.getByText('请填写复核理由', { exact: true }));
    await teacherPage.getByLabel('复核理由（说明为何调整）', { exact: true }).fill('模拟教师调整理由');
    await teacherPage.getByRole('button', { name: '保存复核', exact: true }).click();
    await visible(teacherPage.getByRole('heading', { name: '教师复核（已复核）', exact: true }));
    const report = service.report(student, submissionId).report; assert.equal(report.systemScores.dimensions[0].score, 5); assert.equal(report.latestReview.scores.dimensions[0].score, 8);
    await teacherPage.getByLabel('复核理由（说明为何调整）', { exact: true }).fill('第二次模拟调整理由');
    await teacherPage.getByRole('button', { name: '保存复核', exact: true }).click();
    await visible(teacherPage.getByRole('heading', { name: '复核历史', exact: true }));
    assert.equal(service.report(student, submissionId).report.reviews.length, 2);
  });
  await check('超过20条答卷的真实分页可到达下一页', async () => {
    const a = fixtureAssignment('答卷分页测试（模拟）');
    for (let i = 0; i < 21; i++) {
      const u = { id: randomUUID(), role: 'student', displayName: `分页模拟学生${i}` }; service.join(u, classInfo.joinCode);
      service.saveAnswers(u, a.id, { answers: [{ questionId: a.questions[0].id, text: '模拟分页材料' }], expectedVersion: 0 }, `pagination-${i}`);
    }
    await navigate(teacherPage, `/teacher/assignments/${a.id}/submissions`);
    await visible(teacherPage.getByRole('heading', { name: a.title, exact: true }));
    assert.equal(await teacherPage.locator('ul.list > li').count(), 20);
    await teacherPage.evaluate(() => {
      window.__paginationMismatches = [];
      window.__paginationObserver = new MutationObserver(() => {
        if (document.body.textContent.includes('第 2 页') && document.querySelectorAll('ul.list > li').length !== 1) {
          window.__paginationMismatches.push(document.querySelectorAll('ul.list > li').length);
        }
      });
      window.__paginationObserver.observe(document.body, { childList: true, subtree: true, characterData: true });
    });
    let release, started;
    const gate = new Promise(done => { release = done; });
    const inFlight = new Promise(done => { started = done; });
    await teacherPage.route(`**/api/v1/teacher/assignments/${a.id}/submissions?*`, async route => {
      started(); await gate; await route.continue();
    }, { times: 1 });
    try {
      await teacherPage.getByRole('button', { name: '下一页', exact: true }).click(); await inFlight;
      await visible(teacherPage.getByText('加载提交列表…', { exact: true }));
      assert.equal(await teacherPage.locator('ul.list > li').count(), 0);
    } finally { release(); }
    await visible(teacherPage.getByText('第 2 页', { exact: true }));
    assert.equal(await teacherPage.locator('ul.list > li').count(), 1);
    const mismatches = await teacherPage.evaluate(() => { window.__paginationObserver.disconnect(); return window.__paginationMismatches; });
    assert.deepEqual(mismatches, [], '新页码不得短暂配上旧页答卷');
  });
  await check('后端不可用时明确失败，禁止回退模拟成功', async () => {
    await studentPage.route('**/api/v1/classes*', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ ok: false, error: { code: 'SERVICE_UNAVAILABLE', message: '模拟故障注入：接口不可用' }, requestId: 'synthetic-outage' }) }));
    const response = await frontApi(studentPage, 'listClasses'); assert.equal(response.ok, false); assert.equal(response.status, 503);
    await studentPage.unroute('**/api/v1/classes*');
  });
  let autumn, spring, autumnClass, springClass, autumnAssignment, springAssignment;
  await check('教师仅见授权批次；按批次建班、筛选并兼容历史班级，伪造批次写入被拒绝', async () => {
    const { createCohort } = await backendModule('cohorts');
    const admin = { id: randomUUID(), displayName: '批次配置模拟管理员', role: 'admin' };
    store.put('user', admin.id, admin);
    const makeCohort = (name, teacherId) => createCohort(store, admin, { name, courseName: '模拟课程',
      startsOn: '2026-11-01', endsOn: '2027-01-31', teacherIds: [teacherId] });
    autumn = makeCohort('模拟秋季批次', teacher.id); spring = makeCohort('模拟春季批次', teacher.id);
    const foreign = makeCohort('其他教师私有批次', outsider.id);
    await navigate(teacherPage, '/teacher/overview');
    const createCohortSelect = teacherPage.getByLabel('新班级所属批次', { exact: true });
    await visible(createCohortSelect);
    assert.equal(await createCohortSelect.locator('option', { hasText: foreign.name }).count(), 0);
    await createCohortSelect.selectOption(autumn.id);
    await teacherPage.getByLabel('班级名称', { exact: true }).fill('模拟秋季新班');
    await teacherPage.getByRole('button', { name: '创建', exact: true }).click();
    await visible(teacherPage.getByRole('link', { name: '模拟秋季新班', exact: true }));
    const filtered = await frontApi(teacherPage, 'listClasses', { cohortId: autumn.id });
    assert.equal(filtered.ok, true); assert.equal(filtered.data.items.length, 1);
    autumnClass = filtered.data.items[0]; assert.equal(autumnClass.cohortId, autumn.id);
    springClass = service.createClass(teacher, '模拟春季班', spring.id);
    const denied = await frontApi(teacherPage, 'createClass', { name: '越权批次建班', cohortId: foreign.id });
    assert.equal(denied.ok, false); assert.equal(denied.status, 403);
    await teacherPage.getByLabel('教学批次', { exact: true }).selectOption(autumn.id);
    assert.equal(await teacherPage.getByRole('link', { name: classInfo.name, exact: true }).count(), 0);
    await teacherPage.getByLabel('教学批次', { exact: true }).selectOption('legacy');
    await visible(teacherPage.getByRole('link', { name: classInfo.name, exact: true }));
    assert.equal(await teacherPage.getByRole('link', { name: autumnClass.name, exact: true }).count(), 0);
    service.join(student, autumnClass.joinCode);
    const publish = (c, title) => {
      const a = service.saveAssignment(teacher, { classId: c.id, title, instructions: '仅模拟集成',
        questions: [{ id: randomUUID(), prompt: '模拟题', maxLength: 100 }], deadlineAt: null, rubricId: null, expectedVersion: 0 });
      return service.transition(teacher, a.id, a.version, 'publish');
    };
    autumnAssignment = publish(autumnClass, '仅秋季可见的模拟任务');
    springAssignment = publish(springClass, '仅春季可见的模拟任务');
    await teacherPage.setViewportSize({ width: 320, height: 900 });
    assert.equal(await teacherPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await teacherPage.screenshot({ path: resolve(screenshots, 'teacher-cohorts-320.png'), fullPage: true });
  });
  await check('学生跨期筛选仅展示对应班级任务；空筛选不查询全部作业或残留其他批次', async () => {
    await navigate(studentPage, '/student/assignments');
    const filter = studentPage.getByLabel('教学批次', { exact: true }); await visible(filter);
    assert.equal(await filter.locator('option', { hasText: '其他教师私有批次' }).count(), 0);
    await filter.selectOption(autumn.id);
    await visible(studentPage.getByRole('link', { name: autumnAssignment.title, exact: true }));
    await studentPage.getByPlaceholder('输入教师提供的班级加入码').fill(springClass.joinCode);
    await studentPage.getByRole('button', { name: '加入', exact: true }).click();
    await visible(studentPage.getByRole('link', { name: springAssignment.title, exact: true }));
    assert.equal(await filter.inputValue(), spring.id);
    assert.equal(await studentPage.getByRole('link', { name: autumnAssignment.title, exact: true }).count(), 0);
    // Remove only the synthetic legacy enrollment to exercise an empty filter.
    const member = store.all('member').find(m => m.classId === classInfo.id && m.studentId === student.id);
    store.remove('member', member.id);
    await studentPage.getByRole('button', { name: '刷新任务', exact: true }).click(); await visible(filter);
    const assignmentRequests = [];
    const capture = request => { if (new URL(request.url()).pathname === '/api/v1/assignments') assignmentRequests.push(request.url()); };
    studentPage.on('request', capture);
    try {
      await filter.selectOption('legacy');
      await visible(studentPage.getByText('当前筛选下暂无班级', { exact: true }).last());
      assert.equal(await studentPage.getByRole('link', { name: springAssignment.title, exact: true }).count(), 0);
      assert.equal(await studentPage.getByRole('link', { name: autumnAssignment.title, exact: true }).count(), 0);
      assert.deepEqual(assignmentRequests, []);
    } finally { studentPage.off('request', capture); service.join(student, classInfo.joinCode); }
    await filter.selectOption(autumn.id);
    await visible(studentPage.getByRole('link', { name: autumnAssignment.title, exact: true }));
    await studentPage.setViewportSize({ width: 375, height: 900 });
    assert.equal(await studentPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await studentPage.screenshot({ path: resolve(screenshots, 'student-cohorts-375.png'), fullPage: true });
  });
  await check('批次接口失败明确报错，重试恢复授权列表；不假报空批次成功', async () => {
    await teacherPage.route('**/api/v1/cohorts*', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ ok: false,
      error: { code: 'SERVICE_UNAVAILABLE', message: '模拟批次服务不可用' }, requestId: 'synthetic-cohort-outage' }) }));
    await teacherPage.getByRole('button', { name: '刷新班级与批次', exact: true }).click();
    await visible(teacherPage.getByRole('alert')); assert.equal(await teacherPage.locator('#newClassCohort').count(), 0);
    await teacherPage.unroute('**/api/v1/cohorts*');
    await teacherPage.getByRole('button', { name: '重试', exact: true }).click();
    await visible(teacherPage.getByLabel('新班级所属批次', { exact: true }));
  });
  await check('开发服务器拒绝读取后台数据库、源码与环境文件', async () => {
    for (const path of [dbPath, resolve(project, 'backend/src/store.ts'), resolve(frontend, '.env.production')]) {
      const response = await fetch('http://127.0.0.1:5173/@fs/' + path.replaceAll('\\', '/'));
      assert.equal(response.status, 403, '开发服务器未隔离私有路径');
    }
  });
  await check('320/375/414/768/1280布局无横向溢出（Chrome模拟宽度）', async () => {
    await navigate(teacherPage, '/teacher/overview'); await visible(teacherPage.getByRole('heading', { name: '班级概览', exact: true }));
    await navigate(studentPage, `/student/report/${submissionId}`); await visible(studentPage.getByRole('heading', { name: '我的报告', exact: true }));
    for (const width of [320, 375, 414, 768, 1280]) for (const [name, page] of [['teacher', teacherPage], ['student', studentPage]]) {
      await page.setViewportSize({ width, height: 900 });
      // ECharts handles the resize event asynchronously; inspect the settled layout.
      await page.waitForFunction(() => document.documentElement.scrollWidth <= innerWidth, { }, { timeout: 5000 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${name}@${width}横向溢出`);
      await page.screenshot({ path: resolve(screenshots, `${name}-${width}.png`), fullPage: true });
    }
  });
  await check('导出401同样注销前端会话，跳转登录；旧令牌不可再用', async () => {
    await teacherPage.setViewportSize({ width: 1280, height: 900 });
    await navigate(teacherPage, `/teacher/assignments/${assignmentId}/submissions`); await visible(teacherPage.getByRole('button', { name: '导出 CSV', exact: true }));
    store.remove('session', createHash('sha256').update(sessions.get(teacher.id).accessToken).digest('hex'));
    await teacherPage.getByRole('button', { name: '导出 CSV', exact: true }).click(); await teacherPage.waitForURL('**/login');
    await visible(teacherPage.getByText('会话已过期，请重新登录。', { exact: true }));
  });
  await check('页面无未处理JS错误及非预期HTTP错误', async () => { assert.deepEqual(pageErrors, []); assert.deepEqual(unexpectedHttp, []); });
} catch (error) {
  process.stderr.write(`${error.stack}\n`); process.exitCode = 1;
} finally {
  const evidence = { date: new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai', dateStyle: 'short', timeStyle: 'medium' }).format(new Date()),
    scope: 'local HTTP frontend + SQLite backend; synthetic accounts/material; scorer is a test double, no cloud/model/load-test claims',
    passed: results.filter(r => r.result === 'pass').length, failed: results.filter(r => r.result === 'fail').length,
    results, pageErrors, unexpectedHttp, screenshots: resolve(runDirectory, 'screenshots') };
  const date = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai' }).format(new Date());
  writeFileSync(resolve(verification, `${date}-http-browser.json`), JSON.stringify(evidence, null, 2));
  if (browser) await browser.close();
  if (vite) await vite.close();
  if (server) await new Promise(done => server.close(done));
  store.close();
}
