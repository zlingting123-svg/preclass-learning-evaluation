import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { ClassInfo } from '@shared/contracts'
import { api } from '../../services/api'
import { useAsync } from '../../lib/useAsync'
import { EmptyState, ErrorState, LoadingState } from '../../components/ui'
import { JoinCode } from '../../components/JoinCode'
import { loadPages } from '../../lib/loadPages'

export function TeacherOverviewPage() {
  const classes = useAsync(() => loadPages(q => api.listClasses(q)), [])
  const [name, setName] = useState('')
  const [createError, setCreateError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || creating) return
    setCreateError(null)
    setCreating(true)
    try {
      await api.createClass({ name: name.trim() })
      setName('')
      classes.reload()
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : '创建班级失败')
    } finally {
      setCreating(false)
    }
  }

  if (classes.loading) return <LoadingState label="加载班级…" />
  if (classes.error) return <ErrorState error={classes.error} onRetry={classes.reload} />

  const items = classes.data?.items ?? []

  return (
    <div>
      <h1>班级概览</h1>

      <div className="card">
        <h2>创建班级</h2>
        <form onSubmit={handleCreate}>
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
        <EmptyState label="尚未创建班级" />
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
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
