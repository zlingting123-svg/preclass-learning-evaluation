import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import type { Answer, Assignment, ScoreReport, Submission } from '@shared/contracts'
import { api, getCurrentUser } from '../../services/api'
import { ApiError } from '../../services/apiError'
import { useAsync } from '../../lib/useAsync'
import { createIdempotencyKey } from '../../lib/idempotency'
import { deadlineText, formatDateTime } from '../../lib/format'
import { bufferKey, readBuffer, writeBuffer, removeBuffer, type DraftBuffer } from '../../lib/draftBuffer'
import {
  EmptyState,
  ErrorState,
  LoadingState,
  ScoringBadge,
  SubmissionStateBadge,
} from '../../components/ui'

export function StudentAnswerPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const load = useAsync(async () => {
    const [assignment, detail] = await Promise.all([
      api.getAssignment(id as string),
      api.getMySubmission(id as string),
    ])
    return { assignment, detail }
  }, [id])

  if (load.loading) return <LoadingState label="加载作业…" />
  if (load.error) return <ErrorState error={load.error} onRetry={load.reload} />
  const { assignment, detail } = load.data as {
    assignment: Assignment
    detail: { submission: Submission | null; report: ScoreReport | null }
  }
  const submission = detail.submission

  const closed =
    assignment.state === 'closed' ||
    (assignment.deadlineAt !== null && new Date(assignment.deadlineAt).getTime() < Date.now())

  if (submission?.state === 'submitted') {
    return <SubmittedView assignment={assignment} submission={submission} />
  }
  if (closed) {
    return <ClosedView assignment={assignment} submission={submission} />
  }
  return (
    <EditableForm
      key={assignment.id + String(submission?.version ?? 0)}
      assignment={assignment}
      initial={submission}
      onSubmitted={(submissionId) => navigate(`/student/report/${submissionId}`, { replace: true })}
    />
  )
}

function SubmittedView({ assignment, submission }: { assignment: Assignment; submission: Submission }) {
  return (
    <div>
      <h1>{assignment.title}</h1>
      <div className="success-box">
        已提交 · <SubmissionStateBadge state="submitted" />{' '}
        <ScoringBadge status={submission.scoringStatus} />
      </div>
      <div className="card">
        <h2>我的作答（只读）</h2>
        <AnswersView assignment={assignment} answers={submission.answers} />
      </div>
      <Link className="button primary" to={`/student/report/${submission.id}`}>
        查看报告
      </Link>
    </div>
  )
}

function ClosedView({ assignment, submission }: { assignment: Assignment; submission: Submission | null }) {
  return (
    <div>
      <h1>{assignment.title}</h1>
      <div className="notice-box">本作业已截止，只能查看，不能提交。</div>
      <div className="card">
        <h2>题目</h2>
        <QuestionsView assignment={assignment} />
      </div>
      {submission ? (
        <div className="card">
          <h2>我的作答</h2>
          <AnswersView assignment={assignment} answers={submission.answers} />
        </div>
      ) : (
        <EmptyState label="未提交" hint="本作业截止前未提交答卷。" />
      )}
    </div>
  )
}

function QuestionsView({ assignment }: { assignment: Assignment }) {
  return (
    <ol>
      {assignment.questions.map((q, i) => (
        <li key={q.id} style={{ marginBottom: 12 }}>
          <div>
            {i + 1}. {q.prompt}
          </div>
          <div className="muted">字数上限：{q.maxLength} 字</div>
        </li>
      ))}
    </ol>
  )
}

function AnswersView({ assignment, answers }: { assignment: Assignment; answers: Answer[] }) {
  return (
    <div>
      {assignment.questions.map((q, i) => {
        const ans = answers.find((a) => a.questionId === q.id)
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
      })}
    </div>
  )
}

function EditableForm({
  assignment,
  initial,
  onSubmitted,
}: {
  assignment: Assignment
  initial: Submission | null
  onSubmitted: (submissionId: string) => void
}) {
  const key = bufferKey(getCurrentUser()!.id, assignment.id)
  const cached = useRef(readBuffer(key)).current
  const mapAnswers = (list: Answer[]) => Object.fromEntries(assignment.questions.map(q => [q.id, list.find(a => a.questionId === q.id)?.text ?? '']))
  const [answers, setAnswers] = useState<Record<string, string>>(() => mapAnswers(cached?.dirty || cached?.pending ? cached.answers : initial?.answers ?? []))
  const [version, setVersion] = useState(initial?.version ?? 0)
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(
    initial ? new Date(initial.updatedAt) : null,
  )
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [saveError, setSaveError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [pendingSubmit, setPendingSubmit] = useState(!!cached?.pending)
  const [conflict, setConflict] = useState(!!cached?.dirty && !cached.pending && cached.version !== (initial?.version ?? 0))
  const [lookup, setLookup] = useState(false)

  const answersRef = useRef(answers)
  answersRef.current = answers
  const versionRef = useRef(version)
  versionRef.current = version
  const dirtyRef = useRef(cached?.dirty ?? false)
  const debounceRef = useRef<number | null>(null)
  const pendingSubmitRef = useRef<DraftBuffer['pending']>(cached?.pending ?? null)
  const savingRef = useRef<Promise<void> | null>(null)
  const revisionRef = useRef(0)
  const submittingRef = useRef(false)
  const conflictRef = useRef(conflict)
  const mountedRef = useRef(true)

  function remember() {
    writeBuffer(key, { answers: buildAnswers(), version: versionRef.current, dirty: dirtyRef.current, pending: pendingSubmitRef.current })
  }

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      if (debounceRef.current) window.clearTimeout(debounceRef.current)
    }
  }, [])

  function buildAnswers(): Answer[] {
    return assignment.questions.map((q) => ({ questionId: q.id, text: answersRef.current[q.id] ?? '' }))
  }

  async function saveNow(): Promise<void> {
    if (savingRef.current) await savingRef.current
    if (!mountedRef.current || pendingSubmitRef.current || submittingRef.current || !dirtyRef.current) return
    if (conflictRef.current) throw new ApiError('VERSION_CONFLICT', '请先处理草稿版本冲突', 409)
    const savedRevision = revisionRef.current
    const snapshot = buildAnswers()
    const run = async () => {
      setSaveStatus('saving')
      setSaveError(null)
      try {
        const sub = await api.saveDraft(assignment.id, {
          answers: snapshot,
          expectedVersion: versionRef.current,
        })
        versionRef.current = sub.version
        setVersion(sub.version)
        setLastSavedAt(new Date(sub.updatedAt))
        dirtyRef.current = revisionRef.current !== savedRevision
        remember()
        setSaveStatus(dirtyRef.current ? 'idle' : 'saved')
      } catch (err) {
        if (err instanceof ApiError && err.code === 'VERSION_CONFLICT') { conflictRef.current = true; setConflict(true) }
        setSaveStatus('error')
        setSaveError(err instanceof ApiError ? err.message : '保存失败')
        throw err
      }
    }
    const p = run()
    savingRef.current = p
    try { await p } finally { if (savingRef.current === p) savingRef.current = null }
  }

  function handleChange(qid: string, text: string) {
    if (pendingSubmitRef.current || submittingRef.current) return
    answersRef.current = { ...answersRef.current, [qid]: text }
    setAnswers(answersRef.current)
    revisionRef.current++
    dirtyRef.current = true
    remember()
    setSaveStatus('idle')
    if (debounceRef.current) window.clearTimeout(debounceRef.current)
    debounceRef.current = window.setTimeout(() => {
      void saveNow().catch(() => {})
    }, 1500)
  }

  async function handleSave() {
    if (debounceRef.current) {
      window.clearTimeout(debounceRef.current)
      debounceRef.current = null
    }
    try { await saveNow() } catch { /* shown above; keep local answers */ }
  }

  async function handleSubmit() {
    if (submittingRef.current) return
    setSubmitError(null)

    const ans = buildAnswers()
    if (ans.some((a) => !a.text.trim())) {
      setSubmitError('请先完成所有题目的作答')
      return
    }
    if (debounceRef.current) {
      window.clearTimeout(debounceRef.current)
      debounceRef.current = null
    }
    submittingRef.current = true
    setSubmitting(true)
    try {
      // Drain an in-flight save, then submit complete answers without another draft write.
      if (!pendingSubmitRef.current) {
        if (savingRef.current) await savingRef.current
        if (conflictRef.current) throw new ApiError('VERSION_CONFLICT', '请先处理草稿版本冲突', 409)
        pendingSubmitRef.current = { key: createIdempotencyKey(), input: { answers: buildAnswers(), expectedVersion: versionRef.current } }
        setPendingSubmit(true)
        remember()
      }
      const pending = pendingSubmitRef.current
      const sub = await api.submit(
        assignment.id,
        pending.input,
        pending.key,
      )
      removeBuffer(key)
      onSubmitted(sub.id)
    } catch (err) {
      if (err instanceof ApiError && err.code === 'ALREADY_SUBMITTED') {
        try {
          const detail = await api.getMySubmission(assignment.id)
          if (detail.submission?.state === 'submitted') { removeBuffer(key); onSubmitted(detail.submission.id); return }
        } catch { /* preserve the original error and local answers */ }
      }
      if (err instanceof ApiError && [400, 403, 404, 409].includes(err.status)) {
        pendingSubmitRef.current = null; setPendingSubmit(false); remember()
      }
      if (err instanceof ApiError && err.code === 'VERSION_CONFLICT') {
        conflictRef.current = true; setConflict(true)
        setSubmitError(`提交冲突：服务器草稿已更新（最新版本 ${err.latestVersion ?? '未知'}）。本页输入已保留，请处理版本冲突。`)
      } else {
        setSubmitError(err instanceof ApiError ? err.message : '提交失败，请重试')
      }
    } finally {
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  async function checkServer(replaceDraft: boolean) {
    if (lookup) return
    setLookup(true)
    try {
      if (savingRef.current) await savingRef.current.catch(() => {})
      const { submission } = await api.getMySubmission(assignment.id)
      if (submission?.state === 'submitted') { removeBuffer(key); onSubmitted(submission.id); return }
      if (!replaceDraft) { setSubmitError('服务器暂无已提交答卷；本页答案和原提交请求已保留，可重试。'); return }
      answersRef.current = mapAnswers(submission?.answers ?? [])
      setAnswers(answersRef.current)
      versionRef.current = submission?.version ?? 0; setVersion(versionRef.current)
      dirtyRef.current = false; pendingSubmitRef.current = null; conflictRef.current = false
      setConflict(false); setPendingSubmit(false); setSaveError(null); setSubmitError(null); setSaveStatus('idle'); remember()
    } catch (err) { setSubmitError(err instanceof Error ? err.message : '查询失败') }
    finally { setLookup(false) }
  }

  const saveHint =
    saveStatus === 'saving'
      ? '保存中…'
      : saveStatus === 'saved'
        ? `草稿已保存 ${lastSavedAt ? formatDateTime(lastSavedAt.toISOString()) : ''}`
        : saveStatus === 'error'
          ? '保存失败'
          : lastSavedAt
            ? `上次保存 ${formatDateTime(lastSavedAt.toISOString())}`
            : '尚未保存'

  return (
    <div>
      <h1>{assignment.title}</h1>
      <div className="muted">截止时间：{deadlineText(assignment.deadlineAt)}</div>
      {assignment.instructions && <div className="notice-box">{assignment.instructions}</div>}

      <div className="card">
        <h2>作答</h2>
        {assignment.questions.map((q, i) => (
          <div className="field" key={q.id}>
            <label htmlFor={`q-${q.id}`}>
              {i + 1}. {q.prompt}
            </label>
            <textarea
              id={`q-${q.id}`}
              value={answers[q.id] ?? ''}
              maxLength={q.maxLength}
              disabled={submitting || pendingSubmit || lookup}
              onChange={(e) => handleChange(q.id, e.target.value)}
            />
            <div className="hint">
              已输入 {answers[q.id]?.length ?? 0} / {q.maxLength} 字
            </div>
          </div>
        ))}
      </div>

      <div className="row-between" style={{ marginBottom: 12 }}>
        <div>
          <span className="muted">{saveHint}</span>
          {saveError && <div className="error-box" style={{ marginTop: 6 }}>{saveError}</div>}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" onClick={handleSave} disabled={saveStatus === 'saving' || submitting || pendingSubmit || conflict || lookup}>
            保存草稿
          </button>
          <button
            type="button"
            className="primary"
            onClick={handleSubmit}
            disabled={submitting || conflict || lookup}
          >
            {submitting ? '提交中…' : pendingSubmit ? '重试原提交' : '提交'}
          </button>
        </div>
      </div>
      {submitError && <div className="error-box">{submitError}</div>}
      {(pendingSubmit || conflict) && <div className="notice-box">
        {pendingSubmit ? '提交结果尚未确认，输入已锁定；重试会使用原请求。' : '本页输入已保留，不会覆盖服务器草稿。可先复制答案，再加载服务器版本。'}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
          <button type="button" disabled={lookup || submitting} onClick={() => void checkServer(false)}>查询已提交状态</button>
          {conflict && <button type="button" disabled={lookup} onClick={() => void checkServer(true)}>加载服务器草稿（替换本页内容）</button>}
        </div>
      </div>}
      <div className="muted">提交后初版只读，不可撤回或重复作答；同一幂等键会复用同一次提交。</div>
    </div>
  )
}
