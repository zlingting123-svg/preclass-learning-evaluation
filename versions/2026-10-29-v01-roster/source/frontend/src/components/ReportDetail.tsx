import type { ScoreReport } from '@shared/contracts'
import { formatDateTime } from '../lib/format'
import { ScoreSection } from './ScoreSection'

/** 展示报告：优先展示已保存的教师复核并标注，同时保留系统初评。 */
export function ReportDetail({ report }: { report: ScoreReport }) {
  return (
    <div>
      <div className="muted" style={{ marginBottom: 8 }}>
        评价规则版本 {report.rubricVersion} · 初评方式 {report.method} · 生成时间{' '}
        {formatDateTime(report.generatedAt)}
        {report.modelProvider && ` · 模型 ${report.modelProvider}`}
      </div>

      {report.latestReview && (
        <div className="card" style={{ borderColor: 'var(--color-success)' }}>
          <h3>教师复核（已复核）</h3>
          <div className="muted">复核时间：{formatDateTime(report.latestReview.reviewedAt)}</div>
          <ScoreSection scores={report.latestReview.scores} title="复核得分" />
          <div style={{ marginTop: 8 }}>
            <strong>复核理由：</strong>
            {report.latestReview.reason || '—'}
          </div>
        </div>
      )}

      {report.systemScores && (
        <ScoreSection scores={report.systemScores} title={report.latestReview ? '系统初评（供对照）' : '系统初评'} />
      )}

      {!report.systemScores && !report.latestReview && (
        <div className="notice-box">暂无评分结果。</div>
      )}

      {report.reviews.length > 1 && (
        <div className="card">
          <h3>复核历史</h3>
          <ul className="list">
            {report.reviews.slice(0, -1).map((r) => (
              <li key={r.id}>
                <div className="row-between">
                  <span>{formatDateTime(r.reviewedAt)}</span>
                </div>
                <div className="muted">{r.reason || '（无理由）'}</div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
