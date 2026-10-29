import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { Assignment, ClassInfo } from '@shared/contracts'
import { api } from '../../services/api'
import { useAsync } from '../../lib/useAsync'
import { deadlineText } from '../../lib/format'
import { EmptyState, ErrorState, LoadingState } from '../../components/ui'
import { ClassLearning } from '../../components/ClassLearning'
import { loadPages } from '../../lib/loadPages'

export function StudentTaskListPage() {
  const classes = useAsync(async () => {
    const [classPage, cohortPage] = await Promise.all([
      loadPages(q => api.listClasses(q)), loadPages(q => api.listCohorts(q)),
    ])
    return { items: classPage.items, cohorts: cohortPage.items }
  }, [])
  const [cohortId, setCohortId] = useState('')
  const [classId, setClassId] = useState<string>('')
  const classItems = (classes.data?.items ?? []).filter(c =>
    !cohortId || (cohortId === 'legacy' ? !c.cohortId : c.cohortId === cohortId))
  const today = new Date().toISOString().slice(0, 10)
  const currentClass = classItems.find(c => classes.data?.cohorts.some(cohort => cohort.id === c.cohortId && cohort.startsOn <= today && cohort.endsOn >= today))
  const selected = classItems.some(c => c.id === classId) ? classId : currentClass?.id ?? classItems[0]?.id ?? ''
  const assignments = useAsync(
    async () => ({ classId: selected, items: selected
      ? (await loadPages(q => api.listAssignments({ ...q, classId: selected }))).items : [] }),
    [selected, classes.data],
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
      const joined = await api.joinClass({ joinCode: joinCode.trim() })
      setJoinCode('')
      setCohortId(joined.cohortId || 'legacy')
      setClassId(joined.id)
      classes.reload()
    } catch (err) {
      setJoinError(err instanceof Error ? err.message : '加入班级失败')
    } finally {
      setJoining(false)
    }
  }

  if (classes.loading) return <LoadingState label="加载班级…" />
  if (classes.error) return <ErrorState error={classes.error} onRetry={classes.reload} />

  if (!classes.data?.items.length) {
    return (
      <div>
        <p className="eyebrow">每一次思考，都是学习的开始</p><h1>我的任务</h1><p className="page-lead">阅读课程材料，记录学习起点，完成自己的课前准备。</p>
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
      <p className="eyebrow">每一次思考，都是学习的开始</p><h1>我的任务</h1><p className="page-lead">阅读课程材料，记录学习起点，完成自己的课前准备。</p>
      <button type="button" onClick={() => { classes.reload() }}>刷新任务</button>

      <div className="card course-filters">
        <div className="field">
          <label htmlFor="studentCohortFilter">教学批次</label>
          <select id="studentCohortFilter" value={cohortId} onChange={e => { setCohortId(e.target.value); setClassId('') }}>
            <option value="">全部批次与历史班级</option>
            <option value="legacy">未关联批次的历史班级</option>
            {classes.data?.cohorts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="studentClass">班级</label>
          <select id="studentClass" value={selected} disabled={!classItems.length} onChange={(e) => setClassId(e.target.value)}>
            {!classItems.length && <option value="">当前筛选下暂无班级</option>}
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

      {selected && <ClassLearning key={selected} classId={selected} />}
      <h2>课前作业</h2>
      {!selected && <EmptyState label="当前筛选下暂无班级" />}
      {selected && (assignments.loading || assignments.data?.classId !== selected) && !assignments.error && <LoadingState label="加载作业…" />}
      {selected && assignments.error && <ErrorState error={assignments.error} onRetry={assignments.reload} />}
      {selected && assignments.data?.classId === selected && !assignments.loading && !assignments.error && (
        <AssignmentList items={assignments.data?.items ?? []} />
      )}
    </div>
  )
}

function AssignmentList({ items }: { items: Assignment[] }) {
  if (items.length === 0) {
    return <EmptyState label="该班级暂无已发布作业" />
  }
  return (
    <ul className="list task-list">
      {items.map((a) => (
        <li key={a.id}>
          {a.mySubmissionState && <span className={'task-state '+a.mySubmissionState}>{a.mySubmissionState==='submitted'?'已提交':a.mySubmissionState==='draft'?'草稿待提交':'未开始'}</span>}
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
