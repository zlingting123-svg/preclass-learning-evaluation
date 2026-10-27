import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { ClassInfo } from '@shared/contracts'
import { api } from '../../services/api'
import { useAsync } from '../../lib/useAsync'
import { deadlineText } from '../../lib/format'
import { EmptyState, ErrorState, LoadingState } from '../../components/ui'
import { loadPages } from '../../lib/loadPages'

export function StudentTaskListPage() {
  const classes = useAsync(() => loadPages(q => api.listClasses(q)), [])
  const [classId, setClassId] = useState<string>('')
  const selected = classId || classes.data?.items[0]?.id || ''
  const assignments = useAsync(
    () => loadPages(q => api.listAssignments({ ...q, classId: selected || undefined })),
    [selected],
  )

  const [joinCode, setJoinCode] = useState('')
  const [joinError, setJoinError] = useState<string | null>(null)
  const [joining, setJoining] = useState(false)

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault()
    if (!joinCode.trim() || joining) return
    setJoinError(null)
    setJoining(true)
    try {
      await api.joinClass({ joinCode: joinCode.trim() })
      setJoinCode('')
      classes.reload()
    } catch (err) {
      setJoinError(err instanceof Error ? err.message : '加入班级失败')
    } finally {
      setJoining(false)
    }
  }

  if (classes.loading) return <LoadingState label="加载班级…" />
  if (classes.error) return <ErrorState error={classes.error} onRetry={classes.reload} />

  const classItems = classes.data?.items ?? []

  if (classItems.length === 0) {
    return (
      <div>
        <h1>我的任务</h1>
        <EmptyState label="尚未加入任何班级" hint="可输入班级加入码加入班级。" />
        <JoinForm
          joinCode={joinCode}
          setJoinCode={setJoinCode}
          joinError={joinError}
          joining={joining}
          onSubmit={handleJoin}
        />
      </div>
    )
  }

  return (
    <div>
      <h1>我的任务</h1>
      <button type="button" onClick={() => { classes.reload(); assignments.reload() }}>刷新任务</button>

      <div className="card">
        <div className="field">
          <label>班级</label>
          <select value={selected} onChange={(e) => setClassId(e.target.value)}>
            {classItems.map((c: ClassInfo) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <JoinForm
          joinCode={joinCode}
          setJoinCode={setJoinCode}
          joinError={joinError}
          joining={joining}
          onSubmit={handleJoin}
        />
      </div>

      {assignments.loading && <LoadingState label="加载作业…" />}
      {assignments.error && <ErrorState error={assignments.error} onRetry={assignments.reload} />}
      {!assignments.loading && !assignments.error && (
        <AssignmentList items={assignments.data?.items ?? []} />
      )}
    </div>
  )
}

function AssignmentList({ items }: { items: { id: string; title: string; deadlineAt: string | null }[] }) {
  if (items.length === 0) {
    return <EmptyState label="该班级暂无已发布作业" />
  }
  return (
    <ul className="list">
      {items.map((a) => (
        <li key={a.id}>
          <div className="row-between">
            <Link to={`/student/assignments/${a.id}`} style={{ fontWeight: 600 }}>
              {a.title}
            </Link>
            <span className="muted">截止：{deadlineText(a.deadlineAt)}</span>
          </div>
        </li>
      ))}
    </ul>
  )
}

interface JoinFormProps {
  joinCode: string
  setJoinCode: (v: string) => void
  joinError: string | null
  joining: boolean
  onSubmit: (e: React.FormEvent) => void
}

function JoinForm({ joinCode, setJoinCode, joinError, joining, onSubmit }: JoinFormProps) {
  return (
    <form onSubmit={onSubmit}>
      <div className="field">
        <label>加入班级</label>
        <div className="row-between" style={{ alignItems: 'stretch' }}>
          <input
            type="text"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
            placeholder="输入教师提供的班级加入码"
            style={{ flex: 1 }}
          />
          <button type="submit" disabled={joining} style={{ marginLeft: 8 }}>
            {joining ? '加入中…' : '加入'}
          </button>
        </div>
        <div className="hint">加入码由教师提供，不能授予教师身份。</div>
      </div>
      {joinError && <div className="error-box">{joinError}</div>}
    </form>
  )
}
