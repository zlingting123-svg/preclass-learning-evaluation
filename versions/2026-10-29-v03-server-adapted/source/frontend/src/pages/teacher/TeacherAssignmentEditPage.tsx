import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { Assignment, AssignmentInput, AssignmentState, ClassInfo, RubricInfo } from '@shared/contracts'
import { api } from '../../services/api'
import { ApiError } from '../../services/apiError'
import { useAsync } from '../../lib/useAsync'
import { fromLocalDateTimeInput, toLocalDateTimeInput } from '../../lib/format'
import { AssignmentStateBadge, ErrorState, LoadingState, NoticeBox, SuccessBox } from '../../components/ui'
import { loadPages } from '../../lib/loadPages'

let questionSeq = 0
function newQuestionId(): string {
  questionSeq += 1
  return `q_new_${Date.now().toString(36)}_${questionSeq}`
}

interface QuestionDraft {
  id: string
  prompt: string
  maxLength: number
}

export function TeacherAssignmentEditPage() {
  const { id, classId } = useParams<{ id?: string; classId?: string }>()
  const isEdit = Boolean(id)
  const navigate = useNavigate()

  const classes = useAsync(() => loadPages(q => api.listClasses(q)), [])
  const rubrics = useAsync(() => loadPages(q => api.listRubrics(q)), [])
  const assignmentLoad = useAsync(
    () => (isEdit ? api.getAssignment(id as string) : Promise.resolve(null as Assignment | null)),
    [id, isEdit],
  )

  const [title, setTitle] = useState('')
  const [selectedClassId, setSelectedClassId] = useState(classId ?? '')
  const [instructions, setInstructions] = useState('')
  const [questions, setQuestions] = useState<QuestionDraft[]>([
    { id: newQuestionId(), prompt: '', maxLength: 500 },
  ])
  const [deadline, setDeadline] = useState('')
  const [noDeadline, setNoDeadline] = useState(true)
  const [rubricId, setRubricId] = useState('')
  const [version, setVersion] = useState(0)
  const [state, setState] = useState<AssignmentState>('draft')

  const [formError, setFormError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [busyAction, setBusyAction] = useState<string | null>(null)

  // 编辑模式：加载后填充表单（仅首次）。
  const initializedRef = useMemo(() => ({ done: false }), [id])
  useEffect(() => {
    if (isEdit && assignmentLoad.data && !initializedRef.done) {
      const a = assignmentLoad.data as Assignment
      initializedRef.done = true
      setTitle(a.title)
      setSelectedClassId(a.classId)
      setInstructions(a.instructions)
      setQuestions(a.questions.map((q) => ({ ...q })))
      setDeadline(toLocalDateTimeInput(a.deadlineAt))
      setNoDeadline(a.deadlineAt === null)
      setRubricId(a.rubricId ?? '')
      setVersion(a.version)
      setState(a.state)
    }
  }, [isEdit, assignmentLoad.data, initializedRef])

  if (classes.loading || rubrics.loading || assignmentLoad.loading) {
    return <LoadingState label="加载中…" />
  }
  if (classes.error || rubrics.error || assignmentLoad.error) {
    return <ErrorState error={classes.error ?? rubrics.error ?? assignmentLoad.error} />
  }

  const classItems = classes.data?.items ?? []
  const rubricItems = rubrics.data?.items ?? []
  const canEdit = !isEdit || state === 'draft'

  function buildInput(): AssignmentInput | null {
    if (!title.trim()) {
      setFormError('请填写作业标题')
      return null
    }
    if (!selectedClassId) {
      setFormError('请选择班级')
      return null
    }
    const cleaned = questions.filter((q) => q.prompt.trim())
    if (!noDeadline && !deadline) { setFormError('请选择截止时间，或勾选无截止时间'); return null }
    if (cleaned.length === 0) {
      setFormError('请至少填写一道题目')
      return null
    }
    return {
      classId: selectedClassId,
      title: title.trim(),
      instructions,
      questions: cleaned.map((q) => ({ id: q.id, prompt: q.prompt.trim(), maxLength: q.maxLength })),
      deadlineAt: noDeadline ? null : fromLocalDateTimeInput(deadline),
      rubricId: rubricId || null,
      expectedVersion: version,
    }
  }

  async function handleSave() {
    setFormError(null)
    setNotice(null)
    const input = buildInput()
    if (!input) return
    setSaving(true)
    try {
      if (isEdit) {
        const a = await api.updateAssignment(id as string, input)
        setVersion(a.version)
        setNotice('草稿已保存')
      } else {
        const a = await api.createAssignment(input)
        navigate(`/teacher/assignments/${a.id}/edit`, { replace: true })
      }
    } catch (err) {
      if (err instanceof ApiError && err.code === 'VERSION_CONFLICT') {
        setFormError(`保存冲突：内容已被其他操作更新（最新版本 ${err.latestVersion ?? '未知'}），请刷新后重试。`)
      } else {
        setFormError(err instanceof ApiError ? err.message : '保存失败')
      }
    } finally {
      setSaving(false)
    }
  }

  async function runAction(action: 'publish' | 'close') {
    setActionError(null)
    setNotice(null)
    setBusyAction(action)
    try {
      const a =
        action === 'publish'
          ? await api.publishAssignment(id as string, { expectedVersion: version })
          : await api.closeAssignment(id as string, { expectedVersion: version })
      setVersion(a.version)
      setState(a.state)
      setNotice(action === 'publish' ? '已发布' : '已关闭提交')
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : '操作失败')
    } finally {
      setBusyAction(null)
    }
  }

  async function handleBindRubric() {
    if (!rubricId) return
    setActionError(null)
    setNotice(null)
    setBusyAction('bind')
    try {
      const a = await api.bindRubric(id as string, { rubricId, expectedVersion: version })
      setVersion(a.version)
      setRubricId(a.rubricId ?? '')
      setNotice('已绑定评价规则')
      assignmentLoad.reload()
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : '绑定失败')
    } finally {
      setBusyAction(null)
    }
  }

  function updateQuestion(qid: string, patch: Partial<QuestionDraft>) {
    setQuestions((prev) => prev.map((q) => (q.id === qid ? { ...q, ...patch } : q)))
  }

  function addQuestion() {
    setQuestions((prev) => [...prev, { id: newQuestionId(), prompt: '', maxLength: 500 }])
  }

  function removeQuestion(qid: string) {
    setQuestions((prev) => (prev.length > 1 ? prev.filter((q) => q.id !== qid) : prev))
  }

  return (
    <div>
      <div className="row-between">
        <h1>{isEdit ? '编辑作业' : '新建作业'}</h1>
        {isEdit && <AssignmentStateBadge state={state} />}
      </div>

      {!canEdit && (
        <NoticeBox>该作业已{state === 'published' ? '发布' : '关闭'}，正文不可再编辑；可执行下方相应操作。</NoticeBox>
      )}
      {notice && <SuccessBox>{notice}</SuccessBox>}
      {formError && <div className="error-box">{formError}</div>}
      {actionError && <div className="error-box">{actionError}</div>}

      <div className="card">
        <div className="field">
          <label htmlFor="title">作业标题</label>
          <input
            id="title"
            type="text"
            value={title}
            disabled={!canEdit}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="classId">班级</label>
          <select
            id="classId"
            value={selectedClassId}
            disabled={!canEdit}
            onChange={(e) => setSelectedClassId(e.target.value)}
          >
            <option value="">请选择班级</option>
            {classItems.map((c: ClassInfo) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="instructions">作业说明</label>
          <textarea
            id="instructions"
            value={instructions}
            disabled={!canEdit}
            onChange={(e) => setInstructions(e.target.value)}
          />
        </div>

        <div className="field">
          <label>题目</label>
          {questions.map((q, i) => (
            <div key={q.id} style={{ border: '1px solid var(--color-border)', borderRadius: 8, padding: 10, marginBottom: 10 }}>
              <div className="field">
                <label htmlFor={`q-${q.id}`}>题目 {i + 1} 内容</label>
                <textarea
                  id={`q-${q.id}`}
                  value={q.prompt}
                  disabled={!canEdit}
                  onChange={(e) => updateQuestion(q.id, { prompt: e.target.value })}
                />
              </div>
              <div className="field">
                <label htmlFor={`qmax-${q.id}`}>字数上限</label>
                <input
                  id={`qmax-${q.id}`}
                  type="number"
                  min={1}
                  value={q.maxLength}
                  disabled={!canEdit}
                  onChange={(e) => updateQuestion(q.id, { maxLength: Number(e.target.value) || 500 })}
                />
              </div>
              {canEdit && questions.length > 1 && (
                <button type="button" className="small danger" onClick={() => removeQuestion(q.id)}>
                  删除此题
                </button>
              )}
            </div>
          ))}
          {canEdit && (
            <button type="button" className="small" onClick={addQuestion}>
              + 添加题目
            </button>
          )}
        </div>

        <div className="field">
          <label>截止时间</label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 400 }}>
            <input
              type="checkbox"
              checked={noDeadline}
              disabled={!canEdit}
              onChange={(e) => setNoDeadline(e.target.checked)}
            />
            无截止时间
          </label>
          {!noDeadline && (
            <input
              type="datetime-local"
              value={deadline}
              disabled={!canEdit}
              onChange={(e) => setDeadline(e.target.value)}
            />
          )}
        </div>

        <div className="field">
          <label htmlFor="rubric">评价规则</label>
          <select
            id="rubric"
            value={rubricId}
            disabled={!canEdit && !!assignmentLoad.data?.rubricId}
            onChange={(e) => setRubricId(e.target.value)}
          >
            <option value="">待配置（先收集答案）</option>
            {rubricItems.map((r: RubricInfo) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
          <div className="hint">评价规则由后台配置；选择“待配置”时提交的答卷为“待配置评价体系”。</div>
        </div>

        {canEdit && (
          <button type="button" className="primary" onClick={handleSave} disabled={saving}>
            {saving ? '保存中…' : isEdit ? '保存草稿' : '创建草稿'}
          </button>
        )}
      </div>

      {isEdit && (
        <div className="card">
          <h2>发布与规则绑定</h2>
          {state === 'draft' && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="primary"
                onClick={() => runAction('publish')}
                disabled={busyAction !== null}
              >
                {busyAction === 'publish' ? '发布中…' : '发布作业'}
              </button>
            </div>
          )}
          {state === 'published' && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => runAction('close')}
                disabled={busyAction !== null}
              >
                {busyAction === 'close' ? '关闭中…' : '关闭提交'}
              </button>
              {rubricId && (
                <button
                  type="button"
                  onClick={handleBindRubric}
                  disabled={busyAction !== null}
                >
                  {busyAction === 'bind' ? '绑定中…' : '绑定评价规则'}
                </button>
              )}
            </div>
          )}
          {state === 'closed' && !assignmentLoad.data?.rubricId && rubricId && <button type="button" onClick={handleBindRubric} disabled={busyAction !== null}>绑定评价规则</button>}
          {state === 'closed' && <div className="muted">作业已关闭，不能再提交答案。</div>}
        </div>
      )}
    </div>
  )
}
