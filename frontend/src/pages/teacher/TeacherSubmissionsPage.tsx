import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import type { Assignment, AssignmentSummary, ScoringStatus, SubmissionOverview } from '@shared/contracts'
import { api } from '../../services/api'
import { useAsync } from '../../lib/useAsync'
import { formatDateTime, SCORING_STATUS_LABEL } from '../../lib/format'
import { EmptyState, ErrorState, LoadingState, ScoringBadge, SubmissionStateBadge } from '../../components/ui'

export function TeacherSubmissionsPage() {
  const { id } = useParams<{ id: string }>()
  const assignment = useAsync(() => api.getAssignment(id as string), [id])
  const summary = useAsync(() => api.getAssignmentSummary(id as string), [id])
  const [cursors, setCursors] = useState<(string | undefined)[]>([undefined])
  useEffect(() => setCursors([undefined]), [id])
  const cursor = cursors.at(-1)
  const submissions = useAsync(async () => ({ assignmentId: id, cursor,
    ...await api.listSubmissions(id as string, { cursor }) }), [id, cursor])

  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const [exportDone, setExportDone] = useState(false)

  async function handleExport() {
    if (exporting) return
    setExporting(true)
    setExportError(null)
    setExportDone(false)
    try {
      const { blob, filename } = await api.exportCsv(id as string)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      setExportDone(true)
    } catch (err) {
      setExportError(err instanceof Error ? err.message : '导出失败')
    } finally {
      setExporting(false)
    }
  }

  if (assignment.loading || summary.loading || submissions.loading) {
    return <LoadingState label="加载提交列表…" />
  }
  if (assignment.error) return <ErrorState error={assignment.error} />
  if (summary.error) return <ErrorState error={summary.error} onRetry={summary.reload} />
  if (submissions.error) return <ErrorState error={submissions.error} onRetry={submissions.reload} />
  // A changed cursor renders before useAsync's effect sets loading. Never label
  // the previous response as the new page during that render.
  if (submissions.data?.assignmentId !== id || submissions.data?.cursor !== cursor) {
    return <LoadingState label="加载提交列表…" />
  }

  const a = assignment.data as Assignment
  const s = summary.data as AssignmentSummary
  const list = submissions.data?.items ?? []

  return (
    <div>
      <div className="row-between">
        <h1>{a.title}</h1>
        <button type="button" onClick={() => { summary.reload(); submissions.reload() }}>刷新提交列表</button>
        <button type="button" onClick={handleExport} disabled={exporting}>
          {exporting ? '导出中…' : '导出 CSV'}
        </button>
      </div>
      {exportDone && <div className="success-box">已开始下载 CSV 文件。</div>}
      {exportError && <div className="error-box">{exportError}</div>}

      <div className="card">
        <h2>完成情况</h2>
        <div className="grid-2">
          <div>班级人数：{s.memberCount}</div>
          <div>已提交：{s.submittedCount}</div>
          <div>未提交：{s.unsubmittedCount}</div>
        </div>
        <div style={{ marginTop: 12 }}>
          <strong>评分状态：</strong>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
            {(Object.keys(s.scoringCounts) as ScoringStatus[]).map((k) => (
              <span key={k} className="muted">
                {SCORING_STATUS_LABEL[k]}：{s.scoringCounts[k]}
              </span>
            ))}
          </div>
        </div>
      </div>

      {list.length === 0 ? (
        <EmptyState label="暂无提交答卷" />
      ) : (
        <ul className="list">
          {list.map((sub: SubmissionOverview) => (
            <li key={sub.id}>
              <div className="row-between">
                <Link to={`/teacher/submissions/${sub.id}`} style={{ fontWeight: 600 }}>
                  {sub.studentName}
                </Link>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                  <SubmissionStateBadge state={sub.state} />
                  <ScoringBadge status={sub.scoringStatus} />
                </div>
              </div>
              <div className="muted" style={{ marginTop: 4 }}>
                提交时间：{formatDateTime(sub.submittedAt)} · 更新时间：{formatDateTime(sub.updatedAt)}
              </div>
            </li>
          ))}
        </ul>
      )}
      <div className="row-between" style={{ marginTop: 16 }}>
        <button type="button" disabled={cursors.length <= 1} onClick={() => setCursors(prev => prev.slice(0, -1))}>上一页</button>
        <span>第 {cursors.length} 页</span>
        <button type="button" disabled={!submissions.data?.nextCursor} onClick={() => setCursors(prev => [...prev, submissions.data!.nextCursor!])}>下一页</button>
      </div>
    </div>
  )
}
