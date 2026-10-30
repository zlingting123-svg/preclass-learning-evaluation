import { randomUUID, createHash } from "node:crypto";
import { z } from "zod";
import type { User } from "../../shared/contracts.js";
import type {
  Survey,
  SurveyResponse,
  SurveySession,
  SurveyStats,
  RosterPlan,
  RosterRow,
} from "../../shared/questionnaires.js";
import { Service, keyFor, type Member } from "./service.js";
import { LocalAuth, type Account } from "./auth.js";
import { ensure } from "./errors.js";

const option = z.string().trim().min(1).max(300);
export const surveyInput = z
  .object({
    classId: z.string().min(1),
    title: z.string().trim().min(1).max(200),
    questions: z
      .array(
        z
          .object({
            id: z.string().min(1).max(100),
            title: z.string().trim().min(1).max(3000),
            type: z.enum(["text", "single", "multiple"]),
            required: z.boolean(),
            options: z.array(option).max(50),
          })
          .strict(),
      )
      .min(1)
      .max(100),
    deadlineAt: z.iso.datetime().nullable(),
    durationMinutes: z.number().int().min(1).max(10080).nullable(),
    expectedVersion: z.number().int().min(0),
  })
  .strict()
  .superRefine((v, c) => {
    if (new Set(v.questions.map((q) => q.id)).size !== v.questions.length)
      c.addIssue({ code: "custom", message: "题目ID重复" });
    for (const q of v.questions)
      if (
        q.type !== "text" &&
        (q.options.length < 2 || new Set(q.options).size !== q.options.length)
      )
        c.addIssue({ code: "custom", message: "选择题需至少两个不重复选项" });
  });
const rowsSchema = z
  .array(
    z
      .object({
        studentNumber: z.string().trim().max(100),
        displayName: z.string().trim().max(100),
      })
      .strict(),
  )
  .min(1)
  .max(1000);
const digest = (v: unknown) =>
  createHash("sha256").update(JSON.stringify(v)).digest("hex");
export class QuestionnaireService {
  constructor(readonly core: Service) {}
  get store() {
    return this.core.store;
  }
  teacher(u: User, c: string) {
    this.core.role(u, "teacher");
    return this.core.classAccess(u, c);
  }
  get(u: User, id: string): Survey {
    const s = this.store.get<Survey>("survey", id);
    ensure(s, 404, "NOT_FOUND", "问卷不存在");
    this.core.classAccess(u, s.classId);
    ensure(
      u.role !== "student" || s.state !== "draft",
      404,
      "NOT_FOUND",
      "问卷未发布",
    );
    return s;
  }
  list(u: User, c: string) {
    this.core.classAccess(u, c);
    return this.store
      .all<Survey>("survey")
      .filter(
        (s) => s.classId === c && (u.role !== "student" || s.state !== "draft"),
      );
  }
  save(u: User, raw: unknown, id?: string) {
    const input = surveyInput.parse(raw);
    this.teacher(u, input.classId);
    return this.store.transaction(() => {
      const old = id ? this.get(u, id) : undefined;
      ensure(
        !old || old.classId === input.classId,
        400,
        "INVALID_CLASS",
        "不能移动问卷",
      );
      ensure(
        !old || old.state === "draft",
        409,
        "LOCKED",
        "已发布问卷不可修改，请另建草稿",
      );
      this.core.checkVersion(old?.version ?? 0, input.expectedVersion);
      const { expectedVersion: _, ...fields } = input;
      const s: Survey = {
        ...fields,
        id: old?.id ?? randomUUID(),
        state: "draft",
        version: (old?.version ?? 0) + 1,
      };
      this.store.put("survey", s.id, s);
      return s;
    });
  }
  transition(
    u: User,
    id: string,
    version: number,
    action: "publish" | "close",
  ) {
    return this.store.transaction(() => {
      const s = this.get(u, id);
      this.teacher(u, s.classId);
      this.core.checkVersion(s.version, version);
      ensure(
        s.state === (action === "publish" ? "draft" : "published"),
        409,
        "INVALID_STATE",
        "问卷状态不允许该操作",
      );
      ensure(
        action !== "publish" ||
          !s.deadlineAt ||
          Date.parse(s.deadlineAt) > this.core.now(),
        400,
        "EXPIRED",
        "截止时间必须在未来",
      );
      s.state = action === "publish" ? "published" : "closed";
      s.version++;
      this.store.put("survey", id, s);
      return s;
    });
  }
  identity(id: string) {
    return (
      this.store
        .all<{ userId: string; studentNumber: string }>("student_identity")
        .find((x) => x.userId === id)?.studentNumber ??
      this.store.all<Account>("account").find((x) => x.user.id === id)
        ?.username ??
      ""
    );
  }
  expiry(s: Survey, r: SurveyResponse) {
    const times = [
      s.deadlineAt ? Date.parse(s.deadlineAt) : Infinity,
      s.durationMinutes
        ? Date.parse(r.startedAt) + s.durationMinutes * 60000
        : Infinity,
    ];
    const n = Math.min(...times);
    return Number.isFinite(n) ? new Date(n).toISOString() : null;
  }
  start(u: User, id: string): SurveySession {
    this.core.role(u, "student");
    return this.store.transaction(() => {
      const s = this.get(u, id);
      const rid = keyFor(id, u.id);
      let r = this.store.get<SurveyResponse>("survey_response", rid);
      ensure(
        r?.submittedAt || s.state === "published",
        409,
        "CLOSED",
        "问卷未开放",
      );
      if (!r) {
        ensure(
          !s.deadlineAt || this.core.now() < Date.parse(s.deadlineAt),
          409,
          "EXPIRED",
          "已过截止时间",
        );
        r = {
          id: rid,
          surveyId: id,
          studentId: u.id,
          studentNumber: this.identity(u.id),
          studentName: u.displayName,
          startedAt: this.core.iso(),
          submittedAt: null,
          answers: {},
        };
        this.store.put("survey_response", rid, r);
      }
      return {
        survey: s,
        response: r,
        serverNow: this.core.iso(),
        expiresAt: this.expiry(s, r),
      };
    });
  }
  submit(u: User, id: string, raw: unknown) {
    this.core.role(u, "student");
    const answers = z
      .record(
        z.string(),
        z.union([z.string().max(10000), z.array(z.string().max(300)).max(50)]),
      )
      .parse(raw);
    return this.store.transaction(() => {
      const s = this.get(u, id);
      const rid = keyFor(id, u.id);
      const r = this.store.get<SurveyResponse>("survey_response", rid);
      ensure(r, 409, "NOT_STARTED", "请先开始作答");
      if (r.submittedAt) {
        ensure(
          digest(r.answers) === digest(answers),
          409,
          "ALREADY_SUBMITTED",
          "问卷已提交",
        );
        return r;
      }
      ensure(s.state === "published", 409, "CLOSED", "问卷已结束");
      const expiry = this.expiry(s, r);
      ensure(
        !expiry || this.core.now() < Date.parse(expiry),
        409,
        "EXPIRED",
        "超过截止时间或允许作答时长，不能提交",
      );
      ensure(
        Object.keys(answers).every((k) => s.questions.some((q) => q.id === k)),
        400,
        "INVALID_ANSWERS",
        "包含未知题目",
      );
      for (const q of s.questions) {
        const v = answers[q.id];
        ensure(
          !q.required ||
            (typeof v === "string"
              ? v.trim().length > 0
              : Array.isArray(v) && v.length > 0),
          400,
          "REQUIRED",
          "请完成必答题：" + q.title,
        );
        if (v !== undefined) {
          ensure(
            q.type === "multiple"
              ? Array.isArray(v) && new Set(v).size === v.length
              : typeof v === "string",
            400,
            "INVALID_ANSWERS",
            "答案类型不匹配",
          );
          if (q.type !== "text")
            ensure(
              (Array.isArray(v) ? v : [v]).every((x) => q.options.includes(x)),
              400,
              "INVALID_OPTIONS",
              "选择了无效选项",
            );
        }
      }
      r.answers = answers;
      r.submittedAt = this.core.iso();
      this.store.put("survey_response", rid, r);
      return r;
    });
  }
  detail(u: User, id: string) {
    const r = this.store.get<SurveyResponse>("survey_response", id);
    ensure(r, 404, "NOT_FOUND", "答卷不存在");
    const s = this.get(u, r.surveyId);
    ensure(
      u.role === "teacher" || r.studentId === u.id,
      403,
      "FORBIDDEN",
      "无权访问他人答卷",
    );
    return { survey: s, response: r };
  }
  members(u: User, c: string) {
    this.teacher(u, c);
    return this.store
      .all<Member>("member")
      .filter((m) => m.classId === c)
      .map((m) => ({
        studentId: m.studentId,
        studentNumber: this.identity(m.studentId),
        studentName:
          this.store.get<User>("user", m.studentId)?.displayName ?? "",
      }));
  }
  stats(u: User, id: string): SurveyStats {
    const s = this.get(u, id);
    this.teacher(u, s.classId);
    const responses = this.store
      .all<SurveyResponse>("survey_response")
      .filter((r) => r.surveyId === id);
    const done = responses.filter((r) => r.submittedAt);
    return {
      survey: s,
      students: this.members(u, s.classId).map((m) => {
        const r = responses.find((r) => r.studentId === m.studentId);
        return {
          ...m,
          status: r?.submittedAt ? "已提交" : r ? "作答中" : "未开始",
          responseId: r?.submittedAt ? r.id : null,
        };
      }),
      questions: s.questions.map((q) => ({
        id: q.id,
        title: q.title,
        type: q.type,
        answered: done.filter((r) => {
          const v = r.answers[q.id];
          return Array.isArray(v) ? v.length > 0 : !!v?.trim();
        }).length,
        counts: q.options.map((name) => ({
          name,
          value: done.filter((r) => {
            const v = r.answers[q.id];
            return Array.isArray(v) ? v.includes(name) : v === name;
          }).length,
        })),
        texts:
          q.type === "text"
            ? done
                .map((r) => r.answers[q.id])
                .filter((x): x is string => typeof x === "string" && !!x.trim())
            : [],
      })),
    };
  }
  inspectRows(rows: RosterRow[]) {
    const errors: string[] = [];
    const seen = new Set<string>();
    rows.forEach((r, i) => {
      if (
        !/^[a-zA-Z0-9_.@-]{3,100}$/.test(r.studentNumber) ||
        /^[+-]?\d+(?:\.\d+)?[eE][+-]?\d+$/.test(r.studentNumber)
      )
        errors.push(
          `第${i + 1}行：学号缺失、格式无效或疑似科学计数法，请核对原始文本`,
        );
      if (!r.displayName) errors.push(`第${i + 1}行：姓名缺失`);
      if (seen.has(r.studentNumber)) errors.push(`第${i + 1}行：学号重复`);
      seen.add(r.studentNumber);
      const a = this.store.get<Account>("account", r.studentNumber);
      if (
        a &&
        (a.user.role !== "student" || a.user.displayName !== r.displayName)
      )
        errors.push(`第${i + 1}行：学号已存在但姓名或角色不一致`);
      const identity = this.store.get<{ userId: string; displayName: string }>(
        "student_identity",
        r.studentNumber,
      );
      if (
        identity &&
        (!a ||
          identity.userId !== a.user.id ||
          identity.displayName !== r.displayName)
      )
        errors.push(`第${i + 1}行：学号身份记录冲突`);
    });
    return errors;
  }
  previewRoster(u: User, c: string, raw: unknown) {
    this.teacher(u, c);
    const rows = rowsSchema.parse(raw);
    const p: RosterPlan & { actorId: string } = {
      id: randomUUID(),
      classId: c,
      actorId: u.id,
      rows,
      errors: this.inspectRows(rows),
      expiresAt: this.core.now() + 30 * 60000,
      fingerprint: digest(rows),
    };
    this.store.put("survey_roster_plan", p.id, p);
    return p;
  }
  async commitRoster(u: User, c: string, planId: string, fingerprint: string) {
    this.teacher(u, c);
    const p = this.store.get<RosterPlan & { actorId: string }>(
      "survey_roster_plan",
      planId,
    );
    ensure(
      p &&
        p.actorId === u.id &&
        p.classId === c &&
        p.fingerprint === fingerprint,
      409,
      "INVALID_PLAN",
      "预览不匹配，请重新预览",
    );
    const receipt = this.store.get<{ imported: number }>(
      "survey_roster_receipt",
      p.id,
    );
    if (receipt) return receipt;
    ensure(this.core.now() < p.expiresAt, 409, "EXPIRED", "预览已过期");
    ensure(
      !this.inspectRows(p.rows).length,
      409,
      "ROSTER_CONFLICT",
      "名单有冲突，请修改后重新预览",
    );
    const auth = new LocalAuth(this.store);
    const prepared = new Map<string, Account>();
    for (const r of p.rows)
      if (!this.store.get("account", r.studentNumber))
        prepared.set(
          r.studentNumber,
          await auth.prepareImportedStudent(r.studentNumber, r.displayName),
        );
    return this.store.transaction(() => {
      this.teacher(u, c);
      const replay = this.store.get<{ imported: number }>(
        "survey_roster_receipt",
        p.id,
      );
      if (replay) return replay;
      ensure(
        this.core.now() < p.expiresAt && !this.inspectRows(p.rows).length,
        409,
        "ROSTER_CONFLICT",
        "名单已变化或过期，请重新预览",
      );
      for (const r of p.rows) {
        let a = this.store.get<Account>("account", r.studentNumber);
        if (!a) {
          a = prepared.get(r.studentNumber)!;
          auth.persistPrepared(a);
        }
        const id = keyFor(c, a.user.id);
        this.store.put("member", id, { id, classId: c, studentId: a.user.id });
        this.store.put("student_identity", r.studentNumber, {
          studentNumber: r.studentNumber,
          userId: a.user.id,
          displayName: r.displayName,
        });
      }
      const receipt = { imported: p.rows.length };
      this.store.put("survey_roster_receipt", p.id, receipt);
      return receipt;
    });
  }
}
