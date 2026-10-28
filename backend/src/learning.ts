import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { User } from "../../shared/contracts.js";
import type {
  CourseMaterial,
  MaterialInput,
  ProfileDraft,
  ProfileInput,
  ProfileOverview,
} from "../../shared/learning.js";
import {
  PROFILE_QUESTIONS,
  PROFILE_SCHEMA_VERSION,
  profileFilled,
  readableProfile,
} from "../../shared/profile-schema.js";
import { Service, keyFor } from "./service.js";
import type { StudentIdentity } from "./roster.js";
import { ensure } from "./errors.js";
import { safeCsv } from "./csv.js";
import { version } from "./validation.js";

export const profileBody = z
  .object({
    schemaVersion: z.string().min(1).max(128),
    expectedVersion: version,
    answers: z.record(
      z.string(),
      z.union([
        z.string().max(4000),
        z.array(z.string()).max(20),
        z.record(z.string(), z.number().int().min(1).max(5)),
      ]),
    ),
    other: z.record(z.string(), z.string().max(4000)),
  })
  .strict();
export const materialBody = z
  .object({
    title: z.string().trim().min(1).max(200),
    content: z.string().trim().min(1).max(30000),
    expectedVersion: version,
  })
  .strict();
export function validateProfile(input: ProfileInput): void {
  ensure(
    input.schemaVersion === PROFILE_SCHEMA_VERSION,
    409,
    "PROFILE_SCHEMA_CHANGED",
    "问卷版本已变化，请刷新后检查输入",
  );
  for (const [id, v] of Object.entries(input.answers)) {
    const q = PROFILE_QUESTIONS.find((q) => q.id === id);
    ensure(q?.type, 400, "INVALID_PROFILE", "包含未确认或未知题目");
    if (q.type === "text")
      ensure(
        typeof v === "string" && [...v].length <= 4000,
        400,
        "INVALID_PROFILE",
        "文本格式无效",
      );
    if (q.type === "matrix_scale") {
      ensure(
        v !== null && typeof v === "object" && !Array.isArray(v),
        400,
        "INVALID_PROFILE",
        "量表格式无效",
      );
      for (const [row, n] of Object.entries(v))
        ensure(
          q.rows?.some((r) => r.id === row) &&
            Number.isInteger(n) &&
            Number(n) >= 1 &&
            Number(n) <= 5,
          400,
          "INVALID_PROFILE",
          "量表项目或取值无效",
        );
    }
    if (q.type === "multiple_choice")
      ensure(
        Array.isArray(v) &&
          new Set(v).size === v.length &&
          v.every((c) => q.choices?.some((x) => x.id === c)),
        400,
        "INVALID_PROFILE",
        "选项无效或重复",
      );
  }
  for (const [id, text] of Object.entries(input.other))
    ensure(
      ["profile-14", "profile-16"].includes(id) &&
        typeof text === "string" &&
        [...text].length <= 4000,
      400,
      "INVALID_PROFILE",
      "补充文本无效",
    );
}
export class LearningService {
  constructor(readonly core: Service) {}
  get store() {
    return this.core.store;
  }
  private teacher(user: User, classId: string) {
    this.core.role(user, "teacher");
    this.core.classAccess(user, classId);
  }
  myProfile(user: User, classId: string): ProfileDraft | null {
    this.core.role(user, "student");
    this.core.classAccess(user, classId);
    return (
      this.store.get<ProfileDraft>(
        "learning_profile",
        keyFor(classId, user.id),
      ) ?? null
    );
  }
  saveProfile(user: User, classId: string, input: ProfileInput): ProfileDraft {
    this.core.role(user, "student");
    this.core.classAccess(user, classId);
    validateProfile(input);
    return this.store.transaction(() => {
      const old = this.myProfile(user, classId);
      this.core.checkVersion(old?.version ?? 0, input.expectedVersion);
      const draft: ProfileDraft = {
        id: keyFor(classId, user.id),
        classId,
        studentId: user.id,
        schemaVersion: PROFILE_SCHEMA_VERSION,
        answers: input.answers,
        other: input.other,
        version: (old?.version ?? 0) + 1,
        updatedAt: this.core.iso(),
      };
      this.store.put("learning_profile", draft.id, draft);
      return draft;
    });
  }
  profiles(user: User, classId: string): ProfileOverview[] {
    this.teacher(user, classId);
    return this.store
      .all<ProfileDraft>("learning_profile")
      .filter((d) => d.classId === classId)
      .map((d) => ({
        id: d.id,
        studentId: d.studentId,
        studentName:
          this.store.get<User>("user", d.studentId)?.displayName ?? "学生",
        studentNumber:
          this.store
            .all<StudentIdentity>("student_identity")
            .find((i) => i.userId === d.studentId)?.studentNumber ?? null,
        version: d.version,
        updatedAt: d.updatedAt,
        filledCount: PROFILE_QUESTIONS.filter(
          (q) => q.type && profileFilled(d.answers[q.id], d.other[q.id]),
        ).length,
      }));
  }
  profile(user: User, classId: string, studentId: string): ProfileDraft {
    this.teacher(user, classId);
    const d = this.store.get<ProfileDraft>(
      "learning_profile",
      keyFor(classId, studentId),
    );
    ensure(
      d && d.classId === classId && d.studentId === studentId,
      404,
      "NOT_FOUND",
      "画像草稿不存在",
    );
    return d;
  }
  exportProfiles(user: User, classId: string): string {
    const rows = this.profiles(user, classId);
    return safeCsv([
      [
        "学号",
        "姓名",
        "草稿版本",
        "保存时间",
        ...readableProfile({}, {}).map((q) => q.label),
      ],
      ...rows.map((row) => {
        const d = this.profile(user, classId, row.studentId);
        return [
          row.studentNumber ?? "",
          row.studentName,
          row.version,
          row.updatedAt,
          ...readableProfile(d.answers, d.other).map((q) => q.value),
        ];
      }),
    ]);
  }
  materials(user: User, classId: string): CourseMaterial[] {
    this.core.classAccess(user, classId);
    return this.store
      .all<CourseMaterial>("course_material")
      .filter(
        (m) =>
          m.classId === classId &&
          (user.role === "teacher" || m.state === "published"),
      );
  }
  material(user: User, id: string): CourseMaterial {
    const m = this.store.get<CourseMaterial>("course_material", id);
    ensure(m, 404, "NOT_FOUND", "课程材料不存在");
    this.core.classAccess(user, m.classId);
    ensure(
      user.role === "teacher" || m.state === "published",
      404,
      "NOT_FOUND",
      "课程材料尚未发布",
    );
    return m;
  }
  saveMaterial(
    user: User,
    classId: string,
    input: MaterialInput,
    id?: string,
  ): CourseMaterial {
    this.teacher(user, classId);
    return this.store.transaction(() => {
      const old = id ? this.material(user, id) : null;
      ensure(
        !old || old.classId === classId,
        400,
        "INVALID_MATERIAL",
        "材料班级不一致",
      );
      ensure(
        !old || old.state === "draft",
        409,
        "MATERIAL_LOCKED",
        "已发布材料只读，请新建修订材料",
      );
      this.core.checkVersion(old?.version ?? 0, input.expectedVersion);
      const m: CourseMaterial = {
        id: old?.id ?? randomUUID(),
        classId,
        title: input.title,
        content: input.content,
        state: "draft",
        version: (old?.version ?? 0) + 1,
        updatedAt: this.core.iso(),
      };
      this.store.put("course_material", m.id, m);
      return m;
    });
  }
  publishMaterial(
    user: User,
    id: string,
    expectedVersion: number,
  ): CourseMaterial {
    return this.store.transaction(() => {
      const m = this.material(user, id);
      this.teacher(user, m.classId);
      this.core.checkVersion(m.version, expectedVersion);
      ensure(m.state === "draft", 409, "MATERIAL_LOCKED", "材料已经发布");
      m.state = "published";
      m.version++;
      m.updatedAt = this.core.iso();
      this.store.put("course_material", id, m);
      return m;
    });
  }
}
