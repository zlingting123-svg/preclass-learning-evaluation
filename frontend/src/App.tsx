import { AdminApp } from "./pages/admin/AdminApp";
import { AdminLogin } from "./pages/admin/AdminLogin";
import { useEffect } from "react";
import {
  BrowserRouter,
  Navigate,
  Outlet,
  Route,
  Routes,
  useNavigate,
  useLocation,
} from "react-router-dom";
import { getCurrentUser, setUnauthorizedHandler } from "./services/api";
import { Layout } from "./components/Layout";
import { LoginPage } from "./pages/LoginPage";
import {
  CoreHome,
  RosterPage,
  SurveyEditor,
  SurveyAnswer,
  SurveyResults,
  ResponseDetail,
  Assistant,
} from "./pages/Core";
function AuthBridge() {
  const navigate = useNavigate();
  const location = useLocation();
  useEffect(() => {
    setUnauthorizedHandler(() => navigate(location.pathname.startsWith("/admin")?"/admin/login":"/login", { replace: true }));
    return () => setUnauthorizedHandler(null);
  }, [navigate,location.pathname]);
  return null;
}
function RequireRole({ teacher = false }: { teacher?: boolean }) {
  const location=useLocation();
  const user = getCurrentUser();
  if (!user) return <Navigate to="/login" state={{from:location.pathname}} replace />;
  if (teacher && user.role !== "teacher") return <Navigate to="/" replace />;
  return <Outlet />;
}
export function App() {
  return (
    <BrowserRouter>
      <AuthBridge />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin" element={<AdminApp />} />
        <Route path="/admin/accounts" element={<AdminApp tab="accounts" />} />
        <Route path="/admin/api" element={<AdminApp tab="api" />} />
        <Route path="/admin/server" element={<AdminApp tab="server" />} />
        <Route path="/admin/usage" element={<AdminApp tab="usage" />} />
        <Route path="/admin/audit" element={<AdminApp tab="audit" />} />
        <Route element={<RequireRole />}>
          <Route element={<Layout />}>
            <Route path="/" element={<CoreHome />} />
            <Route path="/student/assignments" element={<CoreHome />} />
            <Route path="/teacher/overview" element={<CoreHome />} />
            <Route path="/core/surveys/:id/answer" element={<SurveyAnswer />} />
            <Route
              path="/core/classes/:classId/assistant"
              element={<Assistant />}
            />
            <Route path="/core/responses/:id" element={<ResponseDetail />} />
            <Route element={<RequireRole teacher />}>
              <Route
                path="/core/classes/:classId/roster"
                element={<RosterPage />}
              />
              <Route
                path="/core/classes/:classId/new"
                element={<SurveyEditor />}
              />
              <Route path="/core/surveys/:id/edit" element={<SurveyEditor />} />
              <Route
                path="/core/surveys/:id/stats"
                element={<SurveyResults />}
              />
            </Route>
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
