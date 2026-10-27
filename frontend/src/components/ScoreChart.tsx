import { useEffect, useRef } from 'react'
import * as echarts from 'echarts/core'
import { BarChart, RadarChart } from 'echarts/charts'
import { GridComponent, RadarComponent, TooltipComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import type { DimensionScore } from '@shared/contracts'
import { normalizeScore } from '../lib/format'

echarts.use([BarChart, RadarChart, GridComponent, RadarComponent, TooltipComponent, CanvasRenderer])

/**
 * 评分维度图表：维度不足 3 个用条形图，3 个及以上用雷达图。
 * 归一化到 0–100 展示，保留原始分数与满分由调用方在表格中呈现。
 * 无评分、无维度或 maxScore 无效时显示空态，不产生 NaN 或伪造图形。
 */
export function ScoreChart({ dimensions }: { dimensions: DimensionScore[] }) {
  const ref = useRef<HTMLDivElement>(null)

  const valid =
    dimensions.length > 0 &&
    dimensions.every((d) => normalizeScore(d.score, d.maxScore) !== null)

  const names = dimensions.map((d) => d.name)
  const values = dimensions.map((d) => normalizeScore(d.score, d.maxScore) ?? 0)
  const useRadar = dimensions.length >= 3

  useEffect(() => {
    if (!ref.current || !valid) return
    const chart = echarts.init(ref.current)

    const baseOption = useRadar
      ? {
          tooltip: { trigger: 'item' as const },
          radar: {
            indicator: names.map((name) => ({ name, max: 100 })),
            radius: '62%',
            splitArea: { areaStyle: { color: ['#fafbfc', '#f0f3f7'] } },
          },
          series: [
            {
              type: 'radar' as const,
              data: [{ value: values, name: '归一化得分' }],
              areaStyle: { opacity: 0.25 },
              symbol: 'circle' as const,
              symbolSize: 6,
            },
          ],
        }
      : {
          tooltip: { trigger: 'axis' as const, axisPointer: { type: 'shadow' as const } },
          grid: { left: 8, right: 40, top: 16, bottom: 8, containLabel: true },
          xAxis: { type: 'value' as const, max: 100, name: '0–100' },
          yAxis: {
            type: 'category' as const,
            data: names,
            axisLabel: { width: 140, overflow: 'truncate' as const },
          },
          series: [
            {
              type: 'bar' as const,
              data: values,
              barMaxWidth: 36,
              label: { show: true, position: 'right' as const },
              itemStyle: { color: '#2563eb' },
            },
          ],
        }

    chart.setOption(baseOption)
    const onResize = () => chart.resize()
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      chart.dispose()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [names.join('|'), values.join('|'), valid])

  if (!valid) {
    return (
      <div className="center-state">
        <div className="icon" aria-hidden="true">
          ▦
        </div>
        <div>暂无可用评分维度</div>
        <div className="muted">无评分、无维度或满分无效时无法生成图表。</div>
      </div>
    )
  }

  return (
    <div>
      <div ref={ref} className="chart-box" role="img" aria-label="评分维度图表" />
      <div className="chart-note">归一化到 0–100 展示；下方表格保留原始分数与满分。维度顺序以评价规则为准。</div>
    </div>
  )
}
