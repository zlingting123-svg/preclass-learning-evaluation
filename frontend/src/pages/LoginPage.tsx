import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { API_MODE } from '../config'
import { DemoBanner } from '../components/DemoBanner'
import { ErrorState } from '../components/ui'
import { api, setSession } from '../services/api'
import { ApiError } from '../services/apiError'

export function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const expired = (location.state as { expired?: boolean } | null)?.expired

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (submitting) return
    setError(null)
    setSubmitting(true)
    try {
      const session = await api.login({ username, password })
      setSession(session)
      const home =
        session.user.role === 'teacher' || session.user.role === 'admin'
          ? '/teacher/overview'
          : '/student/assignments'
      const from = (location.state as { from?: unknown } | null)?.from
      const prefix = session.user.role === 'student' ? '/student/' : '/teacher/'
      navigate(typeof from === 'string' && from.startsWith(prefix) ? from : home, { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '登录失败，请稍后重试')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="app">
      <DemoBanner />
      <main className="app-main" style={{ maxWidth: 420 }}>
        <h1>登录</h1>
        {expired && <div className="notice-box">会话已过期，请重新登录。</div>}
        {error && <ErrorState error={error} />}
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="username">用户名</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
            />
          </div>
          <div className="field">
            <label htmlFor="password">密码</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>
          <button type="submit" className="primary" disabled={submitting} style={{ width: '100%' }}>
            {submitting ? '登录中…' : '登录'}
          </button>
        </form>
        {API_MODE === 'mock' && (
          <div className="card" style={{ marginTop: 16 }}>
            <h3>演示账号（仅演示模式）</h3>
            <p className="muted">以下账号仅用于演示，不能冒充正式账号：</p>
            <ul>
              <li>学生：<code>student</code> / <code>demo123</code></li>
              <li>教师：<code>teacher</code> / <code>demo123</code></li>
              <li>会话过期演示：<code>expired</code> / <code>demo123</code></li>
            </ul>
          </div>
        )}
      </main>
    </div>
  )
}
