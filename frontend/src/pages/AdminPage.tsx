import { useEffect, useRef, useState } from "react";
import { apiRequest as req } from "../services/httpClient";
import { getCurrentUser, clearSession, api } from "../services/api";
import "./admin.css";
interface Account {
  id: string;
  username: string;
  displayName: string;
  role: string;
  disabled: boolean;
  version: number;
}
interface Class {
  id: string;
  name: string;
  teacherId: string;
  teacherName: string;
  cohortId: string | null;
  memberCount: number;
  version: number;
}
const msg = (e: unknown) => (e instanceof Error ? e.message : "操作失败");
const auditLabels: Record<string, string> = {
  "api.configure": "配置API",
  "server.configure": "配置服务器",
  create_account: "创建账号",
  update_account: "更新账号",
  disable_account: "停用账号",
  reset_password: "重置密码",
  create_class: "创建班级",
  update_class: "调整班级",
  enroll_student: "添加班级成员",
  unenroll_student: "移出班级成员",
  authorize_cohort_teacher: "授予教学批次资格",
};
export function AdminConsole({ embedded=false, activeTab, onTabChange }: { embedded?:boolean;activeTab?:string;onTabChange?:(tab:string)=>void } = {}) {
  const [localTab, setLocalTab] = useState("overview"),
    [summary, setSummary] = useState<Record<string, number>>({}),
    [users, setUsers] = useState<Account[]>([]),
    [total, setTotal] = useState(0),
    [page, setPage] = useState(1),
    [query, setQuery] = useState(""),
    [search, setSearch] = useState(""),
    [role, setRole] = useState(""),
    [classes, setClasses] = useState<Class[]>([]),
    [teachers, setTeachers] = useState<Account[]>([]),
    [students, setStudents] = useState<Account[]>([]),
    [classId, setClassId] = useState(""),
    [members, setMembers] = useState<Account[]>([]),
    [studentId, setStudentId] = useState(""),
    [audit, setAudit] = useState<
      Array<{
        id: string;
        actorName: string;
        action: string;
        targetId: string;
        targetName?: string;
        at: string;
      }>
    >([]),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [edit, setEdit] = useState<Account | null>(null),
    [form, setForm] = useState({
      username: "",
      displayName: "",
      role: "teacher",
      password: "",
    }),
    [reset, setReset] = useState(""),
    [classEdit, setClassEdit] = useState<Class | null>(null),
    [className, setClassName] = useState(""),
    [teacherId, setTeacherId] = useState(""),
    [authorizeCohort, setAuthorizeCohort] = useState(false);
  const tab=activeTab??localTab, setTab=onTabChange??setLocalTab;
  const loadSequence = useRef(0);
  const selectedClassRef = useRef(classId);
  selectedClassRef.current = classId;
  const current = getCurrentUser();
  async function all(role: string) {
    const result: Account[] = [];
    let page = 1;
    while (true) {
      const r = await req<{ items: Account[]; total: number }>(
        "GET",
        `/admin/users?role=${role}&page=${page}`,
      );
      result.push(...r.items);
      if (result.length >= r.total) return result;
      page++;
    }
  }
  async function load() {
    const sequence = ++loadSequence.current;
    const [s, u, c, t, st, a] = await Promise.all([
      req<Record<string, number>>("GET", "/admin/overview"),
      req<{ items: Account[]; total: number }>(
        "GET",
        `/admin/users?page=${page}&q=${encodeURIComponent(search)}${role ? "&role=" + role : ""}`,
      ),
      embedded?Promise.resolve([]):req<Class[]>("GET", "/admin/classes"),
      embedded?Promise.resolve([]):all("teacher"),
      embedded?Promise.resolve([]):all("student"),
      req<typeof audit>("GET", "/admin/audit"),
    ]);
    if (sequence !== loadSequence.current) return;
    setSummary(s);
    setUsers(u.items);
    setTotal(u.total);
    setClasses(c);
    setTeachers(t);
    setStudents(st);
    setAudit(a);
    setClassId((id) => id || c[0]?.id || "");
  }
  useEffect(() => {
    let active = true;
    setError("");
    load().catch((e) => {
      if (active) setError(msg(e));
    });
    return () => {
      active = false;
    };
  }, [page, search, role]);
  useEffect(() => {
    setMembers([]);
    if (!classId) return;
    let active = true;
    req<Account[]>("GET", `/admin/classes/${classId}/members`)
      .then((m) => {
        if (active) setMembers(m);
      })
      .catch((e) => {
        if (active) setError(msg(e));
      });
    return () => {
      active = false;
    };
  }, [classId]);
  async function run(fn: () => Promise<unknown>, text: string) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await fn();
      await load();
      const selected = selectedClassRef.current;
      if (selected) {
        const latest = await req<Account[]>(
          "GET",
          `/admin/classes/${selected}/members`,
        );
        if (selectedClassRef.current === selected) setMembers(latest);
      }
      setNotice(text);
    } catch (e) {
      setError(msg(e));
    } finally {
      setBusy(false);
    }
  }
  if (current?.role !== "admin")
    return (
      <main className="admin-shell">
        <h1>仅管理员可访问</h1>
        <a href="/login">返回登录</a>
      </main>
    );
  return (
    <div className={"admin-shell"+(embedded?" admin-embedded":"")}>
      <aside className="admin-nav">
        <h2>学习空间</h2>
        <p>独立管理中心</p>
        <nav>
          {[
            ["overview", "全局概览"],
            ["users", "账号与教师"],
            ["classes", "班级与成员"],
            ["audit", "操作日志"],
          ].map(([id, label]) => (
            <button
              className={tab === id ? "active" : ""}
              key={id}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </nav>
        <small>{current.displayName} · 管理员</small>
        <button
          onClick={async () => {
            try {
              await api.logout();
            } finally {
              clearSession();
              location.assign("/login");
            }
          }}
        >
          退出登录
        </button>
      </aside>
      <main>
        <header>
          <div>
            <p>ADMINISTRATION</p>
            <h1>
              {
                (
                  {
                    overview: "全局概览",
                    users: "账号与教师",
                    classes: "班级与成员",
                    audit: "操作日志",
                  } as Record<string, string>
                )[tab]
              }
            </h1>
          </div>
          <button disabled={busy} onClick={() => run(async () => {}, "已刷新")}>
            刷新数据
          </button>
        </header>
        {error && (
          <p role="alert" className="admin-error">
            {error}
          </p>
        )}
        {notice && (
          <p role="status" className="admin-success">
            {notice}
          </p>
        )}
        {tab === "overview" && (
          <>
            <div className="admin-metrics">
              {[
                ["users", "全部账号"],
                ["teachers", "教师"],
                ["students", "学生"],
                ["disabled", "已停用"],
                ...(!embedded?[["classes", "班级"],["surveys", "问卷"],["responses", "已提交答卷"]]:[]),
              ].map(([key, label]) => (
                <article key={key}>
                  <span>{label}</span>
                  <strong>{summary[key] ?? "—"}</strong>
                </article>
              ))}
            </div>
            <section>
              <h2>管理范围</h2>
              <p>
                {embedded?"统一查找和维护平台账户。课程、问卷和教学统计继续留在师生端。停用或重置密码会撤销原登录。":"统一创建与维护师生账号、分配授课教师、调整班级成员。停用账号或重置密码会使原会话失效。"}
              </p>
              <p>
                管理员账号由本机受控命令维护；此页面不开放自助注册、提权或删除历史答卷。
              </p>
              <div className="admin-actions">
                <button onClick={() => setTab("users")}>管理账号</button>
                {!embedded&&<button onClick={() => setTab("classes")}>管理班级</button>}
              </div>
            </section>
          </>
        )}
        {tab === "users" && (
          <>
            <section>
              <h2>创建师生账号</h2>
              <form
                className="admin-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  void run(async () => {
                    await req("POST", "/admin/users", { body: form });
                    setForm({
                      username: "",
                      displayName: "",
                      role: "teacher",
                      password: "",
                    });
                  }, "账号已创建");
                }}
              >
                <label>
                  账号 / 学号
                  <input
                    required
                    value={form.username}
                    onChange={(e) =>
                      setForm({ ...form, username: e.target.value })
                    }
                  />
                </label>
                <label>
                  姓名
                  <input
                    required
                    value={form.displayName}
                    onChange={(e) =>
                      setForm({ ...form, displayName: e.target.value })
                    }
                  />
                </label>
                <label>
                  角色
                  <select
                    aria-label="新账号角色"
                    value={form.role}
                    onChange={(e) => setForm({ ...form, role: e.target.value })}
                  >
                    <option value="teacher">教师</option>
                    <option value="student">学生</option>
                  </select>
                </label>
                <label>
                  初始密码（至少12字符）
                  <input
                    type="password"
                    autoComplete="new-password"
                    minLength={12}
                    required
                    value={form.password}
                    onChange={(e) =>
                      setForm({ ...form, password: e.target.value })
                    }
                  />
                </label>
                <button disabled={busy}>创建账号</button>
              </form>
            </section>
            {edit && (
              <section>
                <h2>维护账号 · {edit.username}</h2>
                <form
                  className="admin-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void run(async () => {
                      await req("PUT", `/admin/users/${edit.id}`, {
                        body: {
                          displayName: edit.displayName,
                          disabled: edit.disabled,
                          expectedVersion: edit.version,
                        },
                      });
                      setEdit(null);
                    }, "账号资料已更新");
                  }}
                >
                  <label>
                    姓名
                    <input
                      required
                      value={edit.displayName}
                      onChange={(e) =>
                        setEdit({ ...edit, displayName: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    状态
                    <select
                      aria-label="账号状态"
                      value={String(edit.disabled)}
                      onChange={(e) =>
                        setEdit({
                          ...edit,
                          disabled: e.target.value === "true",
                        })
                      }
                    >
                      <option value="false">启用</option>
                      <option value="true">停用并使原会话失效</option>
                    </select>
                  </label>
                  <button disabled={busy}>保存资料</button>
                  <button type="button" onClick={() => setEdit(null)}>
                    取消
                  </button>
                </form>
                <form
                  className="admin-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void run(async () => {
                      await req(
                        "POST",
                        `/admin/users/${edit.id}/reset-password`,
                        {
                          body: {
                            password: reset,
                            expectedVersion: edit.version,
                          },
                        },
                      );
                      setReset("");
                      setEdit(null);
                    }, "密码已重置，原登录会话已失效");
                  }}
                >
                  <label>
                    重置为新密码（至少12字符）
                    <input
                      type="password"
                      minLength={12}
                      autoComplete="new-password"
                      required
                      value={reset}
                      onChange={(e) => setReset(e.target.value)}
                    />
                  </label>
                  <button disabled={busy}>确认重置密码</button>
                </form>
              </section>
            )}
            <section>
              <form
                className="admin-actions"
                onSubmit={(e) => {
                  e.preventDefault();
                  setPage(1);
                  setSearch(query);
                }}
              >
                <input
                  aria-label="搜索账号或姓名"
                  placeholder="搜索账号 / 姓名"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                <select
                  aria-label="筛选角色"
                  value={role}
                  onChange={(e) => {
                    setRole(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">全部角色</option>
                  <option value="teacher">教师</option>
                  <option value="student">学生</option>
                  <option value="admin">管理员</option>
                </select>
                <button>搜索</button>
              </form>
              <div className="admin-table">
                <table>
                  <thead>
                    <tr>
                      <th>账号</th>
                      <th>姓名</th>
                      <th>角色</th>
                      <th>状态</th>
                      <th>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.id}>
                        <td>{u.username}</td>
                        <td>{u.displayName}</td>
                        <td>
                          {u.role === "teacher"
                            ? "教师"
                            : u.role === "student"
                              ? "学生"
                              : "管理员"}
                        </td>
                        <td>{u.disabled ? "已停用" : "启用"}</td>
                        <td>
                          <button
                            disabled={u.role === "admin" || busy}
                            onClick={() => {
                              setEdit(u);
                              setReset("");
                            }}
                          >
                            维护账号
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="admin-actions">
                <button
                  disabled={page === 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  上一页
                </button>
                <span>
                  第 {page} 页 · 共 {total} 个账号
                </span>
                <button
                  disabled={page * 50 >= total}
                  onClick={() => setPage((p) => p + 1)}
                >
                  下一页
                </button>
              </div>
            </section>
          </>
        )}
        {tab === "classes" && (
          <>
            <section>
              <h2>{classEdit ? "调整班级与授课教师" : "创建班级"}</h2>
              <form
                className="admin-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  void run(async () => {
                    const saved = await req<Class>(
                      classEdit ? "PUT" : "POST",
                      "/admin/classes" + (classEdit ? "/" + classEdit.id : ""),
                      {
                        body: {
                          name: className,
                          teacherId,
                          authorizeCohort,
                          expectedVersion: classEdit?.version ?? 0,
                        },
                      },
                    );
                    selectedClassRef.current = saved.id;
                    setClassId(saved.id);
                    setClassEdit(null);
                    setClassName("");
                    setTeacherId("");
                  }, "班级已保存");
                }}
              >
                <label>
                  班级名称
                  <input
                    required
                    value={className}
                    onChange={(e) => setClassName(e.target.value)}
                  />
                </label>
                <label>
                  授课教师
                  <select
                    aria-label="授课教师"
                    required
                    value={teacherId}
                    onChange={(e) => setTeacherId(e.target.value)}
                  >
                    <option value="">选择教师</option>
                    {teachers
                      .filter((t) => !t.disabled)
                      .map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.displayName}（{t.username}）
                        </option>
                      ))}
                  </select>
                </label>
                {classEdit?.cohortId && (
                  <label>
                    <input
                      type="checkbox"
                      checked={authorizeCohort}
                      onChange={(e) => setAuthorizeCohort(e.target.checked)}
                    />
                    授予所选教师此班级所属教学批次资格
                  </label>
                )}
                <button disabled={busy}>保存班级</button>
                {classEdit && (
                  <button
                    type="button"
                    onClick={() => {
                      setClassEdit(null);
                      setClassName("");
                      setTeacherId("");
                    }}
                  >
                    取消编辑
                  </button>
                )}
              </form>
            </section>
            <section>
              <h2>全部班级</h2>
              <div className="admin-table">
                <table>
                  <thead>
                    <tr>
                      <th>班级</th>
                      <th>教师</th>
                      <th>人数</th>
                      <th>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {classes.map((c) => (
                      <tr key={c.id}>
                        <td>{c.name}</td>
                        <td>{c.teacherName}</td>
                        <td>{c.memberCount}</td>
                        <td>
                          <button
                            onClick={() => {
                              setClassEdit(c);
                              setAuthorizeCohort(false);
                              setClassName(c.name);
                              setTeacherId(c.teacherId);
                            }}
                          >
                            编辑班级
                          </button>{" "}
                          <button onClick={() => setClassId(c.id)}>
                            查看成员
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
            <section>
              <h2>班级成员</h2>
              <label>
                当前管理班级
                <select
                  aria-label="当前管理班级"
                  value={classId}
                  onChange={(e) => setClassId(e.target.value)}
                >
                  <option value="">选择班级</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <form
                className="admin-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  void run(
                    () =>
                      req(
                        "PUT",
                        `/admin/classes/${classId}/members/${studentId}`,
                      ),
                    "学生已加入班级",
                  );
                }}
              >
                <label>
                  添加已存在的学生
                  <select
                    aria-label="添加学生"
                    required
                    value={studentId}
                    onChange={(e) => setStudentId(e.target.value)}
                  >
                    <option value="">选择学生账号</option>
                    {students
                      .filter(
                        (s) =>
                          !s.disabled && !members.some((m) => m.id === s.id),
                      )
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.username} · {s.displayName}
                        </option>
                      ))}
                  </select>
                </label>
                <button disabled={busy || !classId}>添加到班级</button>
              </form>
              <div className="admin-table">
                <table>
                  <thead>
                    <tr>
                      <th>学号</th>
                      <th>姓名</th>
                      <th>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {members.map((m) => (
                      <tr key={m.id}>
                        <td>{m.username}</td>
                        <td>{m.displayName}</td>
                        <td>
                          <button
                            disabled={busy}
                            onClick={() => {
                              if (
                                confirm(
                                  `确认将 ${m.displayName} 移出此班级？历史答卷保留。`,
                                )
                              )
                                void run(
                                  () =>
                                    req(
                                      "DELETE",
                                      `/admin/classes/${classId}/members/${m.id}`,
                                    ),
                                  "已移出班级，历史答卷保留",
                                );
                            }}
                          >
                            移出班级
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
        {tab === "audit" && (
          <section>
            <h2>最近100条管理操作</h2>
            <p>记录操作人、动作、对象和时间，不记录密码或访问令牌。</p>
            <div className="admin-table">
              <table>
                <thead>
                  <tr>
                    <th>时间</th>
                    <th>管理员</th>
                    <th>动作</th>
                    <th>操作对象</th>
                  </tr>
                </thead>
                <tbody>
                  {audit.map((a) => (
                    <tr key={a.id}>
                      <td>{new Date(a.at).toLocaleString()}</td>
                      <td>{a.actorName}</td>
                      <td>{auditLabels[a.action] ?? a.action}</td>
                      <td title={a.targetId}>{a.targetName ?? a.targetId}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
