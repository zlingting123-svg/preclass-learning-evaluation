import { Link, useParams } from 'react-router-dom'
import type { Assignment, AssignmentSummary } from '@shared/contracts'
import { api } from '../../services/api'
import { useAsync } from '../../lib/useAsync'
import { deadlineText } from '../../lib/format'
import { AssignmentStateBadge, EmptyState, ErrorState, LoadingState } from '../../components/ui'
import { JoinCode } from '../../components/JoinCode'
import { loadPages } from '../../lib/loadPages'

export function TeacherClassPage() {
  const { classId } = useParams<{ classId: string }>()

  const classes = useAsync(() => loadPages(q => api.listClasses(q)), [])
  const load = useAsync(async () => {
    const page = await loadPages(q => api.listAssignments({ ...q, classId: classId as string }))
    const summaries = await Promise.all(
      page.items.map((a) => api.getAssignmentSummary(a.id).catch(() => null)),
    )
    return { items: page.items, summaries }
  }, [classId])

  if (load.loading || classes.loading) return <LoadingState label="加载作业…" />
  if (load.error) return <ErrorState error={load.error} onRetry={load.reload} />
  if (classes.error) return <ErrorState error={classes.error} onRetry={classes.reload} />

  const clsName =
    classes.data?.items.find((c) => c.id === classId)?.name ?? '班级'
  const { items, summaries } = load.data as {
    items: Assignment[]
    summaries: (AssignmentSummary | null)[]
  }

  return (
    <div>
      <div className="row-between">
        <h1>{clsName} · 作业</h1>
        <button type="button" onClick={() => { load.reload(); classes.reload() }}>刷新作业</button>
        <Link className="button primary" to={`/teacher/classes/${classId}/assignments/new`}>
          新建作业
        </Link>
      </div>

      <JoinCode code={classes.data?.items.find(c => c.id === classId)?.joinCode} />

      {items.length === 0 ? (
        <EmptyState label="暂无作业" hint="点击“新建作业”创建草稿。" />
      ) : (
        <ul className="list">
          {items.map((a, i) => {
            const summary = summaries[i]
            return (
              <li key={a.id}>
                <div className="row-between">
                  <Link
                    to={
                      a.state === 'draft'
                        ? `/teacher/assignments/${a.id}/edit`
                        : `/teacher/assignments/${a.id}/submissions`
                    }
                    style={{ fontWeight: 600 }}
                  >
                    {a.title}
                  </Link>
                  <AssignmentStateBadge state={a.state} />
                </div>
                <div className="muted" style={{ margin: '4px 0' }}>
                  截止：{deadlineText(a.deadlineAt)} ·{' '}
                  {summary
                    ? `已提交 ${summary.submittedCount} / 未提交 ${summary.unsubmittedCount}`
                    : '—'}
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {(
                    <Link className="button small" to={`/teacher/assignments/${a.id}/edit`}>
                      {a.state === 'draft' ? '编辑' : '管理作业'}
                    </Link>
                  )}
                  <Link className="button small" to={`/teacher/assignments/${a.id}/submissions`}>
                    提交列表
                  </Link>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
