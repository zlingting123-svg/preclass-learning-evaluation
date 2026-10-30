import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import type { Assignment, ScoreReport, SubmissionDetail } from '@shared/contracts'
import { api } from '../../services/api'
import { ApiError } from '../../services/apiError'
import { useAsync } from '../../lib/useAsync'
import { formatDateTime } from '../../lib/format'
import { ReportDetail } from '../../components/ReportDetail'
import {
  EmptyState,
  ErrorState,
  LoadingState,
  NoticeBox,
  ScoringBadge,
  SubmissionStateBadge,
} from '../../components/ui'

export function TeacherReviewPage() {
  const { id } = useParams<{ id: string }>()
  const load = useAsync(async () => {
    const detail = await api.getSubmissionDetail(id as string)
    const assignment = detail.submission
      ? await api.getAssignment(detail.submission.assignmentId)
      : null
    return { detail, assignment }
  }, [id])

  const [actionError, setActionError] = useState<string | null>(null)
  const [actionNotice, setActionNotice] = useState<string | null>(null)
  const [retrying, setRetrying] = useState(false)

  async function handleRetry() {
    const submission = (load.data as { detail: SubmissionDetail }).detail.submission
    if (!submission || retrying) return
    setRetrying(true)
    setActionError(null)
    try {
      await api.retryScoring(submission.id, { expectedVersion: submission.version })
      setActionNotice('已重新发起评分任务，请稍后刷新查看结果。')
      load.reload()
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : '重试失败')
    } finally {
      setRetrying(false)
    }
  }

  if (load.loading) return <LoadingState label="加载答卷…" />
  if (load.error) return <ErrorState error={load.error} onRetry={load.reload} />

  const { detail, assignment } = load.data as {
    detail: SubmissionDetail
    assignment: Assignment | null
  }
  const submission = detail.submission

  if (!submission) {
    return <EmptyState label="答卷不存在" />
  }

  return (
    <div>
      <div className="row-between">
        <h1>评分复核</h1>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <SubmissionStateBadge state={submission.state} />
          <ScoringBadge status={submission.scoringStatus} />
        </div>
      </div>
      <div className="muted" style={{ marginBottom: 12 }}>
        学生：{submission.studentName} · 提交时间：{formatDateTime(submission.submittedAt)}
      </div>

      {actionNotice && <div className="success-box">{actionNotice}</div>}
      {actionError && <div className="error-box">{actionError}</div>}
      {submission.failureMessage && (
        <div className="error-box">评分失败信息：{submission.failureMessage}</div>
      )}

      <div className="card">
        <h2>答卷原文</h2>
        {assignment ? (
          assignment.questions.map((q, i) => {
            const ans = submission.answers.find((a) => a.questionId === q.id)
            return (
              <div key={q.id} style={{ marginBottom: 12 }}>
                <div>
                  <strong>
                    {i + 1}. {q.prompt}
                  </strong>
                </div>
                <div className="answer-block">{ans?.text || '（未作答）'}</div>
              </div>
            )
          })
        ) : (
          submission.answers.map((a) => (
            <div key={a.questionId} className="answer-block">
              {a.text}
            </div>
          ))
        )}
      </div>

      {submission.scoringStatus === 'failed' && (
        <div className="card">
          <h2>重试评分</h2>
          <button type="button" onClick={handleRetry} disabled={retrying}>
            {retrying ? '重试中…' : '重新发起评分'}
          </button>
          <div className="muted">仅失败状态可重试，重试仍需防重复与预算控制。</div>
        </div>
      )}

      {detail.report && (
        <>
          <ReportDetail report={detail.report} />
          {detail.report.systemScores && (
            <ReviewForm
              key={`review-${detail.report.version}`}
              submissionId={submission.id}
              report={detail.report}
              onDone={() => {
                load.reload()
              }}
            />
          )}
        </>
      )}

      {!detail.report && submission.scoringStatus !== 'failed' && (
        <NoticeBox>
          {submission.scoringStatus === 'awaiting_rubric'
            ? '该答卷已提交但评价体系尚未配置，暂无可复核内容。'
            : '该答卷评分尚未完成，暂无可复核内容。'}
        </NoticeBox>
      )}

      <div style={{ marginTop: 16 }}>
        <Link to={`/teacher/assignments/${submission.assignmentId}/submissions`}>返回提交列表</Link>
      </div>
    </div>
  )
}

function ReviewForm({
  submissionId,
  report,
  onDone,
}: {
  submissionId: string
  report: ScoreReport
  onDone: () => void
}) {
  const dims = report.systemScores?.dimensions ?? []
  const [scores, setScores] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    for (const d of dims) {
      const reviewed = report.latestReview?.scores.dimensions.find((x) => x.dimensionId === d.dimensionId)
      init[d.dimensionId] = String(reviewed?.score ?? d.score)
    }
    return init
  })
  const [rationales, setRationales] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    for (const d of dims) {
      const reviewed = report.latestReview?.scores.dimensions.find((x) => x.dimensionId === d.dimensionId)
      init[d.dimensionId] = reviewed?.rationale ?? ''
    }
    return init
  })
  const [feedback, setFeedback] = useState(report.latestReview?.scores.feedback ?? '')
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit() {
    setError(null)
    const parsed = dims.map((d) => ({ d, score: Number(scores[d.dimensionId]) }))
    const invalid = parsed.find(
      (p) => !Number.isFinite(p.score) || p.score < 0 || p.score > p.d.maxScore,
    )
    if (invalid) {
      setError(`维度“${invalid.d.name}”的分数需为 0 到 ${invalid.d.maxScore} 之间的数字`)
      return
    }
    if (!reason.trim()) { setError('请填写复核理由'); return }
    setSubmitting(true)
    try {
      await api.review(submissionId, {
        expectedReportVersion: report.version,
        dimensions: parsed.map((p) => ({
          dimensionId: p.d.dimensionId,
          score: p.score,
          rationale: rationales[p.d.dimensionId] ?? '',
        })),
        feedback,
        reason: reason.trim(),
      })
      onDone()
    } catch (err) {
      if (err instanceof ApiError && err.code === 'VERSION_CONFLICT') {
        setError('复核冲突：报告已被其他操作更新，请刷新后重试。')
      } else {
        setError(err instanceof ApiError ? err.message : '复核提交失败')
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (dims.length === 0) {
    return <NoticeBox>该报告暂无评分维度，不能进行人工复核。</NoticeBox>
  }

  return (
    <div className="card">
      <h2>人工复核</h2>
      {report.latestReview && <div className="muted">当前已存在教师复核，再次提交会保留历史并追加新记录。</div>}
      {dims.map((d) => (
        <div className="field" key={d.dimensionId}>
          <label htmlFor={`score-${d.dimensionId}`}>
            {d.name}（满分 {d.maxScore}）
          </label>
          <input
            id={`score-${d.dimensionId}`}
            type="number"
            min={0}
            max={d.maxScore}
            step="0.5"
            value={scores[d.dimensionId] ?? ''}
            onChange={(e) => setScores((prev) => ({ ...prev, [d.dimensionId]: e.target.value }))}
          />
          <input
            type="text"
            placeholder="该维度评分理由"
            value={rationales[d.dimensionId] ?? ''}
            onChange={(e) =>
              setRationales((prev) => ({ ...prev, [d.dimensionId]: e.target.value }))
            }
            style={{ marginTop: 6 }}
          />
        </div>
      ))}
      <div className="field">
        <label htmlFor="feedback">复核评语</label>
        <textarea
          id="feedback"
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor="reason">复核理由（说明为何调整）</label>
        <textarea
          id="reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="例如：系统初评偏保守，人工上调……"
        />
      </div>
      {error && <div className="error-box">{error}</div>}
      <button type="button" className="primary" onClick={handleSubmit} disabled={submitting}>
        {submitting ? '提交中…' : '保存复核'}
      </button>
    </div>
  )
}
