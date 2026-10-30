import { randomUUID, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { z } from "zod";
import type { Express, Response } from "express";
import type { User } from "../../shared/contracts.js";
import { LocalAuth, type Account } from "./auth.js";
import { Service, keyFor, type ClassRecord, type Member } from "./service.js";
import { ensure } from "./errors.js";
import { requireCohort } from "./cohorts.js";
type ManagedAccount = Account & { disabled?: boolean; version?: number };
type ManagedClass = ClassRecord & { adminVersion?: number };
const version = z.number().int().min(0),
  password = z
    .string()
    .min(12)
    .refine((p) => Buffer.byteLength(p) <= 72, "密码最多72字节");
export class AdminService {
  constructor(readonly core: Service) {}
  get store() {
    return this.core.store;
  }
  require(u: User) {
    ensure(
      u.role === "admin" &&
        this.store.get<User>("user", u.id)?.role === "admin",
      403,
      "FORBIDDEN",
      "仅管理员可操作",
    );
    ensure(
      !this.store.all<ManagedAccount>("account").find((a) => a.user.id === u.id)
        ?.disabled,
      403,
      "FORBIDDEN",
      "账号已停用",
    );
  }
  audit(u: User, action: string, targetId: string) {
    const id = randomUUID();
    const [objectId, memberId] = targetId.split(":");
    const label =
      this.store.get<User>("user", objectId)?.displayName ??
      this.store.get<ClassRecord>("class", objectId)?.name ??
      this.store.get<{ name: string }>("cohort", objectId)?.name ??
      targetId;
    const memberName = memberId
      ? this.store.get<User>("user", memberId)?.displayName
      : undefined;
    this.store.put("admin_audit", id, {
      id,
      actorId: u.id,
      actorName: u.displayName,
      action,
      targetId,
      targetName: memberName ? label + " / " + memberName : label,
      at: this.core.iso(),
    });
  }
  account(id: string) {
    const a = this.store
      .all<ManagedAccount>("account")
      .find((a) => a.user.id === id);
    ensure(a, 404, "NOT_FOUND", "账号不存在");
    return a;
  }
  publicAccount(a: ManagedAccount) {
    return {
      ...a.user,
      username: a.username,
      disabled: !!a.disabled,
      mustChangePassword: !!a.mustChangePassword,
      version: a.version ?? 0,
    };
  }
  accounts(u: User) {
    this.require(u);
    return this.store
      .all<ManagedAccount>("account")
      .map((a) => this.publicAccount(a));
  }
  classes(u: User) {
    this.require(u);
    return this.store.all<ManagedClass>("class").map((c) => ({
      id: c.id,
      name: c.name,
      teacherId: c.teacherId,
      teacherName:
        this.store.get<User>("user", c.teacherId)?.displayName ?? (c.teacherId?"教师不存在":"待教师选择"),
      cohortId: c.cohortId ?? null,
      version: c.adminVersion ?? 0,
      memberCount: this.store
        .all<Member>("member")
        .filter((m) => m.classId === c.id).length,
    }));
  }
  overview(u: User) {
    this.require(u);
    const accounts = this.accounts(u);
    return {
      users: accounts.length,
      teachers: accounts.filter((a) => a.role === "teacher").length,
      students: accounts.filter((a) => a.role === "student").length,
      disabled: accounts.filter((a) => a.disabled).length,
      classes: this.store.all("class").length,
      surveys: this.store.all("survey").length,
      responses: this.store
        .all<{ submittedAt: string | null }>("survey_response")
        .filter((r) => r.submittedAt).length,
    };
  }
  async create(u: User, raw: unknown) {
    this.require(u);
    const b = z
      .object({
        username: z.string().regex(/^[a-zA-Z0-9_.@-]{3,100}$/),
        displayName: z.string().trim().min(1).max(100),
        role: z.enum(["teacher", "student"]),
        password,
      })
      .strict()
      .parse(raw);
    const auth = new LocalAuth(this.store);
    const a = await auth.prepareUser(
      b.username,
      b.password,
      b.displayName,
      b.role,
    );
    a.mustChangePassword=true;
    return this.store.transaction(() => {
      this.require(u);
      auth.persistPrepared(a);
      if (b.role === "student") {
        ensure(
          !this.store.get("student_identity", b.username),
          409,
          "IDENTITY_CONFLICT",
          "学号已存在",
        );
        this.store.put("student_identity", b.username, {
          studentNumber: b.username,
          userId: a.user.id,
          displayName: b.displayName,
        });
      }
      this.audit(u, "create_account", a.user.id);
      return this.publicAccount(a);
    });
  }
  update(u: User, id: string, raw: unknown) {
    const b = z
      .object({
        displayName: z.string().trim().min(1).max(100),
        disabled: z.boolean(),
        expectedVersion: version,
      })
      .strict()
      .parse(raw);
    return this.store.transaction(() => {
      this.require(u);
      const a = this.account(id);
      this.core.checkVersion(a.version ?? 0, b.expectedVersion);
      ensure(
        a.user.role !== "admin",
        403,
        "ADMIN_PROTECTED",
        "管理员账号由本机受控工具维护",
      );
      a.user = { ...a.user, displayName: b.displayName };
      a.disabled = b.disabled;
      a.version = (a.version ?? 0) + 1;
      this.store.put("account", a.username, a);
      this.store.put("user", id, a.user);
      const identity = this.store.get<{
        userId: string;
        studentNumber: string;
        displayName: string;
      }>("student_identity", a.username);
      if (identity?.userId === id)
        this.store.put("student_identity", a.username, {
          ...identity,
          displayName: b.displayName,
        });
      if (b.disabled) this.bumpSessions(id);
      this.audit(u, b.disabled ? "disable_account" : "update_account", id);
      return this.publicAccount(a);
    });
  }
  // A per-user epoch invalidates all old tokens without exposing or enumerating token digests.
  bumpSessions(id: string) {
    this.store.put("session_epoch", id, {
      version:
        (this.store.get<{ version: number }>("session_epoch", id)?.version ??
          0) + 1,
    });
  }
  async reset(u: User, id: string, raw: unknown) {
    this.require(u);
    const b = z
      .object({ password, expectedVersion: version })
      .strict()
      .parse(raw);
    const hash = await bcrypt.hash(b.password, 12);
    return this.store.transaction(() => {
      this.require(u);
      const a = this.account(id);
      ensure(
        a.user.role !== "admin",
        403,
        "ADMIN_PROTECTED",
        "不能重置管理员账号",
      );
      this.core.checkVersion(a.version ?? 0, b.expectedVersion);
      a.passwordHash = hash;
      a.mustChangePassword = true;
      a.version = (a.version ?? 0) + 1;
      this.store.put("account", a.username, a);
      this.bumpSessions(id);
      this.audit(u, "reset_password", id);
      return this.publicAccount(a);
    });
  }
  teacher(id: string) {
    const a = this.account(id);
    ensure(
      a.user.role === "teacher" && !a.disabled,
      400,
      "INVALID_TEACHER",
      "请选择有效教师账号",
    );
    return a.user;
  }
  saveClass(u: User, raw: unknown, id?: string) {
    const b = z
      .object({
        name: z.string().trim().min(1).max(200),
        teacherId: z.string().min(1),
        cohortId: z.string().min(1).nullable().optional(),
        authorizeCohort: z.boolean().default(false),
        expectedVersion: version,
      })
      .strict()
      .parse(raw);
    return this.store.transaction(() => {
      this.require(u);
      this.teacher(b.teacherId);
      const old = id ? this.store.get<ManagedClass>("class", id) : undefined;
      ensure(!id || old, 404, "NOT_FOUND", "班级不存在");
      this.core.checkVersion(old?.adminVersion ?? 0, b.expectedVersion);
      const cohortId = old?.cohortId ?? b.cohortId;
      if (cohortId) {
        const cohort = requireCohort(this.store, cohortId);
        if (!cohort.teacherIds.includes(b.teacherId)) {
          ensure(
            b.authorizeCohort,
            400,
            "COHORT_FORBIDDEN",
            "该教师尚未获得此教学批次授权，请明确勾选授予批次资格",
          );
          cohort.teacherIds.push(b.teacherId);
          this.store.put("cohort", cohort.id, cohort);
          this.audit(
            u,
            "authorize_cohort_teacher",
            cohort.id + ":" + b.teacherId,
          );
        }
      }
      let joinCode = old?.joinCode;
      while (
        !joinCode ||
        (!old &&
          this.store
            .all<ClassRecord>("class")
            .some((c) => c.joinCode === joinCode))
      )
        joinCode = randomBytes(8).toString("hex").toUpperCase();
      const c: ManagedClass = {
        id: old?.id ?? randomUUID(),
        name: b.name,
        teacherId: b.teacherId,
        joinCode,
        ...(cohortId ? { cohortId } : {}),
        adminVersion: (old?.adminVersion ?? 0) + 1,
      };
      this.store.put("class", c.id, c);
      this.audit(u, old ? "update_class" : "create_class", c.id);
      return this.classes(u).find((x) => x.id === c.id);
    });
  }
  members(u: User, classId: string) {
    this.require(u);
    ensure(this.store.get("class", classId), 404, "NOT_FOUND", "班级不存在");
    return this.store
      .all<Member>("member")
      .filter((m) => m.classId === classId)
      .map((m) => this.publicAccount(this.account(m.studentId)));
  }
  membership(u: User, classId: string, studentId: string, add: boolean) {
    return this.store.transaction(() => {
      this.require(u);
      ensure(this.store.get("class", classId), 404, "NOT_FOUND", "班级不存在");
      const a = this.account(studentId);
      ensure(
        a.user.role === "student" && (!add || !a.disabled),
        400,
        "INVALID_STUDENT",
        "请选择有效学生账号",
      );
      const id = keyFor(classId, studentId);
      if (add) this.store.put("member", id, { id, classId, studentId });
      else this.store.remove("member", id);
      this.audit(
        u,
        add ? "enroll_student" : "unenroll_student",
        classId + ":" + studentId,
      );
      return { success: true };
    });
  }
}
export function adminRoutes(
  app: Express,
  core: Service,
  ok: (res: Response, data: unknown) => unknown,
) {
  const service = new AdminService(core),
    u = (r: Response): User => r.locals.user;
  const id = (v: unknown) => z.string().min(1).max(128).parse(v);
  app.get("/api/v1/admin/overview", (_q, r) => ok(r, service.overview(u(r))));
  app.get("/api/v1/admin/users", (q, r) => {
    const b = z
      .object({
        q: z.string().max(100).default(""),
        role: z.enum(["teacher", "student", "admin"]).optional(),
        page: z.coerce.number().int().min(1).default(1),
      })
      .parse(q.query);
    const rows = service
      .accounts(u(r))
      .filter(
        (a) =>
          (!b.role || a.role === b.role) &&
          [a.username, a.displayName].some((x) =>
            x.toLowerCase().includes(b.q.toLowerCase()),
          ),
      );
    ok(r, {
      items: rows.slice((b.page - 1) * 50, b.page * 50),
      total: rows.length,
      page: b.page,
    });
  });
  app.post("/api/v1/admin/users", async (q, r) =>
    ok(r, await service.create(u(r), q.body)),
  );
  app.put("/api/v1/admin/users/:id", (q, r) =>
    ok(r, service.update(u(r), id(q.params.id), q.body)),
  );
  app.post("/api/v1/admin/users/:id/reset-password", async (q, r) =>
    ok(r, await service.reset(u(r), id(q.params.id), q.body)),
  );
  app.get("/api/v1/admin/classes", (_q, r) => ok(r, service.classes(u(r))));
  app.post("/api/v1/admin/classes", (q, r) =>
    ok(r, service.saveClass(u(r), q.body)),
  );
  app.put("/api/v1/admin/classes/:id", (q, r) =>
    ok(r, service.saveClass(u(r), q.body, id(q.params.id))),
  );
  app.get("/api/v1/admin/classes/:id/members", (q, r) =>
    ok(r, service.members(u(r), id(q.params.id))),
  );
  app.put("/api/v1/admin/classes/:id/members/:studentId", (q, r) =>
    ok(
      r,
      service.membership(u(r), id(q.params.id), id(q.params.studentId), true),
    ),
  );
  app.delete("/api/v1/admin/classes/:id/members/:studentId", (q, r) =>
    ok(
      r,
      service.membership(u(r), id(q.params.id), id(q.params.studentId), false),
    ),
  );
  app.get("/api/v1/admin/audit", (_q, r) => {
    service.require(u(r));
    ok(
      r,
      core.store
        .all<{ at: string }>("admin_audit")
        .sort((a, b) => b.at.localeCompare(a.at))
        .slice(0, 100),
    );
  });
}
