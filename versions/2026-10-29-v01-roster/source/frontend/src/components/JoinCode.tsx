import { useState } from 'react'

export function JoinCode({ code }: { code?: string }) {
  const [notice, setNotice] = useState('')
  if (!code) return <div className="muted">加入码暂不可用，请重新查询班级。</div>
  return <div style={{ marginTop: 8 }}>
    <span>班级加入码：<code data-testid="join-code">{code}</code></span>{' '}
    <button className="small" type="button" onClick={async () => {
      try { await navigator.clipboard.writeText(code); setNotice('已复制加入码') }
      catch { setNotice('复制失败，请选中加入码手动复制') }
    }}>复制加入码</button>
    <span role="status" className="muted">{notice}</span>
  </div>
}
