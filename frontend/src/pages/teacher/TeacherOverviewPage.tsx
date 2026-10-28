import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { ClassInfo } from '@shared/contracts'
import { api } from '../../services/api'
import { useAsync } from '../../lib/useAsync'
import { EmptyState, ErrorState, LoadingState } from '../../components/ui'
import { JoinCode } from '../../components/JoinCode'
import { loadPages } from '../../lib/loadPages'

export function TeacherOverviewPage() {
  const classes = useAsync(async () => {
    const [classPage, cohortPage] = await Promise.all([
      loadPages(q => api.listClasses(q)), loadPages(q => api.listCohorts(q)),
    ])
    return { items: classPage.items, cohorts: cohortPage.items }
  }, [])
  const [cohortId, setCohortId] = useState('')
  const [newCohortId, setNewCohortId] = useState('')
  const [name, setName] = useState('')
  const [createError, setCreateError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || creating) return
    setCreateError(null)
    setCreating(true)
    try {
      await api.createClass({ name: name.trim(), ...(newCohortId ? { cohortId: newCohortId } : {}) })
      setName('')
      setCohortId(newCohortId || 'legacy')
      classes.reload()
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : '创建班级失败')
    } finally {
      setCreating(false)
    }
  }

  if (classes.loading) return <LoadingState label="加载班级…" />
  if (classes.error) return <ErrorState error={classes.error} onRetry={classes.reload} />

  const cohorts = classes.data?.cohorts ?? []
  const items = (classes.data?.items ?? []).filter(c =>
    !cohortId || (cohortId === 'legacy' ? !c.cohortId : c.cohortId === cohortId))

  return (
    <div>
      <p className="eyebrow">教师工作台</p><h1>班级概览</h1><p className="page-lead">从学生的起点出发，安排每一次课前学习。</p>
      <div className="field">
        <label htmlFor="teacherCohortFilter">教学批次</label>
        <select id="teacherCohortFilter" value={cohortId} onChange={e => setCohortId(e.target.value)}>
          <option value="">全部批次与历史班级</option>
          <option value="legacy">未关联批次的历史班级</option>
          {cohorts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      <button type="button" onClick={classes.reload}>刷新班级与批次</button>

      <div className="card">
        <h2>创建班级</h2>
        <form onSubmit={handleCreate}>
          <div className="field">
            <label htmlFor="newClassCohort">新班级所属批次</label>
            <select id="newClassCohort" value={newCohortId} onChange={e => setNewCohortId(e.target.value)} disabled={creating}>
              <option value="">不关联批次（沿用历史班级方式）</option>
              {cohorts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="className">班级名称</label>
            <div className="row-between" style={{ alignItems: 'stretch' }}>
              <input
                id="className"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={{ flex: 1 }}
              />
              <button type="submit" disabled={creating} style={{ marginLeft: 8 }}>
                {creating ? '创建中…' : '创建'}
              </button>
            </div>
          </div>
        </form>
        {createError && <div className="error-box">{createError}</div>}
      </div>

      {items.length === 0 ? (
        <EmptyState label={cohortId ? '当前筛选下暂无班级' : '尚未创建班级'} />
      ) : (
        <ul className="list">
          {items.map((c: ClassInfo) => (
            <li key={c.id}>
              <div className="row-between">
                <Link to={`/teacher/classes/${c.id}`} style={{ fontWeight: 600 }}>
                  {c.name}
                </Link>
                <span className="muted">成员 {c.memberCount} 人</span>
              </div>
              <JoinCode code={c.joinCode} />
              <div className="muted">{cohorts.find(cohort => cohort.id === c.cohortId)?.name ?? (c.cohortId ? '教学批次信息待刷新' : '未关联批次')}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
