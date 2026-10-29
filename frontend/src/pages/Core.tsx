import {newId} from '../lib/newId';
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { ClassInfo, Page } from "@shared/contracts";
import type {
  FilePreview,
  RosterPlan,
  RosterRow,
  Survey,
  SurveyQuestion,
  SurveyResponse,
  SurveySession,
  SurveyStats,
} from "@shared/questionnaires";
import { apiRequest as request } from "../services/httpClient";
import { getCurrentUser } from "../services/api";
import * as echarts from "echarts/core";
import { PieChart } from "echarts/charts";
import { LegendComponent, TooltipComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
echarts.use([PieChart, LegendComponent, TooltipComponent, CanvasRenderer]);
import "../styles/core.css";
import { recognizeQuestions } from "@shared/import-questions";

const message = (e: unknown) =>
  e instanceof Error ? e.message : "操作失败，请重试";
const url = (s: string) => encodeURIComponent(s);
const blankQuestion = (): SurveyQuestion => ({
  id: newId(),
  title: "",
  type: "text",
  required: true,
  options: [],
});
async function allClasses() {
  const items: ClassInfo[] = [];
  let cursor: string | null = null;
  do {
    const p: Page<ClassInfo> = await request(
      "GET",
      "/classes?limit=100" + (cursor ? "&cursor=" + url(cursor) : ""),
    );
    items.push(...p.items);
    cursor = p.nextCursor;
  } while (cursor);
  return items;
}
async function filePreview(file: File) {
  if (file.size > 1024 * 1024) throw new Error("文件最多1MB，请拆分");
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return request<FilePreview>("POST", "/core/files/preview", {
    body: { name: file.name, base64: btoa(binary) },
  });
}
function Alert({ error }: { error: string }) {
  return error ? (
    <p className="error" role="alert">
      {error}
    </p>
  ) : null;
}
export function CoreHome() {
  const teacher = getCurrentUser()?.role === "teacher";
  const [classes, setClasses] = useState<ClassInfo[]>([]),
    [selected, setSelected] = useState(""),
    [surveys, setSurveys] = useState<Survey[]>([]),
    [name, setName] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true);
  async function load() {
    try {
      const c = await allClasses();
      setClasses(c);
      setSelected((s) => s || c[0]?.id || "");
    } catch (e) {
      setError(message(e));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  useEffect(() => {
    setSurveys([]);
    if (!selected) return;
    let active = true;
    request<Survey[]>("GET", `/core/classes/${url(selected)}/surveys`)
      .then((s) => {
        if (active) setSurveys(s);
      })
      .catch((e) => {
        if (active) setError(message(e));
      });
    return () => {
      active = false;
    };
  }, [selected]);
  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const c = await request<ClassInfo>("POST", "/teacher/classes", {
        body: { name },
      });
      setClasses((v) => [...v, c]);
      setSelected(c.id);
      setName("");
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="core">
      <h1>{teacher ? "教师工作台" : "我的班级"}</h1>
      <p className="muted">
        {teacher
          ? "班级、名单与问卷集中管理。"
          : "查看本班问卷，按时完成作答。"}
      </p>
      <Alert error={error} />
      {loading ? (
        <p role="status">正在加载班级…</p>
      ) : (
        <>
          <label>
            选择班级
            <select
              aria-label="选择班级"
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
            >
              <option value="">请选择</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          {!classes.length && (
            <p>
              暂无所属班级。
              {teacher ? "请先创建班级。" : "请联系教师导入名单。"}
            </p>
          )}
        </>
      )}
      {teacher && (
        <form className="core-inline" onSubmit={create}>
          <input
            aria-label="新班级名称"
            placeholder="新班级名称"
            required
            maxLength={200}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button disabled={busy || !name.trim()}>创建班级</button>
        </form>
      )}
      {selected && (
        <>
          <div className="core-actions">
            {teacher ? (
              <>
                <Link to={`/core/classes/${selected}/roster`}>
                  学生名单与导入
                </Link>
                <Link to={`/core/classes/${selected}/new`}>布置问卷</Link>
              </>
            ) : (
              <Link to={`/core/classes/${selected}/assistant`}>
                AI 问答助手
              </Link>
            )}
          </div>
          <h2>问卷列表</h2>
          {!surveys.length && <p>暂无问卷。</p>}
          {surveys.map((s) => (
            <article className="card" key={s.id}>
              <h3>{s.title}</h3>
              <p>
                {s.state === "draft"
                  ? "草稿"
                  : s.state === "published"
                    ? "已发布"
                    : "已结束"}{" "}
                ·{" "}
                {s.deadlineAt
                  ? "截止 " + new Date(s.deadlineAt).toLocaleString()
                  : "无截止时间"}{" "}
                · {s.durationMinutes ? `${s.durationMinutes} 分钟` : "不限时长"}
              </p>
              <div className="core-actions">
                {teacher ? (
                  <>
                    {s.state === "draft" && (
                      <Link to={`/core/surveys/${s.id}/edit`}>编辑问卷</Link>
                    )}
                    <Link to={`/core/surveys/${s.id}/stats`}>
                      作答情况与统计
                    </Link>
                  </>
                ) : (
                  <Link to={`/core/surveys/${s.id}/answer`}>查看 / 作答</Link>
                )}
              </div>
            </article>
          ))}
        </>
      )}
    </section>
  );
}

export function RosterPage() {
  const { classId = "" } = useParams();
  const [file, setFile] = useState<FilePreview | null>(null),
    [sheet, setSheet] = useState(0),
    [header, setHeader] = useState(0),
    [numberCol, setNumberCol] = useState(0),
    [nameCol, setNameCol] = useState(1),
    [rows, setRows] = useState<RosterRow[]>([]),
    [plan, setPlan] = useState<RosterPlan | null>(null),
    [members, setMembers] = useState<
      Array<{ studentId: string; studentNumber: string; studentName: string }>
    >([]),
    [error, setError] = useState(""),
    [status, setStatus] = useState(""),
    [busy, setBusy] = useState(false);
  const load = () =>
    request<typeof members>("GET", `/core/classes/${classId}/members`).then(
      setMembers,
    );
  useEffect(() => {
    load().catch((e) => setError(message(e)));
  }, [classId]);
  function detect(f: FilePreview, i: number) {
    setSheet(i);
    const grid = f.sheets[i]?.rows ?? [];
    const h = grid.findIndex(
      (r) =>
        r.some((x) => /^(学号|学生学号|编号|studentnumber)$/i.test(x.trim())) &&
        r.some((x) => /^(姓名|学生姓名|名字|displayname)$/i.test(x.trim())),
    );
    setHeader(Math.max(0, h));
    if (h >= 0) {
      setNumberCol(
        grid[h].findIndex((x) =>
          /^(学号|学生学号|编号|studentnumber)$/i.test(x.trim()),
        ),
      );
      setNameCol(
        grid[h].findIndex((x) =>
          /^(姓名|学生姓名|名字|displayname)$/i.test(x.trim()),
        ),
      );
    } else setStatus("未识别到标准表头，请选择表头行和列映射。");
    setRows([]);
    setPlan(null);
  }
  async function upload(f: File) {
    setBusy(true);
    setError("");
    setStatus("");
    setRows([]);
    setPlan(null);
    setFile(null);
    try {
      const preview = await filePreview(f);
      setFile(preview);
      detect(preview, 0);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  function map() {
    if (numberCol === nameCol) {
      setError("姓名与学号不能选择同一列");
      return;
    }
    setError("");
    setPlan(null);
    setRows(
      (file?.sheets[sheet]?.rows ?? [])
        .slice(header + 1)
        .filter((r) => r.some((x) => x.trim()))
        .map((r) => ({
          studentNumber: (r[numberCol] ?? "").trim(),
          displayName: (r[nameCol] ?? "").trim(),
        })),
    );
  }
  async function preview() {
    setBusy(true);
    setError("");
    try {
      setPlan(
        await request("POST", `/core/classes/${classId}/roster/preview`, {
          body: { rows },
        }),
      );
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  async function commit() {
    if (!plan) return;
    setBusy(true);
    setError("");
    try {
      const r = await request<{ imported: number }>(
        "POST",
        `/core/classes/${classId}/roster/commit`,
        { body: { planId: plan.id, fingerprint: plan.fingerprint } },
      );
      setStatus(
        `已确认导入 ${r.imported} 名学生。新账号初始密码为 12345，已有账号密码保持原样。`,
      );
      setPlan(null);
      setRows([]);
      await load();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  const grid = file?.sheets[sheet]?.rows ?? [];
  return (
    <section className="core">
      <Link to="/">返回班级</Link>
      <h1>学生名单与导入</h1>
      <Alert error={error} />
      <p role="status">{status}</p>
      <label>
        上传名单（Word / Excel / CSV，最多 1MB）
        <input
          type="file"
          accept=".csv,.xlsx,.xls,.doc,.docx"
          disabled={busy}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void upload(f);
          }}
        />
      </label>
      {file && (
        <div className="card">
          <p>识别格式：{file.format}</p>
          {file.warnings.map((w) => (
            <p key={w}>{w}</p>
          ))}
          <label>
            工作表
            <select
              value={sheet}
              onChange={(e) => detect(file, Number(e.target.value))}
            >
              {file.sheets.map((s, i) => (
                <option value={i} key={i}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            表头所在行
            <input
              type="number"
              min={1}
              max={grid.length}
              value={header + 1}
              onChange={(e) => {
                setHeader(Number(e.target.value) - 1);
                setPlan(null);
              }}
            />
          </label>
          {[
            ["学号列", numberCol, setNumberCol],
            ["姓名列", nameCol, setNameCol],
          ].map(([label, value, setter]) => (
            <label key={String(label)}>
              {String(label)}
              <select
                value={value as number}
                onChange={(e) => {
                  (setter as (n: number) => void)(Number(e.target.value));
                  setPlan(null);
                }}
              >
                {(grid[header] ?? []).map((v, i) => (
                  <option key={i} value={i}>
                    {i + 1}：{v}
                  </option>
                ))}
              </select>
            </label>
          ))}
          <button disabled={busy} onClick={map}>
            应用映射，编辑预览
          </button>
        </div>
      )}
      {rows.length > 0 && (
        <>
          <h2>确认前编辑（{rows.length} 行）</h2>
          <div className="core-table">
            <table>
              <thead>
                <tr>
                  <th>学号</th>
                  <th>姓名</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i}>
                    <td>
                      <input
                        aria-label={`第${i + 1}行学号`}
                        value={r.studentNumber}
                        onChange={(e) => {
                          setPlan(null);
                          setRows((v) =>
                            v.map((x, j) =>
                              j === i
                                ? { ...x, studentNumber: e.target.value }
                                : x,
                            ),
                          );
                        }}
                      />
                    </td>
                    <td>
                      <input
                        aria-label={`第${i + 1}行姓名`}
                        value={r.displayName}
                        onChange={(e) => {
                          setPlan(null);
                          setRows((v) =>
                            v.map((x, j) =>
                              j === i
                                ? { ...x, displayName: e.target.value }
                                : x,
                            ),
                          );
                        }}
                      />
                    </td>
                    <td>
                      <button
                        onClick={() => {
                          setPlan(null);
                          setRows((v) => v.filter((_, j) => i !== j));
                        }}
                      >
                        移除行
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button disabled={busy} onClick={preview}>
            校验名单并生成确认预览
          </button>
        </>
      )}
      {plan && (
        <div className="card">
          <p>待导入 {plan.rows.length} 人；重复学号和身份冲突必须先修正。</p>
          {plan.errors.map((e, i) => (
            <p role="alert" key={i}>
              {e}
            </p>
          ))}
          <button
            className="primary"
            disabled={busy || !!plan.errors.length}
            onClick={commit}
          >
            确认正式导入
          </button>
        </div>
      )}
      <h2>当前学生（{members.length}）</h2>
      <div className="core-table">
        <table>
          <thead>
            <tr>
              <th>学号</th>
              <th>姓名</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.studentId}>
                <td>{m.studentNumber}</td>
                <td>{m.studentName}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function SurveyEditor() {
  const { id, classId } = useParams();
  const nav = useNavigate();
  const [survey, setSurvey] = useState<Survey>({
      id: "",
      classId: classId ?? "",
      title: "",
      questions: [blankQuestion()],
      state: "draft",
      deadlineAt: null,
      durationMinutes: null,
      version: 0,
    }),
    [source, setSource] = useState(""),
    [error, setError] = useState(""),
    [status, setStatus] = useState(""),
    [busy, setBusy] = useState(false),
    [ready, setReady] = useState(!id);
  useEffect(() => {
    if (id)
      request<Survey>("GET", `/core/surveys/${id}`)
        .then((s) => {
          setSurvey(s);
          setReady(true);
        })
        .catch((e) => setError(message(e)));
  }, [id]);
  function question(i: number, patch: Partial<SurveyQuestion>) {
    setSurvey((s) => ({
      ...s,
      questions: s.questions.map((q, j) => (i === j ? { ...q, ...patch } : q)),
    }));
  }
  async function save(publish = false) {
    setBusy(true);
    setError("");
    try {
      const { id: surveyId, state: _, version, ...body } = survey;
      const s = await request<Survey>(
        surveyId ? "PUT" : "POST",
        "/core/surveys" + (surveyId ? "/" + surveyId : ""),
        { body: { ...body, expectedVersion: version } },
      );
      setSurvey(s);
      if (publish) {
        await request("POST", `/core/surveys/${s.id}/publish`, {
          body: { expectedVersion: s.version },
        });
        nav("/");
      } else {
        nav(`/core/surveys/${s.id}/edit`, { replace: true });
        setStatus("草稿已保存");
      }
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  async function upload(f: File) {
    setBusy(true);
    setError("");
    try {
      const p = await filePreview(f);
      setSource(
        p.format === "csv"
          ? p.sheets[0].rows.map((r) => r.join("\t")).join("\n")
          : p.text,
      );
      setStatus(
        `已识别 ${p.format}。请核对原文并提取题目，AI 生成是独立可替换接口。`,
      );
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  async function ai() {
    setBusy(true);
    setError("");
    try {
      const r = await request<{ questions: SurveyQuestion[] }>(
        "POST",
        "/core/ai/generate",
        { body: { classId: survey.classId, text: source } },
      );
      setSurvey((s) => ({ ...s, questions: r.questions }));
      setStatus("已载入 AI 建议，请逐题确认");
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="core">
      <Link to="/">返回班级</Link>
      <h1>编辑问卷</h1>
      <Alert error={error} />
      <p role="status">{status}</p>
      {ready && (
        <fieldset disabled={busy || survey.state !== "draft"}>
          <label>
            问卷标题
            <input
              required
              value={survey.title}
              onChange={(e) =>
                setSurvey((s) => ({ ...s, title: e.target.value }))
              }
            />
          </label>
          <div className="card">
            <h2>文件识别与结构化</h2>
            <input
              aria-label="导入问卷文件"
              type="file"
              accept=".doc,.docx,.xls,.xlsx,.csv"
              onChange={(e) => {
                if (e.target.files?.[0]) void upload(e.target.files[0]);
              }}
            />
            <label>
              识别原文（可修正）
              <textarea
                rows={7}
                value={source}
                onChange={(e) => setSource(e.target.value)}
              />
            </label>
            <button
              onClick={() => {
                const q = recognizeQuestions(source);
                if (!q.length) {
                  setError(
                    "未发现编号题目，请在线编辑，或按“1. 题目 / A. 选项”整理原文",
                  );
                  return;
                }
                setSurvey((s) => ({ ...s, questions: q }));
                setStatus(
                  "已提取编号题目及选项；必填默认关闭，请逐题确认题型、选项和必填。",
                );
              }}
            >
              按编号提取题目与选项
            </button>{" "}
            <button disabled={!source} onClick={ai}>
              请求 AI 生成（接口预留）
            </button>
          </div>
          {survey.questions.map((q, i) => (
            <div className="card" key={q.id}>
              <h2>第 {i + 1} 题</h2>
              <label>
                题目
                <input
                  value={q.title}
                  onChange={(e) => question(i, { title: e.target.value })}
                />
              </label>
              <label>
                题型
                <select
                  aria-label="题型"
                  value={q.type}
                  onChange={(e) =>
                    question(i, {
                      type: e.target.value as SurveyQuestion["type"],
                    })
                  }
                >
                  <option value="text">文本</option>
                  <option value="single">单选</option>
                  <option value="multiple">多选</option>
                </select>
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={q.required}
                  onChange={(e) => question(i, { required: e.target.checked })}
                />
                必填
              </label>
              {q.type !== "text" && (
                <label>
                  选项（每行一个）
                  <textarea
                    value={q.options.join("\n")}
                    onChange={(e) =>
                      question(i, { options: e.target.value.split("\n") })
                    }
                  />
                </label>
              )}
              <button
                disabled={survey.questions.length === 1}
                onClick={() =>
                  setSurvey((s) => ({
                    ...s,
                    questions: s.questions.filter((_, j) => i !== j),
                  }))
                }
              >
                删除此题
              </button>
            </div>
          ))}
          <button
            onClick={() =>
              setSurvey((s) => ({
                ...s,
                questions: [...s.questions, blankQuestion()],
              }))
            }
          >
            添加题目
          </button>
          <h2>作答时间</h2>
          <label>
            截止时间（本机时区）
            <input
              type="datetime-local"
              value={
                survey.deadlineAt
                  ? new Date(
                      Date.parse(survey.deadlineAt) -
                        new Date().getTimezoneOffset() * 60000,
                    )
                      .toISOString()
                      .slice(0, 16)
                  : ""
              }
              onChange={(e) =>
                setSurvey((s) => ({
                  ...s,
                  deadlineAt: e.target.value
                    ? new Date(e.target.value).toISOString()
                    : null,
                }))
              }
            />
          </label>
          <label>
            允许作答时长（分钟，首次打开开始计时，空白不限）
            <input
              type="number"
              min={1}
              max={10080}
              value={survey.durationMinutes ?? ""}
              onChange={(e) =>
                setSurvey((s) => ({
                  ...s,
                  durationMinutes: e.target.value
                    ? Number(e.target.value)
                    : null,
                }))
              }
            />
          </label>
          <div className="core-actions">
            <button onClick={() => save()}>保存草稿</button>
            <button className="primary" onClick={() => save(true)}>
              保存并发布问卷
            </button>
          </div>
        </fieldset>
      )}
    </section>
  );
}

export function SurveyAnswer() {
  const { id = "" } = useParams();
  const [session, setSession] = useState<SurveySession | null>(null),
    [answers, setAnswers] = useState<Record<string, string | string[]>>({}),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [now, setNow] = useState(Date.now());
  const offset = useRef(0);
  useEffect(() => {
    let active = true;
    request<SurveySession>("POST", `/core/surveys/${id}/start`)
      .then((s) => {
        if (active) {
          offset.current = Date.parse(s.serverNow) - Date.now();
          setNow(Date.parse(s.serverNow));
          setSession(s);
          setAnswers(s.response.answers);
        }
      })
      .catch((e) => {
        if (active) setError(message(e));
      });
    const timer = setInterval(() => setNow(Date.now() + offset.current), 1000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [id]);
  const remaining = session?.expiresAt
      ? Math.max(0, Math.ceil((Date.parse(session.expiresAt) - now) / 1000))
      : null,
    done = !!session?.response.submittedAt;
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!session) return;
    setBusy(true);
    setError("");
    try {
      const response = await request<SurveyResponse>(
        "POST",
        `/core/surveys/${id}/submit`,
        { body: { answers } },
      );
      setSession({ ...session, response });
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="core">
      <Link to="/">返回班级</Link>
      <Alert error={error} />
      {!session && !error && <p>正在开始作答…</p>}
      {session && (
        <>
          <h1>{session.survey.title}</h1>
          <p role="status">
            {done
              ? "已提交：" +
                new Date(session.response.submittedAt!).toLocaleString()
              : remaining === null
                ? "不限时长"
                : `剩余 ${Math.floor(remaining / 60)} 分 ${remaining % 60} 秒`}
          </p>
          {remaining === 0 && !done && (
            <p className="error">已超过作答时间，不能提交。</p>
          )}
          <form onSubmit={submit}>
            <fieldset disabled={busy || done || remaining === 0}>
              {session.survey.questions.map((q, i) => (
                <div className="card" key={q.id}>
                  <h2>
                    {i + 1}. {q.title}
                    {q.required ? " *" : ""}
                  </h2>
                  {q.type === "text" ? (
                    <textarea
                      aria-label={q.title}
                      maxLength={10000}
                      required={q.required}
                      value={String(answers[q.id] ?? "")}
                      onChange={(e) =>
                        setAnswers((a) => ({ ...a, [q.id]: e.target.value }))
                      }
                    />
                  ) : (
                    q.options.map((o) => (
                      <label className="core-option" key={o}>
                        <input
                          type={q.type === "single" ? "radio" : "checkbox"}
                          name={q.id}
                          value={o}
                          checked={
                            q.type === "single"
                              ? answers[q.id] === o
                              : Array.isArray(answers[q.id]) &&
                                (answers[q.id] as string[]).includes(o)
                          }
                          onChange={(e) =>
                            setAnswers((a) => ({
                              ...a,
                              [q.id]:
                                q.type === "single"
                                  ? o
                                  : e.target.checked
                                    ? [
                                        ...((Array.isArray(a[q.id])
                                          ? a[q.id]
                                          : []) as string[]),
                                        o,
                                      ]
                                    : ((a[q.id] as string[]) ?? []).filter(
                                        (x) => x !== o,
                                      ),
                            }))
                          }
                        />
                        {o}
                      </label>
                    ))
                  )}
                </div>
              ))}
              {!done && (
                <button className="primary" disabled={busy || remaining === 0}>
                  {busy ? "提交中…" : "提交问卷"}
                </button>
              )}
            </fieldset>
          </form>
        </>
      )}
    </section>
  );
}

function ResultChart({
  counts,
}: {
  counts: Array<{ name: string; value: number }>;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const chart = echarts.init(ref.current);
    chart.setOption({
      tooltip: { trigger: "item", confine: true },
      legend: { bottom: 0, type: "scroll" },
      series: [
        {
          type: "pie",
          radius: ["38%", "66%"],
          center: ["50%", "43%"],
          avoidLabelOverlap: true,
          label: { show: false },
          data: counts,
          emphasis: { label: { show: true, fontSize: 14 } },
        },
      ],
    });
    const resize = new ResizeObserver(() => chart.resize());
    resize.observe(ref.current);
    return () => {
      resize.disconnect();
      chart.dispose();
    };
  }, [counts]);
  return (
    <div
      ref={ref}
      className="core-chart"
      role="img"
      aria-label="各选项选择人数环形图，具体数据见下方文字"
    />
  );
}
export function SurveyResults() {
  const { id = "" } = useParams();
  const [stats, setStats] = useState<SurveyStats | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [insights, setInsights] = useState("");
  const load = () =>
    request<SurveyStats>("GET", `/core/surveys/${id}/stats`).then(setStats);
  useEffect(() => {
    load().catch((e) => setError(message(e)));
  }, [id]);
  async function close() {
    if (!stats) return;
    setBusy(true);
    try {
      await request("POST", `/core/surveys/${id}/close`, {
        body: { expectedVersion: stats.survey.version },
      });
      await load();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  async function ai() {
    if (!stats) return;
    setBusy(true);
    try {
      const r = await request<{ text: string }>("POST", "/core/ai/insights", {
        body: { classId: stats.survey.classId, surveyId: id },
      });
      setInsights(r.text);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="core">
      <Link to="/">返回班级</Link>
      <Alert error={error} />
      {stats && (
        <>
          <h1>{stats.survey.title}</h1>
          <p>
            截止：
            {stats.survey.deadlineAt
              ? new Date(stats.survey.deadlineAt).toLocaleString()
              : "不限"}
            ；作答时长：{stats.survey.durationMinutes ?? "不限"} 分钟
          </p>
          <div className="core-actions">
            <button
              disabled={busy}
              onClick={() => load().catch((e) => setError(message(e)))}
            >
              刷新统计
            </button>
            {stats.survey.state === "published" && (
              <button disabled={busy} onClick={close}>
                结束问卷
              </button>
            )}
            {stats.survey.state === "draft" && (
              <Link to={`/core/surveys/${id}/edit`}>继续编辑并发布</Link>
            )}
          </div>
          <h2>表一 · 学生作答情况</h2>
          <div className="core-table">
            <table>
              <thead>
                <tr>
                  <th>学号</th>
                  <th>姓名</th>
                  <th>完成情况</th>
                  <th>问卷链接</th>
                </tr>
              </thead>
              <tbody>
                {stats.students.map((s) => (
                  <tr key={s.studentId}>
                    <td>{s.studentNumber}</td>
                    <td>{s.studentName}</td>
                    <td>{s.status}</td>
                    <td>
                      {s.responseId ? (
                        <Link to={`/core/responses/${s.responseId}`}>
                          查看作答
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <h2>表二 · 逐题作答统计</h2>
          <p>
            仅统计已提交答卷；多选题可选择多个选项，各选项人数之和可能大于答题人数。
          </p>
          {stats.questions.map((q) => (
            <article className="card" key={q.id}>
              <h3>{q.title}</h3>
              <p>有效作答 {q.answered} 人。</p>
              {q.counts.length ? (
                <>
                  <ResultChart counts={q.counts} />
                  <ul>
                    {q.counts.map((c) => (
                      <li key={c.name}>
                        {c.name}：{c.value} 人
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                q.texts.map((t, i) => <blockquote key={i}>{t}</blockquote>)
              )}
            </article>
          ))}
          <h2>AI 评价与图表建议</h2>
          <p>{insights || "尚无 AI 评价。未接入前不生成模拟结论。"}</p>
          <button disabled={busy} onClick={ai}>
            请求 AI 评价（接口预留）
          </button>
        </>
      )}
    </section>
  );
}
export function ResponseDetail() {
  const { id = "" } = useParams();
  const [detail, setDetail] = useState<{
      survey: Survey;
      response: SurveyResponse;
    } | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    request<typeof detail>("GET", `/core/responses/${id}`)
      .then(setDetail)
      .catch((e) => setError(message(e)));
  }, [id]);
  return (
    <section className="core">
      <Link to="/">返回班级</Link>
      <Alert error={error} />
      {detail && (
        <>
          <h1>{detail.survey.title} · 只读作答</h1>
          <p>
            {detail.response.studentNumber} · {detail.response.studentName} ·{" "}
            {detail.response.submittedAt
              ? new Date(detail.response.submittedAt).toLocaleString()
              : "未提交"}
          </p>
          {detail.survey.questions.map((q) => (
            <article className="card" key={q.id}>
              <h2>{q.title}</h2>
              <p className="core-pre">
                {Array.isArray(detail.response.answers[q.id])
                  ? (detail.response.answers[q.id] as string[]).join("、")
                  : (detail.response.answers[q.id] ?? "未作答")}
              </p>
            </article>
          ))}
        </>
      )}
    </section>
  );
}
export function Assistant() {
  const { classId = "" } = useParams();
  const [input, setInput] = useState(""),
    [messages, setMessages] = useState<Array<{ role: string; text: string }>>(
      [],
    ),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || busy) return;
    setBusy(true);
    setError("");
    const text = input;
    setInput("");
    setMessages((m) => [...m, { role: "user", text }]);
    try {
      const r = await request<{ reply: string }>("POST", "/core/ai/chat", {
        body: { classId, messages: [...messages, { role: "user", text }] },
      });
      setMessages((m) => [...m, { role: "assistant", text: r.reply }]);
    } catch (e) {
      setError(message(e));
      setInput(text);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="core">
      <Link to="/">返回班级</Link>
      <h1>AI 问答助手</h1>
      <p>
        课程问题交流。AI
        服务由另一位同学接入，当前不会返回模拟回答；消息仅保留在当前页面。
      </p>
      <div aria-live="polite">
        {messages.map((m, i) => (
          <article className="card" key={i}>
            <strong>{m.role === "user" ? "我" : "AI"}</strong>
            <p className="core-pre">{m.text}</p>
          </article>
        ))}
      </div>
      <Alert error={error} />
      <form onSubmit={send}>
        <label>
          课程问题
          <textarea
            maxLength={5000}
            required
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
        </label>
        <button className="primary" disabled={busy || !input.trim()}>
          {busy ? "发送中…" : "发送"}
        </button>
      </form>
    </section>
  );
}
