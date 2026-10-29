import type { DimensionScore, ScoreValue } from '@shared/contracts'
import { normalizeScore } from '../lib/format'
import { ScoreChart } from './ScoreChart'

export function ScoreSection({ scores, title }: { scores: ScoreValue; title: string }) {
  return (
    <div className="card">
      <h3>{title}</h3>
      <ScoreChart dimensions={scores.dimensions} />
      <DimensionTable
        dimensions={scores.dimensions}
        totalScore={scores.totalScore}
        totalMaxScore={scores.totalMaxScore}
      />
      <div style={{ marginTop: 12 }}>
        <strong>评语：</strong>
        {scores.feedback || '—'}
      </div>
    </div>
  )
}

export function DimensionTable({
  dimensions,
  totalScore,
  totalMaxScore,
}: {
  dimensions: DimensionScore[]
  totalScore: number | null
  totalMaxScore: number | null
}) {
  if (dimensions.length === 0) {
    return <div className="muted">暂无评分维度。</div>
  }
  return (
    <div style={{ marginTop: 8, overflowX: 'auto' }}>
      <table className="score-table">
        <thead>
          <tr>
            <th>维度</th>
            <th>得分</th>
            <th>满分</th>
            <th>归一化</th>
            <th>评分依据</th>
          </tr>
        </thead>
        <tbody>
          {dimensions.map((d) => {
            const norm = normalizeScore(d.score, d.maxScore)
            return (
              <tr key={d.dimensionId}>
                <td>{d.name}</td>
                <td>{d.score}</td>
                <td>{d.maxScore}</td>
                <td>{norm === null ? '—' : `${norm}%`}</td>
                <td>
                  <div className="dim-rationale">{d.rationale || '—'}</div>
                </td>
              </tr>
            )
          })}
          <tr>
            <td>
              <strong>总分</strong>
            </td>
            <td>
              <strong>{totalScore ?? '—'}</strong>
            </td>
            <td>
              <strong>{totalMaxScore ?? '—'}</strong>
            </td>
            <td colSpan={2} className="muted">
              总分/满分由后台按已配置规则返回，前端不自行推断权重。
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}
