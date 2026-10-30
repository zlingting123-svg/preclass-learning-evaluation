import type { AssignmentState, ScoringStatus } from '@shared/contracts'

/** 统一时区展示：契约时间为 UTC ISO，界面按 Asia/Shanghai 展示。 */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d)
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d)
}

export const ASSIGNMENT_STATE_LABEL: Record<AssignmentState, string> = {
  draft: '草稿',
  published: '已发布',
  closed: '已截止',
}

export const SCORING_STATUS_LABEL: Record<ScoringStatus, string> = {
  not_requested: '未提交',
  awaiting_rubric: '待配置评价体系',
  queued: '评分排队中',
  processing: '评分处理中',
  scored: '已评分',
  needs_review: '待教师复核',
  failed: '评分失败',
}

export const SUBMISSION_STATE_LABEL: Record<'draft' | 'submitted', string> = {
  draft: '草稿',
  submitted: '已提交',
}

/** 归一化到 0–100，校验范围与满分后再计算，避免 NaN。 */
export function normalizeScore(score: number, maxScore: number): number | null {
  if (!Number.isFinite(score) || !Number.isFinite(maxScore) || maxScore <= 0 || score < 0 || score > maxScore) return null
  return Math.round((score / maxScore) * 100)
}

export function deadlineText(deadlineAt: string | null): string {
  if (!deadlineAt) return '无截止时间'
  return formatDateTime(deadlineAt)
}

/** 把 UTC ISO 时间转换为 datetime-local 输入值（使用浏览器本地时区）。 */
export function toLocalDateTimeInput(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** 把 datetime-local 输入值转换为 UTC ISO 字符串；空值返回 null。 */
export function fromLocalDateTimeInput(value: string): string | null {
  if (!value) return null
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString()
}
