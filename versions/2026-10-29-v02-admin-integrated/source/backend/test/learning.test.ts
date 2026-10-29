import { test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SqliteStore } from "../src/store.js";
import { Service } from "../src/service.js";
import { LearningService } from "../src/learning.js";
import { createApp } from "../src/app.js";
import type { AuthProvider } from "../src/auth.js";
import type { ProfileAnswers } from "../../shared/learning.js";
import type { User } from "../../shared/contracts.js";
import {
  PROFILE_SCHEMA_VERSION,
  PROFILE_QUESTIONS,
} from "../../shared/profile-schema.js";
const teacher: User = {
    id: "teacher",
    displayName: "模拟教师",
    role: "teacher",
  },
  student: User = { id: "student", displayName: "=模拟学生", role: "student" },
  other: User = { id: "other", displayName: "其他教师", role: "teacher" },
  peer: User = { id: "peer", displayName: "其他学生", role: "student" };
function setup(path = ":memory:") {
  const store = new SqliteStore(path);
  for (const u of [teacher, student, other, peer]) store.put("user", u.id, u);
  const core = new Service(store);
  const a = core.createClass(teacher, "模拟A"),
    b = core.createClass(other, "模拟B");
  core.join(student, a.joinCode!);
  core.join(peer, a.joinCode!);
  store.put("student_identity", "001001", {
    studentNumber: "001001",
    userId: student.id,
    displayName: student.displayName,
  });
  return { store, core, a, b, learning: new LearningService(core) };
}
const input = () => ({
  schemaVersion: PROFILE_SCHEMA_VERSION,
  expectedVersion: 0,
  answers: {
    "profile-02": "环境专业",
    "profile-07": { r1: 3 },
    "profile-09": ["c2"],
  },
  other: { "profile-14": "交叉兴趣" },
});
test("画像按班级持久化与版本冲突，保留原文18题且仅7题开放、不生成成绩", () => {
  const path = join(
    mkdtempSync(join(tmpdir(), "learning-profile-")),
    "sample.sqlite",
  );
  const f = setup(path);
  assert.equal(PROFILE_QUESTIONS.length, 18);
  assert.equal(PROFILE_QUESTIONS.filter((q) => q.type).length, 7);
  const d = f.learning.saveProfile(student, f.a.id, input());
  assert.equal(d.version, 1);
  assert.throws(
    () => f.learning.saveProfile(student, f.a.id, input()),
    /版本冲突/,
  );
  assert.equal(
    f.learning.myProfile(student, f.a.id)?.answers["profile-02"],
    "环境专业",
  );
  assert.equal(f.store.all("report").length, 0);
  assert.equal(f.store.all("job").length, 0);
  const classId = f.a.id;
  f.store.close();
  const store = new SqliteStore(path);
  const restored = new LearningService(new Service(store));
  assert.equal(restored.myProfile(student, classId)?.version, 1);
  store.close();
});
test("画像拒绝未确认题型、未知行列、重复选项和其他字段；非法输入不会部分写入", () => {
  const f = setup();
  const attempts: ProfileAnswers[] = [
    { "profile-01": "大一" },
    { "profile-07": { bad: 3 } },
    { "profile-07": { r1: 0 } },
    { "profile-07": "3" },
    { "profile-09": ["c1", "c1"] },
    { "profile-09": ["bad"] },
    { "profile-02": [] },
    { unknown: "text" },
  ];
  for (const answers of attempts)
    assert.throws(() =>
      f.learning.saveProfile(student, f.a.id, { ...input(), answers }),
    );
  assert.throws(() =>
    f.learning.saveProfile(student, f.a.id, {
      ...input(),
      other: { "profile-02": "未知补充" },
    }),
  );
  assert.equal(f.learning.myProfile(student, f.a.id), null);
  f.store.close();
});
test("画像隔离学生/班级/教师，摘要不含答案，CSV保留前导零且转义公式", () => {
  const f = setup();
  f.learning.saveProfile(student, f.a.id, input());
  assert.equal(f.learning.myProfile(peer, f.a.id), null);
  for (const run of [
    () => f.learning.myProfile(student, f.b.id),
    () => f.learning.profiles(other, f.a.id),
    () => f.learning.profiles(student, f.a.id),
    () => f.learning.profile(other, f.a.id, student.id),
    () => f.learning.saveProfile(teacher, f.a.id, input()),
  ])
    assert.throws(run);
  const overview = f.learning.profiles(teacher, f.a.id)[0];
  assert.equal(overview.studentNumber, "001001");
  assert.equal(overview.filledCount, 4);
  assert.equal("answers" in overview, false);
  const csv = f.learning.exportProfiles(teacher, f.a.id);
  assert.ok(csv.includes("001001"));
  assert.ok(csv.includes("'=模拟学生"));
  assert.ok(csv.includes("环境专业"));
  f.store.close();
});
test("材料草稿仅本班教师可读，发布后本班学生可读、跨班拒绝、发布锁定", () => {
  const f = setup();
  const m = f.learning.saveMaterial(teacher, f.a.id, {
    title: "测试导读",
    content: "只作模拟测试。<script>标签保持纯文本</script>",
    expectedVersion: 0,
  });
  assert.equal(f.learning.materials(student, f.a.id).length, 0);
  assert.throws(() => f.learning.material(student, m.id));
  assert.throws(() => f.learning.material(other, m.id));
  assert.throws(() =>
    f.learning.saveMaterial(student, f.a.id, {
      title: "越权",
      content: "x",
      expectedVersion: 0,
    }),
  );
  f.learning.publishMaterial(teacher, m.id, m.version);
  assert.equal(f.learning.material(student, m.id).state, "published");
  assert.throws(() =>
    f.learning.saveMaterial(
      teacher,
      f.a.id,
      { title: "改写", content: "x", expectedVersion: 2 },
      m.id,
    ),
  );
  assert.throws(() => f.learning.publishMaterial(teacher, m.id, 1));
  f.store.close();
});
test("HTTP画像/材料认证与严格验证、并发保存仅一个成功，详情列表与导出权限一致", async () => {
  const f = setup();
  const users = [teacher, student, other, peer];
  const auth: AuthProvider = {
    async login() {
      throw new Error("not used");
    },
    authenticate(token) {
      const u = users.find((u) => u.id === token);
      if (!u) throw new Error("unknown");
      return u;
    },
    logout() {},
  };
  const server = createApp(f.core, auth).listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1`;
  const req = (
    path: string,
    user: User | null = student,
    method = "GET",
    body?: unknown,
  ) =>
    fetch(base + path, {
      method,
      headers: {
        ...(user ? { Authorization: `Bearer ${user.id}` } : {}),
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  try {
    assert.equal((await req("/profile-schema", null)).status, 401);
    const schema = await (await req("/profile-schema")).json();
    assert.equal(schema.data.questions.length, 18);
    const path = `/classes/${f.a.id}/my-profile`;
    assert.equal(
      (
        await req(path, student, "PUT", {
          ...input(),
          answers: { "profile-07": { r1: 6 } },
        })
      ).status,
      400,
    );
    assert.equal(
      (await req(path, student, "PUT", { ...input(), studentId: peer.id }))
        .status,
      400,
    );
    const statuses = await Promise.all([
      req(path, student, "PUT", input()),
      req(path, student, "PUT", input()),
    ]);
    assert.deepEqual(statuses.map((r) => r.status).sort(), [200, 409]);
    assert.equal(
      (await req(`/teacher/classes/${f.a.id}/profiles/${student.id}`, peer))
        .status,
      403,
    );
    assert.equal(
      (await req(`/teacher/classes/${f.a.id}/profiles/export`, other)).status,
      403,
    );
    const list = await (
      await req(`/teacher/classes/${f.a.id}/profiles?limit=1`, teacher)
    ).json();
    assert.equal(list.data.items.length, 1);
    assert.equal("answers" in list.data.items[0], false);
    const material = await (
      await req(`/teacher/classes/${f.a.id}/materials`, teacher, "POST", {
        title: "导读",
        content: "模拟材料",
        expectedVersion: 0,
      })
    ).json();
    assert.equal(material.ok, true);
    assert.equal(
      (await req(`/materials/${material.data.id}`, student)).status,
      404,
    );
    assert.equal(
      (
        await req(
          `/teacher/materials/${material.data.id}/publish`,
          teacher,
          "POST",
          { expectedVersion: 1 },
        )
      ).status,
      200,
    );
    assert.equal(
      (await req(`/materials/${material.data.id}`, student)).status,
      200,
    );
  } finally {
    await new Promise<void>((done) => server.close(() => done()));
    f.store.close();
  }
});
