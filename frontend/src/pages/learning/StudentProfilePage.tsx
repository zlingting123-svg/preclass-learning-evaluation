import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { ProfileAnswers, ProfileDraft } from "@shared/learning";
import {
  PROFILE_QUESTIONS,
  PROFILE_SCHEMA_VERSION,
  profileFilled,
} from "@shared/profile-schema";
import { learningApi } from "../../services/learningApi";
import { getCurrentUser } from "../../services/api";
import { ApiError } from "../../services/apiError";
import { useAsync } from "../../lib/useAsync";
import { ErrorState, LoadingState } from "../../components/ui";
import { formatDateTime } from "../../lib/format";

const editable = PROFILE_QUESTIONS.filter((q) => q.type);
type Buffer = {
  answers: ProfileAnswers;
  other: Record<string, string>;
  version: number;
  saved: string;
  updatedAt: string | null;
};
// Same-tab recovery only. Keys include account and class; no tokens or personal data in localStorage.
const buffers = new Map<string, Buffer>();
export function clearProfileBuffers() {
  buffers.clear();
}
const fingerprint = (answers: ProfileAnswers, other: Record<string, string>) =>
  JSON.stringify({ answers, other });
export function StudentProfilePage() {
  const { classId = "" } = useParams();
  const user = getCurrentUser()!;
  const load = useAsync(
    async () => ({ classId, draft: await learningApi.profile(classId) }),
    [classId],
  );
  if (load.error)
    return <ErrorState error={load.error} onRetry={load.reload} />;
  if (load.loading || load.data?.classId !== classId)
    return <LoadingState label="加载画像草稿…" />;
  return (
    <ProfileForm
      key={user.id + classId}
      classId={classId}
      initial={load.data.draft}
    />
  );
}
function ProfileForm({
  classId,
  initial,
}: {
  classId: string;
  initial: ProfileDraft | null;
}) {
  const key = JSON.stringify([getCurrentUser()!.id, classId]);
  const cached = buffers.get(key);
  const buffered =
    cached && fingerprint(cached.answers, cached.other) !== cached.saved
      ? cached
      : undefined;
  const [answers, setAnswers] = useState<ProfileAnswers>(
    buffered?.answers ?? initial?.answers ?? {},
  );
  const [other, setOther] = useState<Record<string, string>>(
    buffered?.other ?? initial?.other ?? {},
  );
  const [version, setVersion] = useState(
    buffered?.version ?? initial?.version ?? 0,
  );
  const [saved, setSaved] = useState(
    buffered?.saved ??
      fingerprint(initial?.answers ?? {}, initial?.other ?? {}),
  );
  const [updatedAt, setUpdatedAt] = useState(
    buffered?.updatedAt ?? initial?.updatedAt ?? null,
  );
  const [editableOnly, setEditableOnly] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [conflict, setConflict] = useState(false);
  const [serverDraft, setServerDraft] = useState<ProfileDraft | null>(null);
  const [loadingServer, setLoadingServer] = useState(false);
  const [leaveTarget, setLeaveTarget] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const leaving = useRef(false);
  const dirty = fingerprint(answers, other) !== saved;
  const filled = editable.filter((q) =>
    profileFilled(answers[q.id], other[q.id]),
  ).length;
  useEffect(() => {
    buffers.set(key, { answers, other, version, saved, updatedAt });
  }, [key, answers, other, version, saved, updatedAt]);
  useEffect(() => {
    const leave = (e: BeforeUnloadEvent) => {
      if (dirty && !leaving.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    const link = (e: MouseEvent) => {
      const a = (e.target as Element).closest("a");
      if (
        !dirty ||
        !a ||
        a.hash ||
        a.target === "_blank" ||
        e.ctrlKey ||
        e.metaKey ||
        e.button !== 0
      )
        return;
      e.preventDefault();
      e.stopPropagation();
      setLeaveTarget(a.href);
    };
    window.addEventListener("beforeunload", leave);
    document.addEventListener("click", link, true);
    return () => {
      window.removeEventListener("beforeunload", leave);
      document.removeEventListener("click", link, true);
    };
  }, [dirty]);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (saving || conflict) return;
    setSaving(true);
    setError(null);
    try {
      const result = await learningApi.saveProfile(classId, {
        schemaVersion: PROFILE_SCHEMA_VERSION,
        answers,
        other,
        expectedVersion: version,
      });
      setVersion(result.version);
      setUpdatedAt(result.updatedAt);
      setSaved(fingerprint(answers, other));
    } catch (e) {
      setError(e);
      if (e instanceof ApiError && e.status === 409) setConflict(true);
    } finally {
      setSaving(false);
    }
  }
  async function readServer() {
    setLoadingServer(true);
    try {
      const d = await learningApi.profile(classId);
      if (d) setServerDraft(d);
    } catch (e) {
      setError(e);
    } finally {
      setLoadingServer(false);
    }
  }
  function useServer() {
    if (!serverDraft) return;
    setAnswers(serverDraft.answers);
    setOther(serverDraft.other);
    setSaved(fingerprint(serverDraft.answers, serverDraft.other));
    setVersion(serverDraft.version);
    setUpdatedAt(serverDraft.updatedAt);
    setConflict(false);
    setServerDraft(null);
    setError(null);
  }
  function nextEmpty() {
    const q = editable.find((q) => !profileFilled(answers[q.id], other[q.id]));
    if (q) {
      const field = formRef.current?.querySelector<HTMLElement>(
        `#question-${q.id}`,
      );
      field?.scrollIntoView({ block: "start" });
      field
        ?.querySelector<HTMLElement>("input,textarea,select")
        ?.focus({ preventScroll: true });
    }
  }
  return (
    <div className="profile-page">
      <Link to="/student/assignments">← 我的任务</Link>
      <p className="eyebrow">记录自己的学习起点</p>
      <h1>课前学生画像</h1>
      <p className="page-lead">
        从你的经验出发，记录兴趣、学习基础与疑惑。可以分次填写，保存后再回来继续。
      </p>
      <details className="notice-box">
        <summary>填写说明：7题可选填，11题待确认</summary>
        <p>
          画像独立于每期作业，不计分。量表只保留原材料中的1—5选项，未配置含义锚点；未填不会按0分计算。待确认题目只供查看。
        </p>
      </details>
      {!!error && <ErrorState error={error} />}
      {conflict && (
        <div className="notice-box" role="alert">
          <strong>另一处已保存了更新版本。当前输入已保留。</strong>
          <p>
            先查看服务器版本，再决定是否放弃本页输入。这里不会覆盖服务器草稿。
          </p>
          <button type="button" onClick={readServer} disabled={loadingServer}>
            {loadingServer ? "读取中…" : "查看服务器草稿"}
          </button>
          {serverDraft && (
            <div>
              <p>
                服务器版本 {serverDraft.version} ·{" "}
                {formatDateTime(serverDraft.updatedAt)}
              </p>
              <pre className="raw-draft">
                {JSON.stringify(
                  { answers: serverDraft.answers, other: serverDraft.other },
                  null,
                  2,
                )}
              </pre>
              <button type="button" onClick={useServer}>
                放弃本页输入并载入服务器版本
              </button>
            </div>
          )}
        </div>
      )}
      {leaveTarget && (
        <div className="notice-box" role="alert">
          <p>当前有未保存修改，离开前可以先保存。</p>
          <button type="button" onClick={() => setLeaveTarget(null)}>
            继续填写
          </button>{" "}
          <button
            type="button"
            onClick={() => {
              leaving.current = true;
              buffers.delete(key);
              window.location.assign(leaveTarget);
            }}
          >
            放弃未保存修改并离开
          </button>
        </div>
      )}
      <form ref={formRef} onSubmit={save}>
        <div className="form-tools">
          <label className="toggle">
            <input
              type="checkbox"
              checked={editableOnly}
              onChange={(e) => setEditableOnly(e.target.checked)}
            />
            只看可填写题（7题）
          </label>
          <button type="button" onClick={nextEmpty} disabled={filled === 7}>
            前往未填题
          </button>
          <span className="muted">
            {editableOnly ? "显示7题 · 可取消筛选查看全部18题" : "显示全部18题"}
          </span>
        </div>
        <div className="profile-layout">
          <aside className="profile-sidebar">
            <div className="progress-panel">
              <strong>我的填写进度</strong>
              <p aria-live="polite">已填写 {filled} / 7 题</p>
              <progress aria-label="已填写题数" max={7} value={filled} />
              <small>仅表示填写情况，不代表成绩。</small>
            </div>
            <details className="question-nav" open={window.innerWidth > 760}>
              <summary>题目导航</summary>
              <nav aria-label="画像题目导航">
                {PROFILE_QUESTIONS.filter((q) => !editableOnly || q.type).map(
                  (q) => (
                    <a
                      className={
                        profileFilled(answers[q.id], other[q.id])
                          ? "filled"
                          : ""
                      }
                      key={q.id}
                      href={`#question-${q.id}`}
                      aria-label={`第${q.number}题`}
                    >
                      {q.number}
                    </a>
                  ),
                )}
              </nav>
            </details>
          </aside>
          <div>
            {PROFILE_QUESTIONS.filter((q) => !editableOnly || q.type).map(
              (q, i, qs) => (
                <div key={q.id}>
                  {(i === 0 || qs[i - 1].section !== q.section) && (
                    <h2 className="profile-section">{q.section}</h2>
                  )}
                  <fieldset
                    id={`question-${q.id}`}
                    className={"profile-question" + (!q.type ? " pending" : "")}
                    disabled={saving}
                  >
                    <legend>
                      <span className="question-number">{q.number}</span>
                      {q.prompt}
                    </legend>
                    {!q.type && (
                      <details>
                        <summary>题型待确认，暂不采集 · 查看原始选项</summary>
                        <ul>
                          {q.sourceLines.map((line, i) => (
                            <li key={i}>{line}</li>
                          ))}
                        </ul>
                      </details>
                    )}
                    {q.type === "text" && (
                      <>
                        <label className="hint" htmlFor={q.id}>
                          选填文本，最多4000字
                        </label>
                        <textarea
                          id={q.id}
                          value={
                            typeof answers[q.id] === "string"
                              ? (answers[q.id] as string)
                              : ""
                          }
                          maxLength={4000}
                          onChange={(e) =>
                            setAnswers({ ...answers, [q.id]: e.target.value })
                          }
                          placeholder="在这里写下你的回答"
                        />
                      </>
                    )}
                    {q.type === "matrix_scale" && (
                      <>
                        <p className="muted">
                          各项可选填，未填不按0分处理。已填写{" "}
                          {Object.keys(answers[q.id] ?? {}).length} /{" "}
                          {q.rows!.length} 项
                        </p>
                        <div className="profile-matrix">
                          {q.rows!.map((row) => {
                            const value = (answers[q.id] ?? {}) as Record<
                              string,
                              number
                            >;
                            return (
                              <label key={row.id}>
                                {row.label}
                                <select
                                  aria-label={row.label}
                                  id={`${q.id}-${row.id}`}
                                  value={value[row.id] ?? ""}
                                  onChange={(e) => {
                                    const next = { ...value };
                                    if (e.target.value)
                                      next[row.id] = Number(e.target.value);
                                    else delete next[row.id];
                                    setAnswers({ ...answers, [q.id]: next });
                                  }}
                                >
                                  <option value="">未填写</option>
                                  {[1, 2, 3, 4, 5].map((n) => (
                                    <option key={n} value={n}>
                                      {n}
                                    </option>
                                  ))}
                                </select>
                              </label>
                            );
                          })}
                        </div>
                      </>
                    )}
                    {q.type === "multiple_choice" && (
                      <>
                        <p className="muted">可选择多项，也可以暂时留空。</p>
                        <div className="profile-choices">
                          {q.choices!.map((c) => {
                            const value = (answers[q.id] ?? []) as string[];
                            return (
                              <label key={c.id}>
                                <input
                                  type="checkbox"
                                  checked={value.includes(c.id)}
                                  onChange={(e) =>
                                    setAnswers({
                                      ...answers,
                                      [q.id]: e.target.checked
                                        ? [...value, c.id]
                                        : value.filter((x) => x !== c.id),
                                    })
                                  }
                                />
                                {c.label}
                              </label>
                            );
                          })}
                        </div>
                        {["profile-14", "profile-16"].includes(q.id) && (
                          <label>
                            其他补充（选填）
                            <input
                              type="text"
                              maxLength={4000}
                              value={other[q.id] ?? ""}
                              onChange={(e) =>
                                setOther({ ...other, [q.id]: e.target.value })
                              }
                            />
                          </label>
                        )}
                      </>
                    )}
                  </fieldset>
                </div>
              ),
            )}
          </div>
        </div>
        <div className="profile-save">
          <div aria-live="polite">
            <strong>
              {dirty ? "有修改尚未保存" : updatedAt ? "已保存草稿" : "尚未保存"}
            </strong>
            {updatedAt && <small>上次保存：{formatDateTime(updatedAt)}</small>}
          </div>
          <button
            className="primary"
            type="submit"
            disabled={saving || conflict}
          >
            {saving ? "保存中…" : "保存画像草稿"}
          </button>
        </div>
      </form>
    </div>
  );
}
