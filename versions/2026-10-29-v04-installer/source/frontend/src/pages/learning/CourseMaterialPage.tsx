import { Link, useParams } from "react-router-dom";
import { learningApi } from "../../services/learningApi";
import { getCurrentUser } from "../../services/api";
import { useAsync } from "../../lib/useAsync";
import { ErrorState, LoadingState } from "../../components/ui";
export function CourseMaterialPage() {
  const { id = "" } = useParams();
  const load = useAsync(
    async () => ({ id, material: await learningApi.material(id) }),
    [id],
  );
  if (load.error) return <ErrorState error={load.error} />;
  if (load.loading || load.data?.id !== id)
    return <LoadingState label="加载课程材料…" />;
  const m = load.data.material;
  const teacher = getCurrentUser()?.role === "teacher";
  return (
    <article className="course-reading">
      <Link
        to={teacher ? `/teacher/classes/${m.classId}` : "/student/assignments"}
      >
        ← 返回课程
      </Link>
      <p className="eyebrow">
        课程导读 · {m.state === "published" ? "已发布" : "仅教师可见的草稿"}
      </p>
      <h1>{m.title}</h1>
      <div className="reading-text">{m.content}</div>
      <Link
        className="button primary"
        to={teacher ? `/teacher/classes/${m.classId}` : "/student/assignments"}
      >
        {teacher ? "返回班级" : "前往课前任务 →"}
      </Link>
    </article>
  );
}
