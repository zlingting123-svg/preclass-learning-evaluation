import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { ProfileDraft } from "@shared/learning";
import { readableProfile } from "@shared/profile-schema";
import { learningApi } from "../../services/learningApi";
import { useAsync } from "../../lib/useAsync";
import { formatDateTime } from "../../lib/format";
import { ErrorState, LoadingState } from "../../components/ui";
export function TeacherProfilesPage() {
  const { classId = "" } = useParams();
  const [cursors, setCursors] = useState<(string | undefined)[]>([undefined]);
  const cursor = cursors.at(-1);
  const load = useAsync(
    async () => ({
      classId,
      cursor,
      ...(await learningApi.profiles(classId, { cursor })),
    }),
    [classId, cursor],
  );
  const [search, setSearch] = useState("");
  const [answeredOnly, setAnsweredOnly] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [exporting, setExporting] = useState(false);
  async function download() {
    setExporting(true);
    try {
      const blob = await learningApi.exportProfiles(classId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "profiles.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e);
    } finally {
      setExporting(false);
    }
  }
  if (load.error)
    return <ErrorState error={load.error} onRetry={load.reload} />;
  if (
    load.loading ||
    load.data?.classId !== classId ||
    load.data.cursor !== cursor
  )
    return <LoadingState label="加载本班画像…" />;
  const items = load.data.items.filter((r) =>
    (r.studentName + " " + (r.studentNumber ?? ""))
      .toLowerCase()
      .includes(search.trim().toLowerCase()),
  );
  return (
    <div>
      <Link to={`/teacher/classes/${classId}`}>← 返回班级</Link>
      <p className="eyebrow">了解学生的起点</p>
      <h1>本班画像草稿</h1>
      <p className="page-lead">画像不计分。未填写与未确认题目不按0分处理。</p>
      {!!error && <ErrorState error={error} />}
      <div className="form-tools">
        <label>
          查找本页学生
          <input
            type="search"
            placeholder="输入学号或姓名"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <button type="button" disabled={exporting} onClick={download}>
          {exporting ? "导出中…" : "导出本班画像CSV"}
        </button>
        <button type="button" onClick={load.reload}>
          刷新画像
        </button>
      </div>
      <label className="toggle">
        <input
          type="checkbox"
          checked={answeredOnly}
          onChange={(e) => setAnsweredOnly(e.target.checked)}
        />
        只看已填写内容
      </label>
      <p className="hint">
        搜索仅针对当前页；导出包含本班全部草稿。表格软件导入时，请将学号列设为文本，以保留前导零。
      </p>
      {!items.length && (
        <p className="card">
          {search ? "本页没有匹配学生。" : "本页还没有画像草稿。"}
        </p>
      )}
      {items.map((row) => (
        <section className="card profile-report" key={row.id}>
          <div className="row-between">
            <div>
              <strong>{row.studentName}</strong>
              <p className="muted">
                {row.studentNumber ? "学号 " + row.studentNumber : "未登记学号"}{" "}
                · 已填写{row.filledCount}/7题
              </p>
            </div>
            <span className="muted">
              {formatDateTime(row.updatedAt)} · 版本{row.version}
            </span>
          </div>
          <ProfileDetail
            classId={classId}
            studentId={row.studentId}
            version={row.version}
            answeredOnly={answeredOnly}
          />
        </section>
      ))}
      <div className="form-tools">
        <button
          disabled={cursors.length === 1}
          onClick={() => setCursors(cursors.slice(0, -1))}
        >
          上一页
        </button>
        <span>第{cursors.length}页</span>
        <button
          disabled={!load.data.nextCursor}
          onClick={() => setCursors([...cursors, load.data!.nextCursor!])}
        >
          下一页
        </button>
      </div>
    </div>
  );
}
function ProfileDetail({
  classId,
  studentId,
  version,
  answeredOnly,
}: {
  classId: string;
  studentId: string;
  version: number;
  answeredOnly: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<ProfileDraft | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && (!draft || draft.version !== version)) {
      setBusy(true);
      setError(null);
      try {
        setDraft(await learningApi.detail(classId, studentId));
      } catch (e) {
        setError(e);
      } finally {
        setBusy(false);
      }
    }
  }
  const answers = draft
    ? readableProfile(draft.answers, draft.other).filter(
        (q) => !answeredOnly || q.value.trim(),
      )
    : [];
  return (
    <div>
      <button type="button" onClick={toggle} aria-expanded={open}>
        {open ? "收起已保存内容" : "查看已保存内容"}
      </button>
      {open && (
        <div>
          {!!error && <ErrorState error={error} />}{" "}
          {busy ? (
            <LoadingState label="读取这份画像…" />
          ) : (
            draft && (
              <dl>
                {answers.map((q) => (
                  <div className="profile-answer" key={q.label}>
                    <dt>{q.label}</dt>
                    <dd>{q.value || "未填写"}</dd>
                  </div>
                ))}
                {!answers.length && (
                  <p className="muted">这份草稿尚未填写任何内容。</p>
                )}
              </dl>
            )
          )}
        </div>
      )}
    </div>
  );
}
