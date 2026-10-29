import { useParams } from 'react-router-dom'
import type { ScoreReport, ScoringStatus } from '@shared/contracts'
import { api } from '../../services/api'
import { useAsync } from '../../lib/useAsync'
import { ReportDetail } from '../../components/ReportDetail'
import { EmptyState, ErrorState, LoadingState, NoticeBox } from '../../components/ui'

export function StudentReportPage() {
  const { submissionId } = useParams<{ submissionId: string }>()
  const load = useAsync(() => api.getReport(submissionId as string), [submissionId])

  if (load.loading) return <LoadingState label="加载报告…" />
  if (load.error) return <ErrorState error={load.error} onRetry={load.reload} />

  const { scoringStatus, report } = load.data as {
    submissionId: string
    scoringStatus: ScoringStatus
    report: ScoreReport | null
  }

  return (
    <div>
      <h1>我的报告</h1>
      <button type="button" onClick={load.reload}>刷新报告</button>
      <StatusBody scoringStatus={scoringStatus} report={report} />
    </div>
  )
}

function StatusBody({ scoringStatus, report }: { scoringStatus: ScoringStatus; report: ScoreReport | null }) {
  switch (scoringStatus) {
    case 'not_requested':
      return <EmptyState label="尚未提交" hint="提交答卷后才会进入评分流程。" />
    case 'awaiting_rubric':
      return (
        <NoticeBox>
          评价体系待配置。已提交答卷，但该作业尚未配置评分规则，评分状态为“待配置评价体系”；配置规则并评分后此处会显示结果。
        </NoticeBox>
      )
    case 'queued':
      return <NoticeBox>评分任务已排队，请稍后回来查看结果。</NoticeBox>
    case 'processing':
      return <NoticeBox>评分处理中，请稍后回来查看结果。</NoticeBox>
    case 'failed':
      return (
        <div className="error-box">
          评分失败：评分任务在多次重试后仍失败。请联系教师重试评分。
        </div>
      )
    case 'scored':
    case 'needs_review':
      if (!report) {
        return <EmptyState label="暂无评分报告" hint="评分结果尚未生成，请稍后刷新。" />
      }
      return (
        <div>
          {scoringStatus === 'needs_review' && (
            <NoticeBox>系统初评完成，等待教师复核；下方为系统初评结果。</NoticeBox>
          )}
          <ReportDetail report={report} />
        </div>
      )
    default:
      return <EmptyState label="未知状态" />
  }
}
