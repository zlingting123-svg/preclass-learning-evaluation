import { API_MODE } from '../config'
import { ApiError } from '../services/apiError'
import { ScoreSection } from '../components/ScoreSection'
import { EmptyState, ErrorState, LoadingState, NoticeBox } from '../components/ui'

/** 仅 mock 模式可用：集中展示各状态，便于检查与验收。 */
export function DemoStatesPage() {
  if (API_MODE !== 'mock') {
    return <NoticeBox>状态演示页仅在 mock 模式可用。</NoticeBox>
  }

  const sampleScores = {
    dimensions: [
      { dimensionId: 'd_a', name: '内容完整性（演示维度A）', score: 18, maxScore: 20, rationale: '覆盖要点（演示）' },
      { dimensionId: 'd_b', name: '表达清晰度（演示维度B）', score: 16, maxScore: 20, rationale: '表达清楚（演示）' },
      { dimensionId: 'd_c', name: '思考深度（演示维度C）', score: 15, maxScore: 20, rationale: '有独立思考（演示）' },
    ],
    totalScore: 49,
    totalMaxScore: 60,
    feedback: '（演示评语）',
  }

  return (
    <div>
      <h1>状态演示</h1>
      <NoticeBox>
        本页在 mock 模式下集中展示各界面状态；演示账号为 student / teacher / expired（密码 demo123）。
      </NoticeBox>

      <div className="card">
        <h3>加载中</h3>
        <LoadingState />
      </div>

      <div className="card">
        <h3>空列表</h3>
        <EmptyState label="暂无数据" hint="没有可展示的内容。" />
      </div>

      <div className="card">
        <h3>网络错误</h3>
        <ErrorState error={new ApiError('NETWORK_ERROR', '无法连接服务器，请检查网络或稍后重试', 0)} />
      </div>

      <div className="card">
        <h3>无权限（403）</h3>
        <ErrorState error={new ApiError('FORBIDDEN', '没有权限执行此操作', 403)} />
      </div>

      <div className="card">
        <h3>待配置评价体系</h3>
        <NoticeBox>已提交答卷，但该作业尚未配置评分规则，评分状态为“待配置评价体系”。</NoticeBox>
      </div>

      <div className="card">
        <h3>评分排队中</h3>
        <NoticeBox>评分任务已排队，请稍后回来查看结果。</NoticeBox>
      </div>

      <div className="card">
        <h3>评分失败</h3>
        <div className="error-box">评分失败：评分任务在多次重试后仍失败。请联系教师重试评分。</div>
      </div>

      <div className="card">
        <h3>已评分（图表示例）</h3>
        <ScoreSection scores={sampleScores} title="系统初评（示例）" />
      </div>

      <div className="card">
        <h3>如何触发真实交互场景</h3>
        <ul>
          <li>会话过期：用 <code>expired</code> 登录，会立即提示“会话已过期，请重新登录”。</li>
          <li>各评分状态：用学生账号分别提交“已配置评价 / 待配置 / 排队中 / 失败 / 待复核”等演示作业。</li>
          <li>版本冲突：在两个浏览器标签页同时编辑同一份草稿后保存，后保存的一方会收到 409 冲突提示。</li>
          <li>教师复核：教师打开“需要教师复核”的答卷，填写人工分数与理由后保存。</li>
        </ul>
      </div>
    </div>
  )
}
