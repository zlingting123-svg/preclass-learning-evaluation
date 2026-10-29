import { Link } from 'react-router-dom'
import { API_MODE } from '../config'

/** mock 模式全程显示“演示数据 / 尚未连接后台”，演示账号不能冒充正式账号。 */
export function DemoBanner() {
  if (API_MODE !== 'mock') return null
  return (
    <div className="demo-banner" role="status">
      <strong>演示数据 / 尚未连接后台</strong>
      <span>当前为演示账号与模拟接口，不代表正式系统。</span>
      <Link to="/demo/states">查看状态演示</Link>
    </div>
  )
}
