import { lazy, Suspense, useEffect } from 'react'
import {
  BrowserRouter,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from 'react-router-dom'
import { getCurrentUser, setUnauthorizedHandler } from './services/api'
import { Layout } from './components/Layout'
import { LoginPage } from './pages/LoginPage'
import { API_MODE } from './config'
const DemoStatesPage = lazy(() => import('./pages/DemoStatesPage').then(m => ({ default: m.DemoStatesPage })))
import { StudentTaskListPage } from './pages/student/StudentTaskListPage'
import { StudentAnswerPage } from './pages/student/StudentAnswerPage'
import { StudentReportPage } from './pages/student/StudentReportPage'
import { TeacherOverviewPage } from './pages/teacher/TeacherOverviewPage'
import { TeacherClassPage } from './pages/teacher/TeacherClassPage'
import { TeacherAssignmentEditPage } from './pages/teacher/TeacherAssignmentEditPage'
import { TeacherSubmissionsPage } from './pages/teacher/TeacherSubmissionsPage'
import { TeacherReviewPage } from './pages/teacher/TeacherReviewPage'

type Role = 'student' | 'teacher' | 'admin'

/** 401 会话失效时跳转登录（携带 expired 标记，登录页显示提示）。 */
function AuthBridge() {
  const navigate = useNavigate()
  const location = useLocation()
  useEffect(() => {
    setUnauthorizedHandler(() => navigate('/login', { state: { expired: true, from: location.pathname }, replace: true }))
    return () => setUnauthorizedHandler(null)
  }, [navigate, location.pathname])
  return null
}

function RequireRole({ allow }: { allow: Role[] }) {
  const user = getCurrentUser()
  const location = useLocation()
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }
  if (!allow.includes(user.role)) {
    const home = user.role === 'teacher' || user.role === 'admin' ? '/teacher/overview' : '/student/assignments'
    return <Navigate to={home} replace />
  }
  return <Outlet />
}

function HomeRedirect() {
  const user = getCurrentUser()
  if (!user) return <Navigate to="/login" replace />
  return (
    <Navigate
      to={user.role === 'teacher' || user.role === 'admin' ? '/teacher/overview' : '/student/assignments'}
      replace
    />
  )
}

export function App() {
  return (
    <BrowserRouter>
      <AuthBridge />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        {import.meta.env.DEV && API_MODE === 'mock' && <Route path="/demo/states" element={<Suspense fallback={null}><DemoStatesPage /></Suspense>} />}

        <Route element={<RequireRole allow={['student', 'admin']} />}>
          <Route element={<Layout />}>
            <Route path="/student/assignments" element={<StudentTaskListPage />} />
            <Route path="/student/assignments/:id" element={<StudentAnswerPage />} />
            <Route path="/student/report/:submissionId" element={<StudentReportPage />} />
          </Route>
        </Route>

        <Route element={<RequireRole allow={['teacher', 'admin']} />}>
          <Route element={<Layout />}>
            <Route path="/teacher/overview" element={<TeacherOverviewPage />} />
            <Route path="/teacher/classes/:classId" element={<TeacherClassPage />} />
            <Route
              path="/teacher/classes/:classId/assignments/new"
              element={<TeacherAssignmentEditPage />}
            />
            <Route path="/teacher/assignments/:id/edit" element={<TeacherAssignmentEditPage />} />
            <Route
              path="/teacher/assignments/:id/submissions"
              element={<TeacherSubmissionsPage />}
            />
            <Route path="/teacher/submissions/:id" element={<TeacherReviewPage />} />
          </Route>
        </Route>

        <Route path="/" element={<HomeRedirect />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
