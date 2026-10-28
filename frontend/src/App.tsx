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
  if (teacher && user.role !== "teacher") return <Navigate to="/" replace />;
  return <Outlet />;
}
export function App() {
  return (
    <BrowserRouter>
      <AuthBridge />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
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
