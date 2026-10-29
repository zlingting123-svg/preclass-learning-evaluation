import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { API_MODE } from '../config'
import { BrandMark } from '../components/BrandMark'
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
        session.user.role === 'admin' ? '/admin' : session.user.role === 'teacher'
          ? '/teacher/overview'
          : '/student/assignments'
      const from = (location.state as { from?: unknown } | null)?.from
      const prefix = session.user.role === 'admin' ? '/admin' : session.user.role === 'student' ? '/student/' : '/teacher/'
      navigate(typeof from === 'string' && (from.startsWith(prefix)||(session.user.role==='student'&&/^\/core\/classes\/[a-zA-Z0-9_-]+\/assistant$/.test(from))) ? from : home, { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '登录失败，请稍后重试')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="app login-page">
      <DemoBanner />
      <aside className="login-story"><span className="brand"><BrandMark /> 学习平台</span><p className="eyebrow">环境评价与管理</p><h2>从课前的一次思考开始</h2><p>在班级中完成问卷，与课程问题保持连接。</p><ol><li>进入所属班级</li><li>填写教师问卷</li><li>使用课程 AI 助手</li></ol></aside>
      <main className="app-main" style={{ maxWidth: 420 }}>
        <p className="eyebrow">学习平台</p><h1>登录</h1><p className="page-lead">欢迎回来，继续你的学习。</p>
        {expired && <div className="notice-box">会话已过期，请重新登录。</div>}
        {error && <ErrorState error={error} />}
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="username">学号 / 教师账号</label>
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
        <p style={{marginTop:24,fontSize:12}}><a href="/admin/login">服务管理员登录 →</a></p>
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
