// Explicit local synthetic fixture. Never run against a user-selected/production DB.
import { mkdirSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { randomBytes, randomUUID } from "node:crypto";
import { SqliteStore } from "./store.js";
import { LocalAuth } from "./auth.js";
import { Service } from "./service.js";
import { LearningService } from "./learning.js";
import { createCohort } from "./cohorts.js";
import { SAMPLE_GUIDE, SAMPLE_EXERCISES } from "../../shared/sample-content.js";
import type { User } from "../../shared/contracts.js";
if (process.env.NODE_ENV === "production" || process.env.DB_PATH)
  throw new Error(
    "模拟初始化使用固定独立数据库；请移除DB_PATH，勿用于真实数据",
  );
const folder = resolve("work/platform-sample");
mkdirSync(folder, { recursive: true, mode: 0o700 });
const marker = resolve(folder, "sample.json"),
  database = resolve(folder, "sample.sqlite");
if (existsSync(marker)) {
  const m = JSON.parse(readFileSync(marker, "utf8"));
  if (m.mock !== true || !existsSync(database))
    throw new Error("模拟环境不完整，保留文件并检查");
  console.log("已有模拟课程已保留，账号见work/platform-sample/测试账号.txt");
  process.exit(0);
}
if (existsSync(database))
  throw new Error("已有数据库但未找到模拟标记，拒绝覆盖");
const store = new SqliteStore(database);
const auth = new LocalAuth(store);
const core = new Service(store);
const learning = new LearningService(core);
const accounts: Record<
  string,
  { username: string; password: string; user: User }
> = {};
try {
  for (const [username, role, label] of [
    ["sample_admin", "admin", "本机模拟管理员"],
    ["teacher_a", "teacher", "样板教师A（模拟）"],
    ["teacher_b", "teacher", "样板教师B（模拟）"],
    ["001001", "student", "学生甲（模拟）"],
    ["002001", "student", "学生乙（模拟）"],
  ] as const) {
    const password = "P!" + randomBytes(12).toString("hex") + "9a";
    const user = await auth.createUser(username, password, label, role);
    accounts[username] = { username, password, user };
    if (role === "student")
      store.put("student_identity", username, {
        studentNumber: username,
        userId: user.id,
        displayName: label,
      });
  }
  const cohort = createCohort(store, accounts.sample_admin.user, {
    name: "2026秋季（本机模拟）",
    courseName: "环境评价与管理",
    startsOn: "2026-10-01",
    endsOn: "2027-01-31",
    teacherIds: [accounts.teacher_a.user.id, accounts.teacher_b.user.id],
    plannedStudentCount: 2,
    plannedTeacherCount: 2,
    assignmentsPerStudent: 4,
  });
  const spring = createCohort(store, accounts.sample_admin.user, {
    name: "2027春季（跨期模拟）",
    courseName: "环境评价与管理",
    startsOn: "2027-02-01",
    endsOn: "2027-05-31",
    teacherIds: [accounts.teacher_a.user.id],
    plannedStudentCount: 1,
    plannedTeacherCount: 1,
    assignmentsPerStudent: 4,
  });
  const classes = [];
  for (const [code, teacherName, studentName] of [
    ["A", "teacher_a", "001001"],
    ["B", "teacher_b", "002001"],
  ]) {
    const teacher = accounts[teacherName].user;
    const cls = core.createClass(
      teacher,
      `环境评价与管理 · 模拟${code}班`,
      cohort.id,
    );
    classes.push(cls);
    core.join(accounts[studentName].user, cls.joinCode!);
    const draft = learning.saveMaterial(teacher, cls.id, {
      ...SAMPLE_GUIDE,
      expectedVersion: 0,
    });
    learning.publishMaterial(teacher, draft.id, draft.version);
    for (const exercise of SAMPLE_EXERCISES) {
      const a = core.saveAssignment(teacher, {
        classId: cls.id,
        title: exercise.title,
        instructions: exercise.instructions,
        questions: exercise.prompts.map((prompt) => ({
          id: randomUUID(),
          prompt,
          maxLength: 4000,
        })),
        deadlineAt: null,
        rubricId: null,
        expectedVersion: 0,
      });
      core.transition(teacher, a.id, a.version, "publish");
    }
  }
  const cross = core.createClass(
    accounts.teacher_a.user,
    "环境评价与管理 · 跨期账号复用对照",
    spring.id,
  );
  core.join(accounts["001001"].user, cross.joinCode!);
  writeFileSync(
    resolve(folder, "accounts.json"),
    JSON.stringify(accounts, null, 2),
    { mode: 0o600 },
  );
  writeFileSync(
    resolve(folder, "测试账号.txt"),
    [
      "学习平台React/Node本机样板：http://127.0.0.1:5173",
      "仅用于本地模拟，勿填写真实个人信息。",
      ...["001001", "002001", "teacher_a", "teacher_b"].map(
        (name) =>
          `${accounts[name].user.displayName}\n账号：${name}\n密码：${accounts[name].password}`,
      ),
      "Moodle账号、旧下载版本账号与本样板账号独立。",
    ].join("\n\n"),
    { mode: 0o600 },
  );
  writeFileSync(
    marker,
    JSON.stringify(
      {
        mock: true,
        classes: classes.map((c) => c.id),
        crossTerm: cross.id,
        database,
      },
      null,
      2,
    ),
    { mode: 0o600 },
  );
  console.log(
    "已生成两班模拟课程、课程导读、四份练习；未生成成绩。私密账号见work/platform-sample/测试账号.txt",
  );
} finally {
  store.close();
}
