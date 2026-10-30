import type {
  CourseMaterial,
  MaterialInput,
  ProfileDraft,
  ProfileInput,
  ProfileOverview,
} from "@shared/learning";
import type { Page } from "@shared/contracts";
import { apiRequest, parseApiResponse } from "./httpClient";
import { API_BASE_URL, API_MODE } from "../config";
import { getAccessToken } from "./authStore";
import { ApiError } from "./apiError";
import type { PageQuery } from "./apiTypes";
const enc = encodeURIComponent;
function query(p: PageQuery = {}) {
  const v = new URLSearchParams();
  if (p.limit) v.set("limit", String(p.limit));
  if (p.cursor) v.set("cursor", p.cursor);
  return v.size ? "?" + v.toString() : "";
}
function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  if (API_MODE === "mock")
    return Promise.reject(
      new ApiError(
        "HTTP_REQUIRED",
        "画像与课程材料需要连接本地后台，请使用HTTP模式。",
        503,
      ),
    );
  return apiRequest(method, path, { body });
}
export const learningApi = {
  profile: (classId: string) =>
    request<ProfileDraft | null>("GET", `/classes/${enc(classId)}/my-profile`),
  saveProfile: (classId: string, input: ProfileInput) =>
    request<ProfileDraft>("PUT", `/classes/${enc(classId)}/my-profile`, input),
  profiles: (classId: string, p?: PageQuery) =>
    request<Page<ProfileOverview>>(
      "GET",
      `/teacher/classes/${enc(classId)}/profiles${query(p)}`,
    ),
  detail: (classId: string, studentId: string) =>
    request<ProfileDraft>(
      "GET",
      `/teacher/classes/${enc(classId)}/profiles/${enc(studentId)}`,
    ),
  materials: (classId: string, p?: PageQuery) =>
    request<Page<CourseMaterial>>(
      "GET",
      `/classes/${enc(classId)}/materials${query(p)}`,
    ),
  material: (id: string) =>
    request<CourseMaterial>("GET", `/materials/${enc(id)}`),
  saveMaterial: (classId: string, input: MaterialInput, id?: string) =>
    request<CourseMaterial>(
      id ? "PUT" : "POST",
      id
        ? `/teacher/materials/${enc(id)}`
        : `/teacher/classes/${enc(classId)}/materials`,
      input,
    ),
  publishMaterial: (id: string, expectedVersion: number) =>
    request<CourseMaterial>("POST", `/teacher/materials/${enc(id)}/publish`, {
      expectedVersion,
    }),
  async exportProfiles(classId: string) {
    const token = getAccessToken();
    let res: Response;
    try {
      res = await fetch(
        `${API_BASE_URL}/api/v1/teacher/classes/${enc(classId)}/profiles/export`,
        { headers: token ? { Authorization: `Bearer ${token}` } : {} },
      );
    } catch {
      throw new ApiError("NETWORK_ERROR", "无法连接服务器，导出未完成", 0);
    }
    if (!res.ok) {
      await parseApiResponse(res, !!token);
      throw new Error("导出失败");
    }
    if (!res.headers.get("Content-Type")?.includes("text/csv"))
      throw new Error("服务器未返回CSV");
    return res.blob();
  },
};
