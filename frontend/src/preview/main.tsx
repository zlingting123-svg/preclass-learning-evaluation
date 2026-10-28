import { askCourse } from "../services/courseAi";
import { AiStatusPanel } from "../components/ai/AiStatus";
import { createRoot } from "react-dom/client";
import { useEffect, useRef, useState } from "react";
import {
  MemoryRouter,
  Routes,
  Route,
  Link,
  useNavigate,
  useLocation,
} from "react-router-dom";
import type { ClassInfo, Page, User } from "@shared/contracts";
import type { Survey } from "@shared/questionnaires";
import {
  api,
  setSession,
  getCurrentUser,
  clearSession,
  setUnauthorizedHandler,
} from "../services/api";
import { apiRequest as request } from "../services/httpClient";
import {
  RosterPage,
  SurveyEditor,
  SurveyAnswer,
  SurveyResults,
  ResponseDetail,
} from "../pages/Core";
import "../styles/index.css";
import "../styles/learning.css";
import "./preview.css";

type IconName =
  | "spark"
  | "grid"
  | "book"
  | "chat"
  | "users"
  | "arrow"
  | "plus"
  | "send"
  | "menu"
  | "close"
  | "exit"
  | "check"
  | "retry"
  | "stop";
function Icon({
  name,
  className = "",
}: {
  name: IconName;
  className?: string;
}) {
  const shapes: Record<IconName, React.ReactNode> = {
    spark: (
      <>
        <path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z" />
        <path d="m20 2 .7 1.3L22 4l-1.3.7L20 6l-.7-1.3L18 4l1.3-.7Z" />
      </>
    ),
    grid: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="2" />
        <rect x="14" y="3" width="7" height="7" rx="2" />
        <rect x="3" y="14" width="7" height="7" rx="2" />
        <rect x="14" y="14" width="7" height="7" rx="2" />
      </>
    ),
    book: (
      <>
        <path d="M4 4h6a3 3 0 0 1 2 1 3 3 0 0 1 2-1h6v15h-6a3 3 0 0 0-2 1 3 3 0 0 0-2-1H4Z" />
        <path d="M12 5v15" />
      </>
    ),
    chat: <path d="M21 11a8 8 0 0 1-8 8H7l-4 3V11a9 9 0 0 1 18 0Z" />,
    users: (
      <>
        <circle cx="9" cy="8" r="3" />
        <path d="M3 21v-3a6 6 0 0 1 12 0v3M17 5a3 3 0 0 1 0 6M21 21v-3a6 6 0 0 0-3-5" />
      </>
    ),
    arrow: <path d="M5 12h14m-6-6 6 6-6 6" />,
    plus: <path d="M12 5v14M5 12h14" />,
    send: <path d="M12 20V4m-7 7 7-7 7 7" />,
    menu: <path d="M4 6h16M4 12h16M4 18h16" />,
    close: <path d="m6 6 12 12M6 18 18 6" />,
    exit: (
      <>
        <path d="M10 4H4v16h6M9 12h12m-5-5 5 5-5 5" />
      </>
    ),
    check: <path d="m5 12 4 4L20 5" />,
    retry: <path d="M20 9A8 8 0 1 0 20 16M20 3v6h-6" />,
    stop: <rect x="6" y="6" width="12" height="12" rx="2" />,
  };
  return (
    <svg
      className={`pv-icon ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {shapes[name]}
    </svg>
  );
}
const errorText = (e: unknown) =>
  e instanceof Error ? e.message : "操作失败，请重试";
async function readClasses() {
  const result: ClassInfo[] = [];
  let cursor: string | null = null;
  do {
    const p: Page<ClassInfo> = await request(
      "GET",
      "/classes?limit=100" +
        (cursor ? "&cursor=" + encodeURIComponent(cursor) : ""),
    );
    result.push(...p.items);
    cursor = p.nextCursor;
  } while (cursor);
  return result;
}

function Preview() {
  const [user, setUser] = useState<User | null>(getCurrentUser()),
    [theme, setTheme] = useState("violet");
  useEffect(() => {
    setUnauthorizedHandler(() => {
      clearSession();
      setUser(null);
    });
    return () => setUnauthorizedHandler(null);
  }, []);
  return (
    <div className="studio" data-theme={theme}>
      {user ? (
        <MemoryRouter>
          <Workspace
            user={user}
            theme={theme}
            setTheme={setTheme}
            logout={() => {
              void api.logout().catch(() => {});
              clearSession();
              setUser(null);
            }}
          />
        </MemoryRouter>
      ) : (
        <PreviewLogin done={setUser} />
      )}
    </div>
  );
}
function PreviewLogin({ done }: { done: (u: User) => void }) {
  const [username, setUsername] = useState(""),
    [password, setPassword] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function login(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const s = await api.login({ username, password });
      setSession(s);
      done(s.user);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="pv-login">
      <aside>
        <div className="pv-brand">
          <span className="pv-brand-icon">
            <Icon name="spark" />
          </span>
          学习空间<span className="pv-beta">DESIGN PREVIEW</span>
        </div>
        <div className="pv-login-story">
          <p className="pv-eyebrow">ENVIRONMENTAL LEARNING SPACE</p>
          <h1>
            让每一次思考，
            <br />
            连接更多可能。
          </h1>
          <p>
            班级、问卷与课程对话。
            <br />
            在一个清晰、有序的空间里开展学习。
          </p>
          <div className="pv-login-features">
            <span>
              <Icon name="users" />
              班级协同
            </span>
            <span>
              <Icon name="book" />
              问卷洞察
            </span>
            <span>
              <Icon name="spark" />
              AI 课程助手
            </span>
          </div>
        </div>
        <p className="pv-small">独立外观预览 · 保留原有业务与权限</p>
      </aside>
      <main>
        <div className="pv-login-form">
          <span className="pv-eyebrow">WELCOME BACK</span>
          <h2>欢迎回到学习空间</h2>
          <p className="pv-muted">登录你的班级，继续今天的学习。</p>
          <form onSubmit={login}>
            <label>
              学号 / 教师账号
              <input
                autoComplete="username"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </label>
            <label>
              密码
              <input
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            {error && (
              <p role="alert" className="pv-error">
                {error}
              </p>
            )}
            <button className="pv-primary pv-wide" disabled={busy}>
              {busy ? "正在登录…" : "进入学习空间"}
              <Icon name="arrow" />
            </button>
          </form>
          <a className="pv-original" href="/">
            返回当前版本
          </a>
        </div>
      </main>
    </div>
  );
}

function Workspace({
  user,
  theme,
  setTheme,
  logout,
}: {
  user: User;
  theme: string;
  setTheme: (s: string) => void;
  logout: () => void;
}) {
  const [classes, setClasses] = useState<ClassInfo[]>([]),
    [classId, setClassId] = useState(""),
    [error, setError] = useState(""),
    [mobile, setMobile] = useState(false);
  const navigate = useNavigate(),
    location = useLocation();
  const teacher = user.role === "teacher";
  const selected = classes.find((c) => c.id === classId);
  const chat = location.pathname === "/assistant";
  useEffect(() => {
    readClasses()
      .then((c) => {
        setClasses(c);
        setClassId(c[0]?.id ?? "");
      })
      .catch((e) => setError(errorText(e)));
  }, []);
  useEffect(() => setMobile(false), [location.pathname]);
  return (
    <div className={`pv-workspace ${chat ? "pv-chat-workspace" : ""}`}>
      <aside
        className={`pv-sidebar ${mobile ? "is-open" : ""}`}
        aria-label="工作空间导航"
      >
        <Link className="pv-brand" to="/">
          <span className="pv-brand-icon">
            <Icon name="spark" />
          </span>
          学习空间
        </Link>
        <div className="pv-space-name">
          <span className="pv-course-icon">环</span>
          <div>
            <strong>环境评价与管理</strong>
            <small>{teacher ? "教师工作空间" : "学生学习空间"}</small>
          </div>
        </div>
        <p className="pv-nav-label">WORKSPACE</p>
        <nav>
          {[
            ["/", "grid", teacher ? "班级工作台" : "我的班级"],
            ["/questionnaires", "book", "问卷与统计"],
            ["/assistant", "spark", "AI 问答助手"],
            ...(teacher && classId
              ? [[`/core/classes/${classId}/roster`, "users", "班级成员"]]
              : []),
          ].map(([path, icon, label]) => (
            <Link
              key={path}
              aria-label={label}
              to={path}
              className={location.pathname === path ? "is-active" : ""}
            >
              <Icon name={icon as IconName} />
              {label}
              {path === "/assistant" && <span className="pv-ai-tag">AI</span>}
            </Link>
          ))}
        </nav>
        <div className="pv-sidebar-tip">
          <Icon name="spark" />
          <strong>你的课程学习搭档</strong>
          <p>从一个好问题开始，让理解更进一步。</p>
          <button onClick={() => navigate("/assistant")}>
            开始课程对话 <Icon name="arrow" />
          </button>
          <small>服务状态见对话页</small>
        </div>
        <div className="pv-profile">
          <span className="pv-avatar">{user.displayName[0]}</span>
          <div>
            <strong>{user.displayName}</strong>
            <small>{teacher ? "教师账号" : "学生账号"} · 本机预览</small>
          </div>
          <button
            className="pv-icon-button"
            aria-label="退出登录"
            onClick={logout}
          >
            <Icon name="exit" />
          </button>
        </div>
      </aside>
      {mobile && (
        <button
          className="pv-overlay"
          aria-label="关闭导航"
          onClick={() => setMobile(false)}
        />
      )}
      <div className="pv-content">
        <header className="pv-topbar">
          <button
            className="pv-icon-button pv-mobile-nav"
            aria-label={mobile ? "关闭菜单" : "打开菜单"}
            onClick={() => setMobile(!mobile)}
          >
            <Icon name={mobile ? "close" : "menu"} />
          </button>
          <div className="pv-breadcrumb">
            工作空间 <span>/</span>{" "}
            <strong>
              {chat
                ? "AI 课程助手"
                : location.pathname === "/"
                  ? "班级概览"
                  : "课程问卷"}
            </strong>
          </div>
          <div className="pv-top-actions">
            <span className="pv-preview-badge">外观预览</span>
            <label className="pv-theme-picker">
              <span>外观</span>
              <select
                aria-label="预览外观"
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
              >
                <option value="violet">紫蓝商业</option>
                <option value="forest">深绿专业</option>
                <option value="graphite">石墨科技</option>
              </select>
            </label>
            <a href="/" className="pv-version-link">
              当前版本 ↗
            </a>
          </div>
        </header>
        {error && (
          <p role="alert" className="pv-error">
            {error}
          </p>
        )}
        <Routes>
          <Route
            path="/"
            element={
              <Dashboard
                user={user}
                classes={classes}
                classId={classId}
                setClassId={setClassId}
                setClasses={setClasses}
              />
            }
          />
          <Route
            path="/questionnaires"
            element={
              <Dashboard
                user={user}
                classes={classes}
                classId={classId}
                setClassId={setClassId}
                setClasses={setClasses}
                onlySurveys
              />
            }
          />
          <Route
            path="/assistant"
            element={
              classId ? (
                <Chat
                  key={classId}
                  classId={classId}
                  className={selected?.name ?? ""}
                />
              ) : (
                <div className="pv-page">
                  <h1>先加入一个班级</h1>
                  <p>课程助手需要班级上下文，请联系教师导入名单。</p>
                </div>
              )
            }
          />
          {teacher && (
            <>
              <Route
                path="/core/classes/:classId/roster"
                element={
                  <div className="pv-page pv-legacy">
                    <RosterPage />
                  </div>
                }
              />
              <Route
                path="/core/classes/:classId/new"
                element={
                  <div className="pv-page pv-legacy">
                    <SurveyEditor />
                  </div>
                }
              />
              <Route
                path="/core/surveys/:id/edit"
                element={
                  <div className="pv-page pv-legacy">
                    <SurveyEditor />
                  </div>
                }
              />
              <Route
                path="/core/surveys/:id/stats"
                element={
                  <div className="pv-page pv-legacy">
                    <SurveyResults />
                  </div>
                }
              />
            </>
          )}
          <Route
            path="/core/surveys/:id/answer"
            element={
              <div className="pv-page pv-legacy">
                <SurveyAnswer />
              </div>
            }
          />
          <Route
            path="/core/responses/:id"
            element={
              <div className="pv-page pv-legacy">
                <ResponseDetail />
              </div>
            }
          />
          <Route
            path="*"
            element={
              <div className="pv-page">
                <h1>页面暂不可用</h1>
                <Link to="/">返回班级</Link>
              </div>
            }
          />
        </Routes>
      </div>
    </div>
  );
}

function Dashboard({
  user,
  classes,
  classId,
  setClassId,
  setClasses,
  onlySurveys = false,
}: {
  user: User;
  classes: ClassInfo[];
  classId: string;
  setClassId: (s: string) => void;
  setClasses: React.Dispatch<React.SetStateAction<ClassInfo[]>>;
  onlySurveys?: boolean;
}) {
  const teacher = user.role === "teacher";
  const [surveys, setSurveys] = useState<Survey[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [create, setCreate] = useState(false),
    [name, setName] = useState(""),
    [busy, setBusy] = useState(false);
  const cls = classes.find((c) => c.id === classId);
  useEffect(() => {
    setSurveys([]);
    if (!classId) {
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    setError("");
    request<Survey[]>("GET", `/core/classes/${classId}/surveys`)
      .then((s) => {
        if (active) setSurveys(s);
      })
      .catch((e) => {
        if (active) setError(errorText(e));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [classId]);
  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const c = await request<ClassInfo>("POST", "/teacher/classes", {
        body: { name },
      });
      setClasses((v) => [...v, c]);
      setClassId(c.id);
      setCreate(false);
      setName("");
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="pv-page">
      <div className="pv-page-title">
        <div>
          <p className="pv-eyebrow">YOUR LEARNING WORKSPACE</p>
          <h1>
            {onlySurveys
              ? "问卷与统计"
              : teacher
                ? "教学工作台"
                : "欢迎回到你的学习空间"}
          </h1>
          <p className="pv-muted">
            {teacher
              ? "组织课堂，从容掌握每一次课前准备。"
              : "带着问题开始，带着新的理解走进课堂。"}
          </p>
        </div>
        {teacher && (
          <button className="pv-primary" onClick={() => setCreate((v) => !v)}>
            <Icon name="plus" />
            创建班级
          </button>
        )}
      </div>
      {create && (
        <form onSubmit={add} className="pv-create">
          <label>
            新班级名称
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={200}
            />
          </label>
          <button className="pv-primary" disabled={busy}>
            确认创建
          </button>
          <button type="button" onClick={() => setCreate(false)}>
            取消
          </button>
        </form>
      )}
      {error && (
        <p role="alert" className="pv-error">
          {error}
        </p>
      )}
      {!onlySurveys && (
        <div className="pv-welcome">
          <div>
            <span className="pv-welcome-tag">环境评价与管理 · 课程空间</span>
            <h2>
              {teacher
                ? "让每一次课前思考，\n都有迹可循。"
                : "每一个好问题，\n都是学习的开始。"}
            </h2>
            <p>管理问卷、了解课堂，让教与学更有连接。</p>
            <Link className="pv-light-button" to="/assistant">
              探索课程 AI 助手 <Icon name="arrow" />
            </Link>
          </div>
          <div className="pv-welcome-mark" aria-hidden="true">
            <Icon name="spark" />
          </div>
          <span className="pv-welcome-label">LEARNING, CONNECTED.</span>
        </div>
      )}
      <div className="pv-metrics">
        {[
          [
            "users",
            String(cls?.memberCount ?? 0),
            "班级学生",
            "来自当前班级名单",
          ],
          ["book", String(surveys.length), "课程问卷", "当前班级全部问卷"],
          [
            "check",
            String(surveys.filter((s) => s.state === "published").length),
            "已发布问卷",
            "已开放的学习任务",
          ],
        ].map(([icon, value, title, sub]) => (
          <article key={title}>
            <span className={`pv-metric-icon pv-${icon}`}>
              <Icon name={icon as IconName} />
            </span>
            <div>
              <p>{title}</p>
              <strong>{loading ? "—" : value}</strong>
              <small>{sub}</small>
            </div>
          </article>
        ))}
      </div>
      <div className="pv-dashboard-grid">
        <section className="pv-panel">
          <div className="pv-panel-heading">
            <div>
              <h2>{onlySurveys ? "全部问卷" : "班级问卷"}</h2>
              <p>在这里安排下一次课堂的起点。</p>
            </div>
            <span className="pv-counter">{surveys.length} 份</span>
          </div>
          <div className="pv-class-filter">
            <label htmlFor="pv-class">当前班级</label>
            <select
              id="pv-class"
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
            {teacher && classId && (
              <Link
                to={`/core/classes/${classId}/new`}
                className="pv-link-button"
              >
                <Icon name="plus" />
                布置问卷
              </Link>
            )}
          </div>
          {loading ? (
            <p className="pv-empty" role="status">
              正在加载问卷…
            </p>
          ) : !surveys.length ? (
            <div className="pv-empty">
              <Icon name="book" />
              <h3>为课堂准备第一份问卷</h3>
              <p>
                {teacher
                  ? "在线编辑或导入已有文件，确认后即可发布。"
                  : "老师发布后，问卷会显示在这里。"}
              </p>
            </div>
          ) : (
            <div className="pv-survey-list">
              {surveys.map((s) => (
                <article key={s.id} className="pv-survey-row">
                  <span className="pv-document-icon">
                    <Icon name="book" />
                  </span>
                  <div className="pv-survey-copy">
                    <h3>{s.title}</h3>
                    <p>
                      {s.questions.length} 道题 <span>·</span>{" "}
                      {s.durationMinutes
                        ? `${s.durationMinutes} 分钟`
                        : "不限时长"}{" "}
                      <span>·</span>{" "}
                      {s.deadlineAt
                        ? new Date(s.deadlineAt).toLocaleString()
                        : "无截止时间"}
                    </p>
                  </div>
                  <span className={`pv-state ${s.state}`}>
                    {s.state === "published"
                      ? "已发布"
                      : s.state === "draft"
                        ? "草稿"
                        : "已结束"}
                  </span>
                  <Link
                    className="pv-survey-link"
                    to={
                      teacher
                        ? `/core/surveys/${s.id}/${s.state === "draft" ? "edit" : "stats"}`
                        : `/core/surveys/${s.id}/answer`
                    }
                  >
                    {teacher
                      ? s.state === "draft"
                        ? "继续编辑"
                        : "查看统计"
                      : "进入问卷"}
                    <Icon name="arrow" />
                  </Link>
                </article>
              ))}
            </div>
          )}
        </section>
        <aside className="pv-right-column">
          <div className="pv-assistant-card">
            <span className="pv-ai-orb">
              <Icon name="spark" />
            </span>
            <span className="pv-status-dot">课程 AI 助手</span>
            <h2>
              好问题，
              <br />
              值得一次好对话。
            </h2>
            <p>
              梳理概念、打开思路，
              <br />
              围绕你的课程展开探索。
            </p>
            <Link to="/assistant" className="pv-primary pv-wide">
              开始对话 <Icon name="arrow" />
            </Link>
            <small>课程AI已接线 · 服务模式以对话页状态为准</small>
          </div>
          <div className="pv-workflow-note">
            <span className="pv-nav-label">COURSE WORKFLOW</span>
            <ol>
              <li>准备问卷与课堂问题</li>
              <li>学生在班级内完成作答</li>
              <li>查看完成情况与逐题统计</li>
            </ol>
          </div>
        </aside>
      </div>
      <footer className="pv-footer">
        学习空间 · 外观方案预览{" "}
        <span>数据来自当前班级，模拟账号仅供本机体验。</span>
      </footer>
    </main>
  );
}

interface Message {
  id: string;
  role: "user" | "assistant";
  text: string;
  failed?: boolean;
  sources?: Array<{id:string; title:string; version:string}>;
}
interface Thread {
  id: string;
  messages: Message[];
}
function Chat({ classId, className }: { classId: string; className: string }) {
  const [threads, setThreads] = useState<Thread[]>([
      { id: crypto.randomUUID(), messages: [] },
    ]),
    [active, setActive] = useState(""),
    [input, setInput] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [history, setHistory] = useState(false),
    [copied, setCopied] = useState("");
  const current = threads.find((t) => t.id === active) ?? threads[0],
    controller = useRef<AbortController | null>(null),
    busyRef = useRef(false),
    end = useRef<HTMLDivElement>(null),
    textarea = useRef<HTMLTextAreaElement>(null);
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [current.messages.length, busy]);
  function update(threadId: string, fn: (m: Message[]) => Message[]) {
    setThreads((ts) =>
      ts.map((t) =>
        t.id === threadId ? { ...t, messages: fn(t.messages) } : t,
      ),
    );
  }
  async function send(text: string, retryId?: string) {
    if (busyRef.current || !text.trim()) return;
    busyRef.current = true;
    setBusy(true);
    setError("");
    const threadId = current.id,
      id = retryId ?? crypto.randomUUID(),
      message: Message = { id, role: "user", text: text.trim() };
    update(threadId, (m) =>
      retryId
        ? m.map((x) => (x.id === id ? { ...x, failed: false } : x))
        : [...m, message],
    );
    setInput("");
    const abort = new AbortController();
    controller.current = abort;
    try {
      const answerId = crypto.randomUUID();
      await askCourse(classId, message.text, id, abort.signal, ({event, data}) => {
        if (abort.signal.aborted) return;
        if (event === 'delta' || event === 'refusal' || event === 'insufficient_evidence') {
          update(threadId, messages => {
            const exists = messages.some(m => m.id === answerId);
            const text = data.text ?? data.message ?? '';
            return exists ? messages.map(m => m.id === answerId ? {...m, text: m.text + text} : m)
              : [...messages, {id: answerId, role: 'assistant', text}];
          });
        }
        if (event === 'sources') update(threadId, messages => [...messages, {id: answerId, role: 'assistant', text: '' , sources: data.sources}]);
      });
    } catch (e) {
      update(threadId, (m) =>
        m.map((x) => (x.id === id ? { ...x, failed: true } : x)),
      );
      setError(
        e instanceof Error && e.name === "AbortError"
          ? "已停止发送，问题仍保留。"
          : errorText(e),
      );
    } finally {
      busyRef.current = false;
      setBusy(false);
      controller.current = null;
    }
  }
  function newThread() {
    const id = crypto.randomUUID();
    setThreads((t) => [{ id, messages: [] }, ...t]);
    setActive(id);
    setInput("");
    setError("");
    setHistory(false);
  }
  async function copy(m: Message) {
    try {
      await navigator.clipboard.writeText(m.text);
      setCopied(m.id);
    } catch {
      setError("复制失败，请选择文字手动复制。");
    }
  }
  if (getCurrentUser()?.role !== 'student') return <section className="core"><h1>课程 AI 使用统计</h1><AiStatusPanel classId={classId} /></section>;
  return (
    <main className="pv-chat">
      <aside
        className={`pv-chat-history ${history ? "is-open" : ""}`}
        aria-label="本页会话"
      >
        <button className="pv-new-chat" disabled={busy} onClick={newThread}>
          <Icon name="plus" />
          开启新对话
        </button>
        <p className="pv-nav-label">本页对话</p>
        {threads.map((t) => (
          <button
            key={t.id}
            disabled={busy}
            className={`pv-thread ${current.id === t.id ? "is-active" : ""}`}
            onClick={() => {
              setActive(t.id);
              setError("");
              setInput("");
              setHistory(false);
            }}
          >
            <Icon name="chat" />
            <span>{t.messages[0]?.text ?? "新的课程对话"}</span>
          </button>
        ))}
        <p className="pv-history-note">
          仅保存在当前页面
          <br />
          刷新后不保留会话
        </p>
      </aside>
      <section
        className={`pv-chat-main ${!current.messages.length ? "is-welcome" : ""}`}
      >
        <header className="pv-chat-heading">
          <div>
            <Icon name="spark" />
            <strong>AI 问答助手</strong>
            <span className="pv-connection-state">课程资料问答</span>
          </div>
          <button
            className="pv-icon-button pv-history-toggle"
            aria-label="切换对话列表"
            onClick={() => setHistory((v) => !v)}
          >
            <Icon name="chat" />
          </button>
          <span className="pv-chat-context">{className}</span>
        </header>
        {!current.messages.length ? (
          <div className="pv-chat-welcome">
            <span className="pv-ai-orb">
              <Icon name="spark" />
            </span>
            <p className="pv-eyebrow">YOUR COURSE COMPANION</p>
            <h1>你好，今天想探索什么？</h1>
            <p>从一个课程问题开始，让思路更清晰。</p>
            <div className="pv-suggestions">
              {[
                ["梳理课程概念", "帮我梳理环境影响评价的基本流程"],
                ["建立知识联系", "环境评价与环境管理之间有哪些联系？"],
                ["找到学习方向", "我该如何准备这门课程的课前学习？"],
              ].map(([title, text]) => (
                <button
                  key={title}
                  onClick={() => {
                    setInput(text);
                    textarea.current?.focus();
                  }}
                >
                  <Icon name="book" />
                  <strong>{title}</strong>
                  <span>{text}</span>
                  <Icon name="arrow" />
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="pv-messages" role="log" aria-label="对话消息">
            {current.messages.map((m) => (
              <article className={`pv-message is-${m.role}`} key={m.id}>
                <span className="pv-message-avatar">
                  {m.role === "assistant" ? <Icon name="spark" /> : "我"}
                </span>
                <div className="pv-message-body">
                  <p>{m.text}</p>
                  {m.sources?.length ? <small>参考资料：{m.sources.map(s => `${s.title}（v${s.version}）`).join("、")}</small> : null}
                  <div className="pv-message-actions">
                    <button onClick={() => copy(m)}>
                      {copied === m.id ? "已复制" : "复制"}
                    </button>
                    {m.failed && (
                      <>
                        <span>未发送成功</span>
                        <button
                          disabled={busy}
                          onClick={() => send(m.text, m.id)}
                        >
                          <Icon name="retry" />
                          重试
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </article>
            ))}
            {busy && (
              <div className="pv-thinking" role="status">
                <span />
                <span />
                <span />
                正在连接课程助手…
              </div>
            )}
            <div ref={end} />
          </div>
        )}
        <div className="pv-composer-wrap">
          <AiStatusPanel classId={classId} revision={busy ? 1 : 0} />
          {error && (
            <p className="pv-chat-error" role="alert">
              {error}
            </p>
          )}
          <form
            className="pv-composer"
            onSubmit={(e) => {
              e.preventDefault();
              void send(input);
            }}
          >
            <textarea
              ref={textarea}
              aria-label="课程问题"
              placeholder="向课程助手提问…"
              rows={2}
              maxLength={5000}
              value={input}
              disabled={busy}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (
                  e.key === "Enter" &&
                  !e.shiftKey &&
                  !e.nativeEvent.isComposing
                ) {
                  e.preventDefault();
                  void send(input);
                }
              }}
            />
            <div className="pv-composer-bottom">
              <span>
                <Icon name="book" />
                课程问答 <small>Enter 发送 · Shift + Enter 换行</small>
              </span>
              {busy ? (
                <button
                  type="button"
                  className="pv-send"
                  aria-label="停止发送"
                  onClick={() => controller.current?.abort()}
                >
                  <Icon name="stop" />
                </button>
              ) : (
                <button
                  className="pv-send"
                  aria-label="发送"
                  disabled={!input.trim()}
                >
                  <Icon name="send" />
                </button>
              )}
            </div>
          </form>
          <p className="pv-chat-disclaimer">
            请以服务状态为准，模拟回答会明确标记。每个问题独立检索，聊天正文不保存，请核对课程资料。
          </p>
        </div>
      </section>
    </main>
  );
}
const previewRoot = createRoot(document.getElementById("root")!);
previewRoot.render(<Preview />);
if (import.meta.hot) import.meta.hot.dispose(() => previewRoot.unmount());
