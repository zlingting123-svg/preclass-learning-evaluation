// Historical UI regression only; never enabled in production builds.
process.env.VITE_LEGACY_UI='true';
import { createRequire } from "node:module";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { once } from "node:events";
import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../.."),
  require = createRequire(resolve(root, "frontend/package.json")),
  { chromium } = require("playwright-core");
const mod = (n) =>
  import(pathToFileURL(resolve(root, `backend/dist/backend/src/${n}.js`)));
const [{ SqliteStore }, { LocalAuth }, { Service }, { createApp }] =
  await Promise.all(["store", "auth", "service", "app"].map(mod));
const store = new SqliteStore(":memory:"),
  auth = new LocalAuth(store),
  core = new Service(store),
  password = randomUUID();
await auth.createUser("browser_admin", password, "浏览器模拟管理员", "admin");
const server = createApp(core, auth).listen(0, "127.0.0.1");
await once(server, "listening");
const backend = `http://127.0.0.1:${server.address().port}`;
let vite;
try {
  const r = await fetch("http://127.0.0.1:5173/design-preview.html", {
    signal: AbortSignal.timeout(2000),
  });
  assert.ok(r.ok);
} catch {
  const { createServer } = await import(pathToFileURL(require.resolve("vite")));
  vite = await createServer({
    root: resolve(root, "frontend"),
    configFile: resolve(root, "frontend/vite.config.ts"),
    logLevel: "error",
  });
  await vite.listen();
}
const browser = await chromium.launch({
    headless: true,
    executablePath:
      process.env.BROWSER_PATH ||
      [
        "C:/Program Files/Google/Chrome/Application/chrome.exe",
        "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
      ].find(existsSync),
  }),
  page = await browser.newPage({ viewport: { width: 1440, height: 1000 } }),
  errors = [],
  checks = [];
const output = resolve(root, "integration/work/admin-browser");
mkdirSync(output, { recursive: true });
page.on("pageerror", (e) => errors.push(e.message));
// Route to a real isolated Express/SQLite fixture, preserving request method, body and auth.
await page.route("**/api/v1/**", async (route) => {
  const u = new URL(route.request().url());
  const response = await route.fetch({ url: backend + u.pathname + u.search });
  await route.fulfill({ response });
});
async function check(name, fn) {
  await fn();
  checks.push({ name, result: "pass" });
  console.log("PASS", name);
}
try {
  await check("原登录入口进入独立管理员，全局概览真实读取", async () => {
    await page.goto("http://127.0.0.1:5173/login");
    await page.getByLabel("账号").fill("browser_admin");
    await page.getByLabel("密码", { exact: true }).fill(password);
    await page.getByRole("button", { name: "登录", exact: true }).click();
    await page.waitForURL("**/admin");
    await page
      .getByRole("heading", { name: "全局概览", exact: true })
      .waitFor();
  });
  await check("管理页面创建教师及学生，搜索正确返回", async () => {
    await page.getByRole("button", { name: "账号与教师", exact: true }).click();
    const create = page.locator("section").filter({
      has: page.getByRole("heading", { name: "创建师生账号", exact: true }),
    });
    for (const [username, displayName, role] of [
      ["browser_teacher", "浏览器模拟教师", "teacher"],
      ["browser_student", "浏览器模拟学生", "student"],
    ]) {
      await create.getByLabel("账号 / 学号", { exact: true }).fill(username);
      await create.getByLabel("姓名", { exact: true }).fill(displayName);
      await create.getByLabel("新账号角色").selectOption(role);
      await create.getByLabel("初始密码（至少12字符）").fill(password);
      await create
        .getByRole("button", { name: "创建账号", exact: true })
        .click();
      await page
        .getByRole("status")
        .filter({ hasText: "账号已创建" })
        .waitFor();
      await page.getByRole("row").filter({ hasText: username }).waitFor();
    }
    await page.getByLabel("搜索账号或姓名").fill("browser_student");
    await page.getByRole("button", { name: "搜索", exact: true }).click();
    await page.getByText("第 1 页 · 共 1 个账号", { exact: true }).waitFor();
    await page.screenshot({
      path: resolve(output, "users.png"),
      fullPage: true,
    });
  });
  await check("停用、恢复与密码重置，旧会话失效", async () => {
    const old = await auth.login({ username: "browser_student", password });
    const row = page.getByRole("row").filter({ hasText: "browser_student" });
    await row.getByRole("button", { name: "维护账号" }).click();
    const edit = page.locator("section").filter({
      has: page.getByRole("heading", { name: "维护账号 · browser_student" }),
    });
    await edit.getByLabel("账号状态").selectOption("true");
    await edit.getByRole("button", { name: "保存资料" }).click();
    await page
      .getByRole("status")
      .filter({ hasText: "账号资料已更新" })
      .waitFor();
    assert.throws(() => auth.authenticate(old.accessToken));
    await row.getByRole("button", { name: "维护账号" }).click();
    await edit.getByLabel("账号状态").selectOption("false");
    await edit.getByRole("button", { name: "保存资料" }).click();
    await page
      .getByRole("status")
      .filter({ hasText: "账号资料已更新" })
      .waitFor();
    await row.getByRole("button", { name: "维护账号" }).click();
    await edit
      .getByLabel("重置为新密码（至少12字符）")
      .fill("SyntheticChanged123!");
    await edit.getByRole("button", { name: "确认重置密码" }).click();
    await page.getByRole("status").filter({ hasText: "密码已重置" }).waitFor();
    assert.ok(
      await auth.login({
        username: "browser_student",
        password: "SyntheticChanged123!",
      }),
    );
  });
  await check("创建班级、添加与移出成员，日志可追踪", async () => {
    await page.getByRole("button", { name: "班级与成员", exact: true }).click();
    await page.getByLabel("班级名称", { exact: true }).fill("浏览器模拟班");
    const teacher = store
      .all("account")
      .find((a) => a.username === "browser_teacher");
    await page
      .getByLabel("授课教师", { exact: true })
      .selectOption(teacher.user.id);
    await page.getByRole("button", { name: "保存班级", exact: true }).click();
    await page.getByRole("status").filter({ hasText: "班级已保存" }).waitFor();
    const student = store
      .all("account")
      .find((a) => a.username === "browser_student");
    await page
      .getByLabel("添加学生", { exact: true })
      .selectOption(student.user.id);
    await page.getByRole("button", { name: "添加到班级", exact: true }).click();
    await page
      .getByRole("status")
      .filter({ hasText: "学生已加入班级" })
      .waitFor();
    await page.screenshot({
      path: resolve(output, "classes.png"),
      fullPage: true,
    });
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "移出班级", exact: true }).click();
    await page.getByRole("status").filter({ hasText: "已移出班级" }).waitFor();
    assert.equal(store.all("member").length, 0);
    await page.getByLabel("班级名称", { exact: true }).fill("浏览器第二模拟班");
    await page
      .getByLabel("授课教师", { exact: true })
      .selectOption(teacher.user.id);
    await page.getByRole("button", { name: "保存班级", exact: true }).click();
    await page.getByRole("status").filter({ hasText: "班级已保存" }).waitFor();
    const second = store
      .all("class")
      .find((c) => c.name === "浏览器第二模拟班");
    assert.equal(
      await page.getByLabel("当前管理班级", { exact: true }).inputValue(),
      second.id,
    );
    await page.getByRole("button", { name: "操作日志", exact: true }).click();
    await page
      .getByRole("cell", { name: "移出班级成员", exact: true })
      .waitFor();
  });
  await check("移动宽度无整页溢出及前端预览管理员入口可用", async () => {
    for (const width of [320, 375, 768]) {
      await page.setViewportSize({ width, height: 900 });
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      );
      if (width === 375)
        await page.screenshot({
          path: resolve(output, "admin-375.png"),
          fullPage: true,
        });
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.getByRole("button", { name: "全局概览", exact: true }).click();
    await page.screenshot({
      path: resolve(output, "overview.png"),
      fullPage: true,
    });
    await page.goto("http://127.0.0.1:5173/design-preview.html");
    await page.getByLabel("账号").fill("browser_admin");
    await page.getByLabel("密码", { exact: true }).fill(password);
    await page
      .getByRole("button", { name: "进入学习空间", exact: true })
      .click();
    await page
      .getByRole("heading", { name: "全局概览", exact: true })
      .waitFor();
  });
  assert.deepEqual(errors, []);
} finally {
  writeFileSync(
    resolve(output, "verification.json"),
    JSON.stringify(
      {
        scope:
          "real isolated Express/SQLite, synthetic users, frontend API routed to fixture; not production or load test",
        checks,
        pageErrors: errors,
      },
      null,
      2,
    ),
  );
  await browser.close();
  await vite?.close();
  server.close();
  await once(server, "close");
  store.close();
}
