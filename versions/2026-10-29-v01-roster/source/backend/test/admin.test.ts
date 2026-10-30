import { test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { SqliteStore } from "../src/store.js";
import { LocalAuth } from "../src/auth.js";
import { Service } from "../src/service.js";
import { AdminService } from "../src/admin.js";
import { createApp } from "../src/app.js";
import { createCohort } from "../src/cohorts.js";
test("批次班级换教师需明确授权，授权与班级调整同事务执行", async () => {
  const { store, auth, core, admin, root, teacher } = await setup();
  try {
    const next = await auth.createUser(
      "next-teacher",
      "SyntheticTeacher123!",
      "模拟新教师",
      "teacher",
    );
    const cohort = createCohort(store, root, {
      name: "模拟批次",
      courseName: "模拟课程",
      startsOn: "2026-10-01",
      endsOn: "2027-01-31",
      teacherIds: [teacher.id],
    });
    const c = admin.saveClass(root, {
      name: "批次班",
      teacherId: teacher.id,
      cohortId: cohort.id,
      expectedVersion: 0,
    })!;
    assert.throws(
      () =>
        admin.saveClass(
          root,
          { name: c.name, teacherId: next.id, expectedVersion: c.version },
          c.id,
        ),
      /批次授权/,
    );
    assert.equal(core.classes(next).length, 0);
    admin.saveClass(
      root,
      {
        name: c.name,
        teacherId: next.id,
        authorizeCohort: true,
        expectedVersion: c.version,
      },
      c.id,
    );
    assert.equal(core.classes(next).length, 1);
    assert.throws(() => core.classAccess(teacher, c.id));
    assert.ok(
      store
        .all<{ action: string }>("admin_audit")
        .some((a) => a.action === "authorize_cohort_teacher"),
    );
  } finally {
    store.close();
  }
});
async function setup() {
  const store = new SqliteStore(":memory:"),
    auth = new LocalAuth(store),
    core = new Service(store),
    admin = new AdminService(core);
  const root = await auth.createUser(
    "admin-test",
    "SyntheticAdmin123!",
    "模拟管理员",
    "admin",
  );
  const teacher = await auth.createUser(
    "teacher-test",
    "SyntheticTeacher123!",
    "模拟教师",
    "teacher",
  );
  return { store, auth, core, admin, root, teacher };
}
test("管理员账号创建/搜索数据不泄露哈希；教师和伪造管理员无权，网页不允许创建管理员", async () => {
  const { store, admin, root, teacher } = await setup();
  try {
    assert.throws(() => admin.overview(teacher));
    assert.throws(() => admin.overview({ ...teacher, role: "admin" }));
    await assert.rejects(() =>
      admin.create(root, {
        username: "rogue",
        displayName: "越权",
        role: "admin",
        password: "SyntheticAdmin123!",
      }),
    );
    await admin.create(root, {
      username: "000123",
      displayName: "模拟学生",
      role: "student",
      password: "SyntheticStudent123!",
    });
    assert.equal(admin.overview(root).students, 1);
    const users = JSON.stringify(admin.accounts(root));
    assert.ok(!users.includes("passwordHash") && !users.includes("$2b$"));
    assert.ok(users.includes("000123"));
    assert.equal(store.all("admin_audit").length, 1);
  } finally {
    store.close();
  }
});
test("停用使已有会话立即失效；恢复不复活旧令牌；重置密码撤销会话并检查版本", async () => {
  const { store, auth, admin, root, teacher } = await setup();
  try {
    const old = await auth.login({
      username: "teacher-test",
      password: "SyntheticTeacher123!",
    });
    const row = admin.update(root, teacher.id, {
      displayName: "模拟教师改名",
      disabled: true,
      expectedVersion: 0,
    });
    assert.throws(() => auth.authenticate(old.accessToken));
    await assert.rejects(() =>
      auth.login({
        username: "teacher-test",
        password: "SyntheticTeacher123!",
      }),
    );
    admin.update(root, teacher.id, {
      displayName: row.displayName,
      disabled: false,
      expectedVersion: row.version,
    });
    assert.throws(() => auth.authenticate(old.accessToken));
    const session = await auth.login({
      username: "teacher-test",
      password: "SyntheticTeacher123!",
    });
    await assert.rejects(() =>
      admin.reset(root, teacher.id, {
        password: "ChangedPassword123!",
        expectedVersion: 0,
      }),
    );
    await admin.reset(root, teacher.id, {
      password: "ChangedPassword123!",
      expectedVersion: 2,
    });
    assert.throws(() => auth.authenticate(session.accessToken));
    await assert.rejects(() =>
      auth.login({
        username: "teacher-test",
        password: "SyntheticTeacher123!",
      }),
    );
    assert.ok(
      await auth.login({
        username: "teacher-test",
        password: "ChangedPassword123!",
      }),
    );
    assert.throws(() =>
      admin.update(root, root.id, {
        displayName: "自停",
        disabled: true,
        expectedVersion: 0,
      }),
    );
    assert.ok(
      !JSON.stringify(store.all("admin_audit")).includes("ChangedPassword"),
    );
  } finally {
    store.close();
  }
});
test("班级创建、归属调整及成员增减；旧教师立即失权，操作失败事务回滚", async () => {
  const { store, auth, core, admin, root, teacher } = await setup();
  try {
    const student = await admin.create(root, {
      username: "000456",
      displayName: "模拟学生",
      role: "student",
      password: "SyntheticStudent123!",
    });
    const second = await auth.createUser(
      "teacher-second",
      "SyntheticTeacher123!",
      "第二教师",
      "teacher",
    );
    const c = admin.saveClass(root, {
      name: "管理模拟班",
      teacherId: teacher.id,
      expectedVersion: 0,
    })!;
    admin.membership(root, c.id, student.id, true);
    assert.equal(admin.members(root, c.id)[0].username, "000456");
    assert.equal(core.classes(teacher).length, 1);
    admin.saveClass(
      root,
      { name: "调整模拟班", teacherId: second.id, expectedVersion: c.version },
      c.id,
    );
    assert.throws(() => core.classAccess(teacher, c.id));
    assert.equal(core.classes(second).length, 1);
    assert.throws(() =>
      admin.saveClass(
        root,
        { name: "旧版本", teacherId: teacher.id, expectedVersion: 0 },
        c.id,
      ),
    );
    admin.membership(root, c.id, student.id, false);
    assert.equal(admin.members(root, c.id).length, 0);
    const before = store.all("account").length,
      put = store.put.bind(store);
    store.put = (kind, id, v) => {
      if (kind === "admin_audit") throw Error("injected");
      put(kind, id, v);
    };
    await assert.rejects(() =>
      admin.create(root, {
        username: "rollback-student",
        displayName: "模拟回滚",
        role: "student",
        password: "SyntheticStudent123!",
      }),
    );
    assert.equal(store.all("account").length, before);
    assert.equal(store.get("student_identity", "rollback-student"), undefined);
    store.put = put;
  } finally {
    store.close();
  }
});
test("HTTP管理员隔离、分页与来源检查，不开放任意来源", async () => {
  const { store, auth, core } = await setup();
  const server = createApp(core, auth).listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api/v1`;
  try {
    assert.equal((await fetch(base + "/admin/overview")).status, 401);
    const teacher = await auth.login({
      username: "teacher-test",
      password: "SyntheticTeacher123!",
    });
    assert.equal(
      (
        await fetch(base + "/admin/users", {
          headers: { Authorization: "Bearer " + teacher.accessToken },
        })
      ).status,
      403,
    );
    const admin = await auth.login({
      username: "admin-test",
      password: "SyntheticAdmin123!",
    });
    const r = await fetch(base + "/admin/users?page=1&role=teacher", {
      headers: { Authorization: "Bearer " + admin.accessToken },
    });
    const body = await r.json();
    assert.equal(body.data.total, 1);
    assert.equal(body.data.items[0].role, "teacher");
    const login = (origin: string) =>
      fetch(base + "/auth/login", {
        method: "POST",
        headers: { Origin: origin, "Content-Type": "application/json" },
        body: JSON.stringify({
          username: "teacher-test",
          password: "SyntheticTeacher123!",
        }),
      });
    assert.equal((await login("http://10.1.2.3:5173")).status, 403);
    assert.equal((await login("http://127.0.0.1:5173")).status, 200);
    assert.equal((await login("http://untrusted.example:5173")).status, 403);
  } finally {
    server.close();
    await once(server, "close");
    store.close();
  }
});
