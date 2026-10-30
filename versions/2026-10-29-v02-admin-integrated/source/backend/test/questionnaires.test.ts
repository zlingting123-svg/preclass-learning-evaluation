import { test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import * as XLSX from "xlsx";
import { SqliteStore } from "../src/store.js";
import { Service } from "../src/service.js";
import { QuestionnaireService } from "../src/questionnaires.js";
import { LocalAuth } from "../src/auth.js";
import { previewFile } from "../src/file-preview.js";
import { createApp } from "../src/app.js";
import type { User } from "../../shared/contracts.js";
import { recognizeQuestions } from "../../shared/import-questions.js";
test("问卷文件结构识别：编号/选项、多选和Excel列，未知结构不臆造题目", () => {
  const a = recognizeQuestions(
    "1. 单选问题\nA. 一\nB. 二\n2. 多选问题\nA. 甲\nB. 乙",
  );
  assert.equal(a.length, 2);
  assert.equal(a[1].type, "multiple");
  assert.deepEqual(a[0].options, ["一", "二"]);
  assert.equal(a[0].required, false);
  const b = recognizeQuestions(
    "题目\t题型\t选项A\t选项B\n模拟问题\t多选\t一\t二",
  );
  assert.equal(b[0].type, "multiple");
  assert.deepEqual(b[0].options, ["一", "二"]);
  assert.deepEqual(recognizeQuestions("无编号随意材料"), []);
});
test("网页导入缺项/科学计数提示、确认过期与写入故障完整回滚", async () => {
  const { store, service: s, c, setNow, now } = setup();
  try {
    const bad = s.previewRoster(teacher, c.id, [
      { studentNumber: "1e10", displayName: "" },
    ]);
    assert.equal(bad.errors.length, 2);
    assert.match(bad.errors[0], /第1行/);
    const p = s.previewRoster(teacher, c.id, [
      { studentNumber: "000888", displayName: "模拟回滚" },
    ]);
    const put = store.put.bind(store);
    store.put = (kind, id, value) => {
      if (kind === "member") throw new Error("injected");
      put(kind, id, value);
    };
    await assert.rejects(
      () => s.commitRoster(teacher, c.id, p.id, p.fingerprint),
      /injected/,
    );
    assert.equal(store.get("account", "000888"), undefined);
    assert.equal(store.get("student_identity", "000888"), undefined);
    assert.equal(store.get("survey_roster_receipt", p.id), undefined);
    store.put = put;
    setNow(now + 31 * 60000);
    await assert.rejects(
      () => s.commitRoster(teacher, c.id, p.id, p.fingerprint),
      /过期/,
    );
  } finally {
    store.close();
  }
});
const teacher: User = {
    id: "teacher",
    role: "teacher",
    displayName: "模拟教师",
  },
  other: User = { id: "other", role: "teacher", displayName: "其他教师" },
  student: User = { id: "student", role: "student", displayName: "模拟学生" },
  peer: User = { id: "peer", role: "student", displayName: "其他学生" };
test("Word DOCX表格自动提取单元格及学号，保留姓名/编号别名", async () => {
  const zip = XLSX.CFB.utils.cfb_new();
  XLSX.CFB.utils.cfb_add(
    zip,
    "[Content_Types].xml",
    Buffer.from(
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
    ),
  );
  const row = (a: string, b: string) =>
    `<w:tr><w:tc><w:p><w:r><w:t>${a}</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>${b}</w:t></w:r></w:p></w:tc></w:tr>`;
  XLSX.CFB.utils.cfb_add(
    zip,
    "word/document.xml",
    Buffer.from(
      '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:tbl>' +
        row("学生学号", "学生姓名") +
        row("000999", "模拟姓名") +
        "</w:tbl></w:body></w:document>",
    ),
  );
  const buffer = XLSX.CFB.write(zip, {
    type: "buffer",
    fileType: "zip",
  }) as Buffer;
  const preview = await previewFile({
    name: "模拟名单.docx",
    base64: buffer.toString("base64"),
  });
  assert.equal(preview.sheets[0].rows[1][0], "000999");
  assert.equal(preview.sheets[0].rows[1][1], "模拟姓名");
});
function setup() {
  const store = new SqliteStore(":memory:");
  let now = Date.parse("2026-10-28T08:00:00Z");
  for (const u of [teacher, other, student, peer]) store.put("user", u.id, u);
  const core = new Service(store, () => now);
  const c = core.createClass(teacher, "模拟班");
  core.join(student, c.joinCode!);
  core.join(peer, c.joinCode!);
  return {
    store,
    core,
    c,
    service: new QuestionnaireService(core),
    setNow: (n: number) => {
      now = n;
    },
    now,
  };
}
function input(classId: string) {
  return {
    classId,
    title: "模拟问卷",
    expectedVersion: 0,
    deadlineAt: null,
    durationMinutes: 1,
    questions: [
      {
        id: "a",
        title: "单选",
        type: "single",
        required: true,
        options: ["甲", "乙"],
      },
      {
        id: "b",
        title: "多选",
        type: "multiple",
        required: false,
        options: ["一", "二"],
      },
      { id: "c", title: "文字", type: "text", required: false, options: [] },
    ],
  };
}
test("问卷版本、权限、必填/选项校验、幂等提交、未提交学生与逐题人数", () => {
  const { store, service: s, c } = setup();
  try {
    const q = s.save(teacher, input(c.id));
    assert.throws(() => s.get(student, q.id));
    assert.throws(() => s.save(other, input(c.id)));
    assert.throws(() =>
      s.save(teacher, { ...input(c.id), expectedVersion: 99 }, q.id),
    );
    const p = s.transition(teacher, q.id, q.version, "publish");
    assert.throws(() =>
      s.save(teacher, { ...input(c.id), expectedVersion: p.version }, q.id),
    );
    const r = s.start(student, q.id);
    assert.equal(r.response.startedAt, "2026-10-28T08:00:00.000Z");
    assert.throws(() => s.submit(student, q.id, {}));
    assert.throws(() => s.submit(student, q.id, { a: "错误" }));
    assert.throws(() => s.submit(student, q.id, { a: ["甲"] }));
    const answers = { a: "甲", b: ["一", "二"], c: "<script>文字</script>" };
    const result = s.submit(student, q.id, answers);
    assert.ok(result.submittedAt);
    assert.equal(s.submit(student, q.id, answers).id, result.id);
    assert.throws(() => s.submit(student, q.id, { a: "乙" }));
    assert.throws(() => s.detail(peer, result.id));
    assert.throws(() => s.stats(other, q.id));
    const stats = s.stats(teacher, q.id);
    assert.equal(stats.students.length, 2);
    assert.equal(stats.students.filter((x) => x.status === "未开始").length, 1);
    assert.equal(stats.questions[0].counts[0].value, 1);
    assert.deepEqual(
      stats.questions[1].counts.map((x) => x.value),
      [1, 1],
    );
    assert.equal(stats.questions[2].texts[0], answers.c);
  } finally {
    store.close();
  }
});
test("允许时长从服务端首次开始计时，刷新不重置，截止/关闭均阻止提交", () => {
  const { store, service: s, c, setNow, now } = setup();
  try {
    const q = s.save(teacher, input(c.id));
    s.transition(teacher, q.id, q.version, "publish");
    const a = s.start(student, q.id);
    setNow(now + 30000);
    assert.equal(s.start(student, q.id).expiresAt, a.expiresAt);
    setNow(now + 60000);
    assert.throws(() => s.submit(student, q.id, { a: "甲" }), /不能提交/);
    const q2 = s.save(teacher, {
      ...input(c.id),
      deadlineAt: new Date(now + 61000).toISOString(),
      durationMinutes: null,
    });
    const p = s.transition(teacher, q2.id, q2.version, "publish");
    s.start(peer, q2.id);
    setNow(now + 61000);
    assert.throws(() => s.submit(peer, q2.id, { a: "甲" }));
    s.transition(teacher, q2.id, p.version, "close");
    assert.throws(() => s.submit(peer, q2.id, { a: "甲" }));
  } finally {
    store.close();
  }
});
test("名单预览无写入、姓名冲突拒绝、确认导入默认口令、跨班复用与重复确认", async () => {
  const { store, core, service: s, c } = setup();
  try {
    const rows = [{ studentNumber: "000100", displayName: "模拟导入" }];
    const p = s.previewRoster(teacher, c.id, rows);
    assert.equal(store.get("account", "000100"), undefined);
    assert.throws(() => s.previewRoster(other, c.id, rows));
    const dup = s.previewRoster(teacher, c.id, [...rows, ...rows]);
    assert.ok(dup.errors.length);
    await assert.rejects(() =>
      s.commitRoster(teacher, c.id, dup.id, dup.fingerprint),
    );
    await s.commitRoster(teacher, c.id, p.id, p.fingerprint);
    await s.commitRoster(teacher, c.id, p.id, p.fingerprint);
    const auth = new LocalAuth(store);
    const session = await auth.login({ username: "000100", password: "12345" });
    assert.equal(session.user.displayName, "模拟导入");
    const b = core.createClass(teacher, "模拟第二班");
    const p2 = s.previewRoster(teacher, b.id, rows);
    await s.commitRoster(teacher, b.id, p2.id, p2.fingerprint);
    assert.equal(core.classes(session.user).length, 2);
    assert.ok(
      s.previewRoster(teacher, b.id, [{ ...rows[0], displayName: "不一致" }])
        .errors.length,
    );
    assert.equal(
      s.members(teacher, c.id).find((x) => x.studentId === session.user.id)
        ?.studentNumber,
      "000100",
    );
  } finally {
    store.close();
  }
});
test("导入 CSV UTF8及Excel两种格式，保留学号显示值，伪格式明确失败", async () => {
  for (const bookType of ["xlsx", "xls"] as const) {
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      book,
      XLSX.utils.aoa_to_sheet([
        ["学生学号", "学生姓名"],
        ["000123", "模拟姓名"],
      ]),
    );
    const b = XLSX.write(book, { bookType, type: "buffer" }) as Buffer;
    const p = await previewFile({
      name: "名单." + bookType,
      base64: b.toString("base64"),
    });
    assert.equal(p.sheets[0].rows[1][0], "000123");
  }
  const b = Buffer.from("\ufeff名字,编号\r\n模拟姓名,000456");
  const p = await previewFile({
    name: "名单.csv",
    base64: b.toString("base64"),
  });
  assert.equal(p.sheets[0].rows[1][1], "000456");
  await assert.rejects(
    () => previewFile({ name: "伪.doc", base64: b.toString("base64") }),
    /不符/,
  );
  await assert.rejects(() =>
    previewFile({
      name: "坏.csv",
      base64: Buffer.from([0xff, 0xfe]).toString("base64"),
    }),
  );
});
test("真实HTTP认证、非授权名单/统计、AI未接入均返回正确失败", async () => {
  const { store, core, c } = setup();
  const auth = {
    login: async () => {
      throw Error("unused");
    },
    authenticate: (token: string) =>
      ({ teacher, student, other, peer })[token as "teacher"]!,
    logout: () => {},
  };
  const server = createApp(core, auth).listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address() as { port: number };
  const base = `http://127.0.0.1:${address.port}/api/v1`;
  try {
    assert.equal(
      (await fetch(base + "/core/classes/" + c.id + "/members")).status,
      401,
    );
    assert.equal(
      (
        await fetch(base + "/core/classes/" + c.id + "/members", {
          headers: { Authorization: "Bearer other" },
        })
      ).status,
      403,
    );
    const ai = await fetch(base + "/core/ai/chat", {
      method: "POST",
      headers: {
        Authorization: "Bearer student",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ classId: c.id, messages: [] }),
    });
    assert.equal(ai.status, 503);
    assert.equal((await ai.json()).error.code, "AI_NOT_CONNECTED");
  } finally {
    server.close();
    await once(server, "close");
    store.close();
  }
});
