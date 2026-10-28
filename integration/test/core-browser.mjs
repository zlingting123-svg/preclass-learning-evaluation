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
let server, vite, browser;
const results = [],
  errors = [];
async function check(name, fn) {
  await fn();
  results.push({ name, result: "pass" });
  console.log("PASS", name);
}
async function login(page, username, pw) {
  await page.goto("http://127.0.0.1:5173/login");
  await page.getByLabel("学号 / 教师账号").fill(username);
  await page.getByLabel("密码", { exact: true }).fill(pw);
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await page
    .getByRole("heading", {
      name: username === "core-teacher" ? "教师工作台" : "我的班级",
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
  await check("真实登录、创建班级、核心入口不展示旧评分/导读", async () => {
    await login(tp, "core-teacher", password);
    await tp.getByLabel("新班级名称").fill("模拟核心班");
    await tp.getByRole("button", { name: "创建班级", exact: true }).click();
    await tp.getByRole("link", { name: "学生名单与导入" }).waitFor();
    c = core.classes(teacher)[0];
    assert.ok(c);
    assert.equal(await tp.getByText("教师复核", { exact: true }).count(), 0);
  });
  await check("CSV上传、中文别名识别、前导零预览、确认导入", async () => {
    await tp.getByRole("link", { name: "学生名单与导入" }).click();
    await tp
      .locator("input[type=file]")
      .setInputFiles({
        name: "模拟名单.csv",
        mimeType: "text/csv",
        buffer: Buffer.from(
          "\ufeff学生姓名,学生学号\n模拟学生,000123\n未作答学生,000124",
        ),
      });
    await tp.getByRole("button", { name: "应用映射，编辑预览" }).click();
    assert.equal(
      await tp.getByLabel("第1行学号", { exact: true }).inputValue(),
      "000123",
    );
    await tp.getByRole("button", { name: "校验名单并生成确认预览" }).click();
    await tp.getByRole("button", { name: "确认正式导入" }).click();
    await tp.getByText(/已确认导入 2 名学生/).waitFor();
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
  await check("默认密码登录、问卷可见、单选提交真实持久化", async () => {
    await login(sp, "000123", "12345");
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
    await tp.getByRole("heading", { name: "表一 · 学生作答情况" }).waitFor();
    await tp.getByText("未开始", { exact: true }).waitFor();
    await tp.getByText("甲：1 人", { exact: true }).waitFor();
    await tp.getByRole("img", { name: /各选项选择人数/ }).waitFor();
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
      .filter({ hasText: "AI 服务尚未接入" })
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
    const user = (await auth.login({ username: "000123", password: "12345" }))
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
      await tp.getByRole("heading", { name: "表二 · 逐题作答统计" }).waitFor();
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
