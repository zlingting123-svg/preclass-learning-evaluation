import { useState } from "react";
import { Link } from "react-router-dom";
import { learningApi } from "../services/learningApi";
import { useAsync } from "../lib/useAsync";
import { loadPages } from "../lib/loadPages";
import { API_MODE } from "../config";
import { ErrorState, LoadingState } from "./ui";

export function ClassLearning({
  classId,
  teacher = false,
}: {
  classId: string;
  teacher?: boolean;
}) {
  const load = useAsync(
    async () => ({
      classId,
      ...(await loadPages((q) => learningApi.materials(classId, q))),
    }),
    [classId],
  );
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await learningApi.saveMaterial(classId, {
        title,
        content,
        expectedVersion: 0,
      });
      setTitle("");
      setContent("");
      load.reload();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  async function publish(id: string, version: number) {
    setBusy(true);
    setError(null);
    try {
      await learningApi.publishMaterial(id, version);
      load.reload();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  if (API_MODE === "mock")
    return (
      <p className="notice-box">画像与课程材料请在HTTP本地集成模式体验。</p>
    );
  return (
    <section className="learning-block">
      <div className="learning-links">
        <div>
          <span className="eyebrow">学习起点</span>
          <h2>课前学生画像</h2>
          <p className="muted">7题可选填 · 独立于作业 · 不计成绩</p>
        </div>
        <Link
          className="button"
          to={
            teacher
              ? `/teacher/classes/${classId}/profiles`
              : `/student/classes/${classId}/profile`
          }
        >
          {teacher ? "查看本班画像与导出" : "填写或继续画像 →"}
        </Link>
      </div>
      <h2>课程材料</h2>
      {!!error && <ErrorState error={error} />}
      {load.error ? (
        <ErrorState error={load.error} onRetry={load.reload} />
      ) : load.loading || load.data?.classId !== classId ? (
        <LoadingState label="加载课程材料…" />
      ) : load.data.items.length ? (
        <ul className="list material-list">
          {load.data.items.map((m) => (
            <li key={m.id}>
              <div>
                <Link
                  to={`/${teacher ? "teacher" : "student"}/materials/${m.id}`}
                >
                  {m.title}
                </Link>
                <span className="muted">
                  {" "}
                  · {m.state === "published" ? "已发布" : "草稿，仅教师可见"}
                </span>
              </div>
              {teacher && m.state === "draft" && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => publish(m.id, m.version)}
                >
                  发布材料
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">教师还没有发布课程材料。</p>
      )}
      {teacher && (
        <details className="card">
          <summary>新建课程材料</summary>
          <form onSubmit={create}>
            <label>
              材料标题
              <input
                required
                maxLength={200}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </label>
            <label>
              材料正文（纯文本）
              <textarea
                required
                maxLength={30000}
                rows={8}
                value={content}
                onChange={(e) => setContent(e.target.value)}
              />
            </label>
            <p className="hint">
              先保存草稿，核对后发布给本班学生。发布后正文只读。
            </p>
            <button
              type="submit"
              disabled={busy || !title.trim() || !content.trim()}
            >
              保存材料草稿
            </button>
          </form>
        </details>
      )}
    </section>
  );
}
