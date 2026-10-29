// Historical UI regression only; never enabled in production builds.
process.env.VITE_LEGACY_UI='true';
import { createRequire } from "node:module";
import { pathToFileURL, fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";
import { existsSync, mkdirSync, writeFileSync, mkdtempSync } from "node:fs";
import { once } from "node:events";
import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../.."),
  frontend = resolve(root, "frontend");
const require = createRequire(resolve(frontend, "package.json"));
const { chromium } = require("playwright-core");
const { createServer } = await import(pathToFileURL(require.resolve("vite")));
const mod = (n) =>
  import(pathToFileURL(resolve(root, `backend/dist/backend/src/${n}.js`)));
const [
  { SqliteStore },
  { LocalAuth },
  { Service },
  { createApp },
  { QuestionnaireService },
] = await Promise.all(
  ["store", "auth", "service", "app", "questionnaires"].map(mod),
);
const out = resolve(root, "integration/verification");
mkdirSync(out, { recursive: true });
mkdirSync(resolve(root, "backend/work"), { recursive: true });
const run = mkdtempSync(resolve(root, "backend/work/core-browser-"));
const store = new SqliteStore(resolve(run, "synthetic.sqlite")),
  auth = new LocalAuth(store),
  core = new Service(store),
  surveys = new QuestionnaireService(core);
const password = randomUUID();
const teacher = await auth.createUser(
  "core-teacher",
  password,
  "模拟教师",
  "teacher",
);
const testFrontendPort=Number(process.env.CORE_TEST_FRONTEND_PORT||5173);
process.env.DEV_FRONTEND_ORIGIN=`http://127.0.0.1:${testFrontendPort}`;
let server, vite, browser;
const results = [],
  errors = [];
async function check(name, fn) {
  await fn();
  results.push({ name, result: "pass" });
  console.log("PASS", name);
}
async function login(page, username, pw, first=false) {
  await page.goto(`http://127.0.0.1:${testFrontendPort}/login`);
  await page.getByLabel("账号").fill(username);
  await page.getByLabel("密码", { exact: true }).fill(pw);
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await page
    .getByRole("heading", {
      name: first ? "首次登录，请修改初始密码" : username === "core-teacher" ? "教师工作台" : "我的班级",
      exact: true,
    })
    .waitFor();
}
try {
  server = createApp(core, auth).listen(3001, "127.0.0.1");
  await once(server, "listening");
  process.env.VITE_API_MODE = "http";
  vite = await createServer({
    root: frontend,
    server:{port:testFrontendPort},
    configFile: resolve(frontend, "vite.config.ts"),
    logLevel: "error",
  });
  await vite.listen();
  browser = await chromium.launch({
    headless: true,
    executablePath:
      process.env.BROWSER_PATH ||
      [
        "C:/Program Files/Google/Chrome/Application/chrome.exe",
        "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
      ].find(existsSync),
  });
  const tp = await (await browser.newContext()).newPage(),
    sp = await (await browser.newContext()).newPage();
  for (const p of [tp, sp]) p.on("pageerror", (e) => errors.push(e.message));
  let c, survey;
  const initialPassword=randomUUID(),studentPassword=randomUUID();
  await check("管理员CSV预览并按班建号，前导零与姓名对应",async()=>{
    await auth.createUser('core-admin',password,'模拟管理员','admin');
    const token=(await auth.login({username:'core-admin',password})).accessToken;
    const call=async(path,body)=>{const r=await fetch('http://127.0.0.1:3001/api/v1'+path,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(body)});assert.equal(r.status,200);return(await r.json()).data};
    const file=await call('/admin/rosters/files/preview',{name:'模拟名单.csv',base64:Buffer.from('学生姓名,学生学号,班级\n模拟学生,000123,模拟核心班\n未作答学生,000124,模拟核心班').toString('base64')});
    assert.equal(file.sheets[0].rows[1][1],'000123');
    const plan=await call('/admin/rosters/preview',{batchName:'模拟核心批次',rows:file.sheets[0].rows.slice(1).map(r=>({studentNumber:r[1],displayName:r[0],className:r[2]}))});
    const receipt=await call('/admin/rosters/commit',{planId:plan.id,fingerprint:plan.fingerprint,initialPassword});assert.equal(receipt.newAccounts,2);
  });
  await check("教师选择管理员已建班级，名单只读且无导入控件",async()=>{
    await login(tp,'core-teacher',password);
    const row=tp.getByRole('row').filter({hasText:'模拟核心班'});await row.getByRole('button',{name:'添加到我的班级'}).click();
    c=core.classes(teacher)[0];assert.ok(c);
    await tp.getByRole('link',{name:'班级学生名单'}).click();await tp.getByRole('cell',{name:'000123',exact:true}).waitFor();assert.equal(await tp.locator('input[type=file]').count(),0);
  });
  await check("教师在线编辑、时间限制、发布", async () => {
    await tp.getByRole("link", { name: "返回班级" }).click();
    await tp.getByRole("link", { name: "布置问卷" }).click();
    await tp.getByLabel("问卷标题", { exact: true }).fill("模拟核心问卷");
    await tp.getByLabel("题目", { exact: true }).fill("请选择一个选项");
    await tp.getByLabel("题型", { exact: true }).selectOption("single");
    await tp.getByLabel("选项（每行一个）").fill("甲\n乙");
    await tp.getByLabel(/允许作答时长/).fill("10");
    await tp.getByRole("button", { name: "保存并发布问卷" }).click();
    await tp
      .getByRole("heading", { name: "模拟核心问卷", exact: true })
      .waitFor();
    survey = surveys.list(teacher, c.id)[0];
    assert.equal(survey.durationMinutes, 10);
  });
  await check("初始密码仅进入改密页，改密重登后可提交问卷", async () => {
    await login(sp, "000123", initialPassword, true);
    await sp.getByLabel('当前／初始密码').fill(initialPassword);
    await sp.getByLabel('新密码',{exact:true}).fill(studentPassword);
    await sp.getByLabel('确认新密码',{exact:true}).fill(studentPassword);
    await sp.getByRole('button',{name:'保存新密码并重新登录'}).click();
    await login(sp,'000123',studentPassword);
    await sp.getByRole("link", { name: "查看 / 作答" }).click();
    await sp.getByLabel("甲", { exact: true }).check();
    await sp.getByRole("button", { name: "提交问卷", exact: true }).click();
    await sp.getByText(/^已提交：/).waitFor();
    assert.equal(
      surveys.stats(teacher, survey.id).questions[0].counts[0].value,
      1,
    );
  });
  await check("表一含未提交学生、表二人数及图表、只读答卷", async () => {
    await tp.getByRole("link", { name: "作答情况与统计" }).click();
    await tp.getByRole("heading", { name: "学生作答情况" }).waitFor();
    await tp.getByRole("cell", { name: "未开始", exact: true }).waitFor();
    await tp.locator(".sa-question-grid > .sa-question > .sa-values > li").filter({has:tp.getByText("甲",{exact:true})}).getByText(/^1 人/).waitFor();
    await tp.getByRole("img", { name: /完整数据见下方明细/ }).waitFor();
    await tp.getByRole("link", { name: "查看作答" }).click();
    await tp
      .getByRole("heading", { name: "模拟核心问卷 · 只读作答" })
      .waitFor();
    await tp.getByText("甲", { exact: true }).waitFor();
  });
  await check("AI聊天预留交互明确返回未接入，未伪造AI回复", async () => {
    await sp.getByRole("link", { name: "返回班级" }).click();
    await sp.getByRole("link", { name: "AI 问答助手" }).click();
    await sp.getByLabel("课程问题").fill("模拟课程问题");
    await sp.getByRole("button", { name: "发送", exact: true }).click();
    await sp
      .getByRole("alert")
      .filter({ hasText: /AI ?服务尚未(接入|启用)/ })
      .waitFor();
    assert.equal(await sp.getByText("AI", { exact: true }).count(), 0);
  });
  await check("服务端时长到期拒绝提交（不依赖前端时钟）", async () => {
    const s = surveys.save(teacher, {
      classId: c.id,
      title: "模拟过期问卷",
      questions: [
        { id: "q", title: "文本", type: "text", required: false, options: [] },
      ],
      deadlineAt: null,
      durationMinutes: 1,
      expectedVersion: 0,
    });
    surveys.transition(teacher, s.id, s.version, "publish");
    const user = (await auth.login({ username: "000123", password: studentPassword }))
      .user;
    const session = surveys.start(user, s.id);
    store.put("survey_response", session.response.id, {
      ...session.response,
      startedAt: new Date(Date.now() - 120000).toISOString(),
    });
    assert.throws(
      () => surveys.submit(user, s.id, { q: "过期提交" }),
      /不能提交/,
    );
  });
  await check("320/375/414/768宽度无页面横向溢出", async () => {
    await tp.getByRole("link", { name: "返回班级" }).click();
    await tp
      .locator("article")
      .filter({
        has: tp.getByRole("heading", { name: "模拟核心问卷", exact: true }),
      })
      .getByRole("link", { name: "作答情况与统计" })
      .click();
    for (const width of [320, 375, 414, 768]) {
      await tp.setViewportSize({ width, height: 900 });
      await tp.getByRole("heading", { name: "逐题探索" }).waitFor();
      assert.ok(
        await tp.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
        `${width}px overflow`,
      );
      await tp.screenshot({
        path: resolve(run, `stats-${width}.png`),
        fullPage: true,
      });
    }
  });
  assert.deepEqual(errors, []);
  console.log("PASS", results.length, "core browser checks");
} finally {
  writeFileSync(
    resolve(out, "2026-10-28-core-browser.json"),
    JSON.stringify(
      {
        scope: "local HTTP with synthetic data; not production or load test",
        results,
        pageErrors: errors,
      },
      null,
      2,
    ),
  );
  await browser?.close();
  await vite?.close();
  if (server) await new Promise((r) => server.close(r));
  store.close();
}
