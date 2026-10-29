import {WhaleCompanion} from './WhaleCompanion';
import type {CompanionState} from './WhaleCompanion';
import {getAccessToken} from '../services/authStore';
import type {ChatDetail,ChatList} from '@shared/conversations';
import { KnowledgePanel } from './KnowledgePanel';
import { AdminRosterPanel } from './AdminRosterPanel';
import { ClassPicker } from '../components/ClassPicker';
import { PasswordChangePage } from '../pages/PasswordChangePage';
import { ApiManager, ServerManager, Metadata } from './ServicePanels';
import type { AuthSession } from '@shared/contracts';
import { parseApiResponse } from '../services/httpClient';
import { API_BASE_URL } from '../config';
import './service.css';
import {newId} from '../lib/newId';
import { createRoot } from "react-dom/client";
import {AdminConsole} from '../pages/AdminPage';
import { useEffect, useRef, useState } from "react";
import {
  MemoryRouter,
  Navigate,
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
  | "shield"
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
    shield: <><path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6Z"/><path d="m8 12 3 3 5-6"/></>,
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
  const [user,setUser]=useState<User|null>(getCurrentUser()),[theme,setTheme]=useState('forest');
  return <div className="studio" data-theme={theme}><MemoryRouter><PreviewRoutes user={user} setUser={setUser} theme={theme} setTheme={setTheme}/></MemoryRouter></div>;
}
function PreviewRoutes({user,setUser,theme,setTheme}:{user:User|null;setUser:(user:User|null)=>void;theme:string;setTheme:(theme:string)=>void}){
 const navigate=useNavigate(),location=useLocation();
 useEffect(()=>{setUnauthorizedHandler(()=>{setUser(null);navigate(location.pathname==='/service-login'?'/service-login':'/login',{replace:true})});return()=>setUnauthorizedHandler(null)},[navigate,location.pathname,setUser]);
 const done=(next:User)=>{setUser(next);navigate(next.mustChangePassword?'/change-password':'/',{replace:true})};
 const logout=()=>{void api.logout().catch(()=>{});clearSession();setUser(null);navigate('/login',{replace:true})};
 return <Routes>
  <Route path="/service-login" element={<PreviewLogin mode="admin" done={done}/>}/>
  <Route path="/login" element={<PreviewLogin done={done}/>}/>
  <Route path="/change-password" element={user?<PasswordChangePage onComplete={()=>{setUser(null);navigate('/login',{replace:true,state:{passwordChanged:true}})}} onLogout={()=>{setUser(null);navigate('/login',{replace:true})}}/>:<Navigate to="/login" replace/>}/>
  <Route path="/*" element={user?user.mustChangePassword?<Navigate to="/change-password" replace/>:<Workspace user={user} theme={theme} setTheme={setTheme} logout={logout}/>:<Navigate to="/login" replace/>}/>
 </Routes>;
}
function PreviewLogin({ done, mode="learning" }: { done: (u: User) => void; mode?:"learning"|"admin" }) {
  const [username, setUsername] = useState(""),
    [password, setPassword] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const location=useLocation();
  async function login(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const s = mode==='admin' ? await parseApiResponse<AuthSession>(await fetch(`${API_BASE_URL}/api/v1/auth/admin-login`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password})}),false) : await api.login({ username, password });
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
          <h2>{mode==='admin'?'服务管理员登录':'欢迎回到学习空间'}</h2>
          <p className="pv-muted">{mode==='admin'?'使用专用管理员账号，维护账户与平台服务。':'登录你的班级，继续今天的学习。'}</p>
          {(location.state as {passwordChanged?:boolean}|null)?.passwordChanged&&<p className="svc-notice" role="status">密码已修改，请使用新密码重新登录。</p>}
          <form onSubmit={login}>
            <label>
              {mode==='admin'?'管理员账号':'学号 / 教师账号'}
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
              {busy ? "正在登录…" : mode==='admin'?"进入服务管理":"进入学习空间"}
              <Icon name="arrow" />
            </button>
          </form>
          {mode==='admin'?<Link className="pv-original" to="/login">返回师生登录</Link>:<><a className="pv-original" href="/">返回当前版本</a><Link className="pv-service-entry" to="/service-login"><Icon name="shield"/>服务管理 <small>专用账号入口</small></Link></>}
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
  const teacher = user.role === "teacher", admin=user.role==='admin';
  const selected = classes.find((c) => c.id === classId);
  const chat = !admin && location.pathname === "/assistant";
  useEffect(() => {
    if(admin)return;
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
            <small>{admin?"服务管理空间":teacher ? "教师工作空间" : "学生学习空间"}</small>
          </div>
        </div>
        <p className="pv-nav-label">WORKSPACE</p>
        <nav>
          {(admin?[["/","grid","服务概览"],["/rosters","users","名单导入与分班"],["/classes","users","班级与成员"],["/accounts","users","账户管理"],["/knowledge","book","课程资料"],["/api","spark","API 管理"],["/server","shield","服务器设置"],["/usage","book","用量查询"],["/audit","book","操作日志"]]:[
            ["/", "grid", teacher ? "班级工作台" : "我的班级"],
            ["/questionnaires", "book", "问卷与统计"],
            ["/assistant", "spark", "AI 问答助手"],
            ...(teacher && classId
              ? [[`/core/classes/${classId}/roster`, "users", "班级成员"]]
              : []),
          ]).map(([path, icon, label]) => (
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
        {teacher&&<Link className="pv-service-entry" to="/service-login"><Icon name="shield"/>服务管理 <small>专用账号入口</small></Link>}
        <div className="pv-sidebar-tip">
          <Icon name="spark" />
          <strong>{admin?"平台服务管理":"你的课程学习搭档"}</strong>
          <p>{admin?"管理账户与运行设置，让师生专注课程。":"从一个好问题开始，让理解更进一步。"}</p>
          <button onClick={() => navigate(admin?"/accounts":"/assistant")}>
            {admin?"查找平台账户":"开始课程对话"} <Icon name="arrow" />
          </button>
          <small>{admin?"专用管理员权限":"AI 服务状态以对话页为准"}</small>
        </div>
        <div className="pv-profile">
          <span className="pv-avatar">{user.displayName[0]}</span>
          <div>
            <strong>{user.displayName}</strong>
            <small>{admin?"管理员账号":teacher ? "教师账号" : "学生账号"} · 本机预览</small>
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
              {admin?({"/":"服务概览","/rosters":"名单导入与分班","/classes":"班级与成员","/accounts":"账户管理","/knowledge":"课程资料","/api":"API 管理","/server":"服务器设置","/usage":"用量查询","/audit":"操作日志"} as Record<string,string>)[location.pathname]??'服务管理':chat
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
            {admin?<Link to="/login" className="pv-version-link">返回师生登录 ↗</Link>:<a href="/" className="pv-version-link">当前版本 ↗</a>}
          </div>
        </header>
        {error && (
          <p role="alert" className="pv-error">
            {error}
          </p>
        )}
        {admin?<div className="pv-page pv-service"><Routes>
          <Route path="/" element={<AdminConsole key="overview" embedded activeTab="overview" onTabChange={tab=>navigate(tab==='users'?'/accounts':'/')}/>}/>
          <Route path="/classes" element={<AdminConsole key="classes" embedded activeTab="classes"/>}/>
          <Route path="/accounts" element={<AdminConsole key="users" embedded activeTab="users"/>}/>
          <Route path="/audit" element={<AdminConsole key="audit" embedded activeTab="audit"/>}/>
          <Route path="/rosters" element={<AdminRosterPanel/>}/>
          <Route path="/knowledge" element={<KnowledgePanel/>}/>
          <Route path="/api" element={<><h1>API 管理</h1><ApiManager/></>}/>
          <Route path="/server" element={<><h1>服务器设置</h1><ServerManager/></>}/>
          <Route path="/usage" element={<><h1>用量查询</h1><Metadata kind="usage"/></>}/>
          <Route path="*" element={<Navigate to="/" replace/>}/>
        </Routes></div>:<Routes>
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
                  <p>课程助手需要班级上下文，请联系管理员导入名单。</p>
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
        </Routes>}
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
  const navigate=useNavigate();
  const teacher = user.role === "teacher";
  const [surveys, setSurveys] = useState<Survey[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [showPicker,setShowPicker]=useState(false);
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
          <button className="pv-primary" onClick={() => setShowPicker((v) => !v)}>
            <Icon name="plus" />
            添加已有班级
          </button>
        )}
      </div>
      {teacher&&showPicker&&<ClassPicker onClaimed={id=>{readClasses().then(items=>{setClasses(items);setClassId(id);setShowPicker(false)}).catch(e=>setError(errorText(e)))}}/>}
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
        ].filter(([, ,title])=>teacher||title!=="班级学生").map(([icon, value, title, sub]) => (
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
            <WhaleCompanion state="welcome" place="home" onActivate={()=>navigate('/assistant')}/>
            <span className="pv-status-dot">课程 AI 伙伴</span>
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
            <small>AI 服务待接入 · 可预览对话界面</small>
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
  sources?: {id:string;title:string;version:string;url?:string}[];
}
interface Thread {
  title?:string;
  id: string;
  messages: Message[];
}
function Chat({ classId, className }: { classId: string; className: string }) {
  const [threads,setThreads]=useState<Thread[]>([{id:'',messages:[]}]),[active,setActive]=useState(''),[input,setInput]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[history,setHistory]=useState(false),[copied,setCopied]=useState('');
  const current=threads.find(t=>t.id===active)??threads[0]??{id:'',messages:[]},controller=useRef<AbortController|null>(null),busyRef=useRef(false),end=useRef<HTMLDivElement>(null),textarea=useRef<HTMLTextAreaElement>(null),sequence=useRef(0);
  const [availability,setAvailability]=useState<string|null>(null),[motion,setMotion]=useState<CompanionState>('idle'),[asking,setAsking]=useState(false);
  const companionState:CompanionState=availability===null||availability==='disabled'?'offline':availability==='unavailable'?'failed':asking?'thinking':motion;
  const converted=(d:ChatDetail):Thread=>({id:d.id,title:d.title,messages:d.messages.map(m=>({...m,failed:m.role==='user'&&['error','cancelled','interrupted'].includes(m.outcome)}))});
  async function load(selected?:string){const seq=++sequence.current;const list=await request<ChatList>('GET',`/core/ai/threads?classId=${encodeURIComponent(classId)}`);const id=selected&&list.items.some(t=>t.id===selected)?selected:list.activeId;const detail=id?await request<ChatDetail>('GET',`/core/ai/threads/${id}`):null;if(seq!==sequence.current)return null;setThreads(list.items.length?list.items.map(t=>detail?.id===t.id?converted(detail):{id:t.id,title:t.title,messages:[]}):[{id:'',messages:[]}]);setActive(id??'');return detail}
  useEffect(()=>{void load().catch(e=>setError(errorText(e)));let alive=true;void request<{mode:string;liveReady:boolean}>('GET','/core/ai/status').then(d=>{if(alive)setAvailability(d.mode==='mock'||d.liveReady?d.mode:'disabled')}).catch(()=>{if(alive){setAvailability('unavailable');setError('暂时无法读取AI服务状态，请刷新后重试。')}});return()=>{alive=false;sequence.current++;controller.current?.abort()}},[]);
  useEffect(()=>{if(motion!=='done'&&motion!=='failed')return;const timer=setTimeout(()=>setMotion('idle'),motion==='done'?2300:2600);return()=>clearTimeout(timer)},[motion]);
  useEffect(()=>{end.current?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'nearest'})},[current.messages.length,busy]);
  async function selectThread(id:string){if(busyRef.current)return;setBusy(true);setMotion('idle');try{const d=await request<ChatDetail>('POST',`/core/ai/threads/${id}/select`,{body:{}});setThreads(ts=>ts.map(t=>t.id===id?converted(d):t));setActive(id);setError('');setInput('');setHistory(false)}catch(e){setError(errorText(e))}finally{setBusy(false)}}
  async function newThread(){if(busyRef.current)return;setBusy(true);setMotion('idle');try{const d=await request<ChatDetail>('POST','/core/ai/threads',{body:{classId}});await load(d.id);setInput('');setError('');setHistory(false)}catch(e){setError(errorText(e))}finally{setBusy(false)}}
  async function deleteThread(id:string){if(!id||!window.confirm('删除这条对话及其中的消息？此操作无法撤销。'))return;controller.current?.abort();setBusy(true);setMotion('idle');try{await request('DELETE',`/core/ai/threads/${id}`);await load();setError('')}catch(e){setError(errorText(e))}finally{setBusy(false)}}
  async function send(text:string,_retryId?:string){
    if(busyRef.current||!text.trim())return;
    if(availability===null||availability==='disabled'||availability==='unavailable'){setError(availability==='unavailable'?'暂时无法读取AI服务状态，请刷新后重试。':'AI 服务尚未接入，暂时不能发送问题。');return}
    busyRef.current=true;setBusy(true);setAsking(true);setMotion('thinking');setError('');const abort=new AbortController();controller.current=abort;let id=current.id;
    try{
      if(!id){const d=await request<ChatDetail>('POST','/core/ai/threads',{body:{classId}});id=d.id;setThreads([converted(d)]);setActive(id)}
      const question=text.trim();setThreads(ts=>ts.map(t=>t.id===id?{...t,messages:[...t.messages,{id:newId(),role:'user',text:question}]}:t));setInput('');
      const response=await fetch(`${API_BASE_URL}/api/v1/core/ai/threads/${id}/questions`,{method:'POST',headers:{Authorization:'Bearer '+getAccessToken(),'Content-Type':'application/json'},body:JSON.stringify({question,clientRequestId:newId()}),signal:abort.signal});
      if(!response.ok)await parseApiResponse(response,true);else await response.text();
      const detail=await load(id),last=detail?.messages.at(-1);
      if(last&&['done','refusal','insufficient_evidence'].includes(last.outcome))setMotion('done');
      else {setMotion(last?.outcome==='cancelled'?'idle':'failed');setError('本次请求未完成，请稍后重试。')}
    }catch(e){const cancelled=e instanceof Error&&e.name==='AbortError';setError(cancelled?'已停止生成。':errorText(e));setMotion(cancelled?'idle':'failed');await load(id).catch(()=>{})}
    finally{busyRef.current=false;setBusy(false);setAsking(false);controller.current=null}
  }
  async function copy(m: Message) {
    try {
      await navigator.clipboard.writeText(m.text);
      setCopied(m.id);
    } catch {
      setError("复制失败，请选择文字手动复制。");
    }
  }
  return (
    <main className="pv-chat">
      <aside
        className={`pv-chat-history ${history ? "is-open" : ""}`}
        aria-label="我的会话"
      >
        <button className="pv-new-chat" disabled={busy} onClick={newThread}>
          <Icon name="plus" />
          开启新对话
        </button>
        <p className="pv-nav-label">我的对话</p>
        {threads.filter(t=>t.id).map(t=><div key={t.id} className="pv-thread-row"><button disabled={busy} className={`pv-thread ${current.id===t.id?'is-active':''}`} onClick={()=>void selectThread(t.id)}><Icon name="chat"/><span>{t.title??t.messages[0]?.text??'新的课程对话'}</span></button><button aria-label={`删除对话：${t.title??'新的课程对话'}`} onClick={()=>void deleteThread(t.id)}>删除</button></div>)}
        <p className="pv-history-note">对话保存在本人账号下，可继续提问或删除。</p>
      </aside>
      <section
        className={`pv-chat-main ${!current.messages.length ? "is-welcome" : ""}`}
      >
        <header className="pv-chat-heading">
          <div>
            <Icon name="spark" />
            <strong>AI 问答助手</strong>
            <span className="pv-connection-state">{availability===null?"读取服务状态…":availability==='disabled'?"待接入":availability==='unavailable'?"状态不可用":availability==='mock'?"模拟服务":"已接入"}</span>
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
        <div className="pv-chat-content">
        <WhaleCompanion state={companionState} place="chat"/>
        {!current.messages.length ? (
          <div className="pv-chat-welcome">
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
                  {!!m.sources?.length && <div aria-label="回答参考来源"><strong>参考来源：</strong>{m.sources.map((source)=><div key={source.id}>{source.url && /^https:\/\//i.test(source.url) ? <a href={source.url} target="_blank" rel="noopener noreferrer">{source.title}</a> : <span>{source.title}</span>} <small>{source.version}</small></div>)}</div>}
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
        </div>
        <div className="pv-composer-wrap">
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
            {availability==='disabled'||availability===null?'AI 服务尚未接入，当前不会生成回答。':availability==='mock'?'当前为模拟服务。':'请核对重要课程信息。'}
          </p>
        </div>
      </section>
    </main>
  );
}
const previewRoot=createRoot(document.getElementById("root")!);
previewRoot.render(<Preview />);
if(import.meta.hot)import.meta.hot.dispose(()=>previewRoot.unmount());
