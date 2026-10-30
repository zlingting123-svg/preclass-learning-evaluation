import type { AssignmentState, ScoringStatus } from '@shared/contracts'
import { ApiError } from '../services/apiError'
import {
  ASSIGNMENT_STATE_LABEL,
  SCORING_STATUS_LABEL,
  SUBMISSION_STATE_LABEL,
} from '../lib/format'

export function LoadingState({ label = '加载中…' }: { label?: string }) {
  return (
    <div className="center-state">
      <div className="spin" aria-hidden="true" />
      <div style={{ marginTop: 8 }}>{label}</div>
    </div>
  )
}

export function EmptyState({ label = '暂无数据', hint }: { label?: string; hint?: string }) {
  return (
    <div className="center-state">
      <div className="icon" aria-hidden="true">
        ○
      </div>
      <div>{label}</div>
      {hint && <div className="muted" style={{ marginTop: 4 }}>{hint}</div>}
    </div>
  )
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const message =
    typeof error === 'string'
      ? error
      : error instanceof ApiError
        ? error.message
        : error instanceof Error
          ? error.message
          : '发生未知错误'
  const requestId = error instanceof ApiError ? error.requestId : undefined
  return (
    <div className="error-box" role="alert">
      <div>{message}</div>
      {requestId && <span className="request-id">请求标识：{requestId}</span>}
      {onRetry && (
        <button type="button" className="small" style={{ marginTop: 8 }} onClick={onRetry}>
          重试
        </button>
      )}
    </div>
  )
}

export function NoticeBox({ children }: { children: React.ReactNode }) {
  return <div className="notice-box">{children}</div>
}

export function SuccessBox({ children }: { children: React.ReactNode }) {
  return <div className="success-box">{children}</div>
}

export function ScoringBadge({ status }: { status: ScoringStatus }) {
  return <span className={`badge ${status}`}>{SCORING_STATUS_LABEL[status]}</span>
}

export function AssignmentStateBadge({ state }: { state: AssignmentState }) {
  return <span className={`badge ${state}`}>{ASSIGNMENT_STATE_LABEL[state]}</span>
}

export function SubmissionStateBadge({ state }: { state: 'draft' | 'submitted' }) {
  return <span className={`badge ${state}`}>{SUBMISSION_STATE_LABEL[state]}</span>
}
