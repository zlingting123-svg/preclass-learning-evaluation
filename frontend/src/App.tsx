import { useEffect } from "react";
import {
  BrowserRouter,
  Navigate,
  Outlet,
  Route,
  Routes,
  useNavigate,
} from "react-router-dom";
import { getCurrentUser, setUnauthorizedHandler } from "./services/api";
import { Layout } from "./components/Layout";
import { LoginPage } from "./pages/LoginPage";
import { AdminConsole } from "./pages/AdminPage";
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
  useEffect(() => {
    setUnauthorizedHandler(() => navigate("/login", { replace: true }));
    return () => setUnauthorizedHandler(null);
  }, [navigate]);
  return null;
}
function RequireRole({ teacher = false }: { teacher?: boolean }) {
  const user = getCurrentUser();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === "admin") return <Navigate to="/admin" replace />;
  if (teacher && user.role !== "teacher") return <Navigate to="/" replace />;
  return <Outlet />;
}
function AdminEntry() {
  return getCurrentUser()?.role === "admin" ? (
    <AdminConsole />
  ) : (
    <Navigate to="/login" replace />
  );
}
export function App() {
  return (
    <BrowserRouter>
      <AuthBridge />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/admin" element={<AdminEntry />} />
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
