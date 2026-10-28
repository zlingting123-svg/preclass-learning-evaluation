import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { api, clearSession, getCurrentUser } from '../services/api'
import { BrandMark } from './BrandMark'
import { DemoBanner } from './DemoBanner'
import { clearProfileBuffers } from '../pages/learning/StudentProfilePage'
import { clearBuffers } from '../lib/draftBuffer'

export function Layout() {
  const user = getCurrentUser()
  const navigate = useNavigate()

  async function handleLogout() {
    try {
      await api.logout()
    } catch {
      // 注销失败也清理本地会话，允许重新登录。
    }
    clearSession()
    clearBuffers()
    clearProfileBuffers()
    navigate('/login', { replace: true })
  }

  const isTeacher = user?.role === 'teacher' || user?.role === 'admin'

  return (
    <div className="app">
      <DemoBanner />
      <header className="topbar">
        <span className="brand"><BrandMark /> 学习平台</span>
        <nav className="nav" aria-label="主导航">
          {isTeacher ? (
            <NavLink to="/teacher/overview" className={({ isActive }) => (isActive ? 'active' : '')}>
              班级概览
            </NavLink>
          ) : (
            <NavLink to="/student/assignments" className={({ isActive }) => (isActive ? 'active' : '')}>
              我的任务
            </NavLink>
          )}
        </nav>
        <span className="spacer" />
        {user && (
          <>
            <span className="user">{user.displayName}</span>
            <button type="button" className="small" onClick={handleLogout}>
              退出登录
            </button>
          </>
        )}
      </header>
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  )
}

