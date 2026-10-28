import { useEffect, useState } from 'react';
import { aiStatus, aiUsage, type AiUsage, type AiStatus } from '../../services/courseAi';
import { apiRequest } from '../../services/httpClient';
import { getCurrentUser } from '../../services/api';
export function AiStatusPanel({ classId, revision = 0 }: { classId: string; revision?: number }) {
  const [status, setStatus] = useState<AiStatus | null>(null), [usage, setUsage] = useState<AiUsage | null>(null), [error, setError] = useState('');
  const [topics, setTopics] = useState<{ buckets: Array<{ bucket: string; topic: string; count: number }>; privacyThreshold: number } | null>(null);
  const role = getCurrentUser()?.role;
  useEffect(() => {
    let active = true; setError(''); setTopics(null);
    void (async () => {
      try {
        const s = await aiStatus(); if (!active) return; setStatus(s);
        if (s.mode === 'disabled') return;
        const u = await aiUsage(); if (!active) return; setUsage(u);
        if (role === 'teacher' && classId) {
          const t = await apiRequest<NonNullable<typeof topics>>('GET', `/core/ai/topics/${encodeURIComponent(classId)}`); if (active) setTopics(t);
        }
      } catch (e) { if (active) setError(e instanceof Error ? e.message : '状态读取失败'); }
    })(); return () => { active = false; };
  }, [classId, revision, role]);
  return <aside className="ai-status-panel" aria-label="AI服务与用量">
    <p role="status"><strong>{status?.mode === 'mock' ? '模拟模型已连接 · 不产生费用' : status?.mode === 'disabled' ? 'AI服务未启用' : '正在检查AI服务…'}</strong></p>
    <p>仅回答本班已发布资料支持的课程问题。当前每个问题独立检索；聊天正文只保留在本页内存，刷新或离开后清除。</p>
    {usage && <p>我的累计模型调用 <strong>{usage.modelCalls}</strong> 次 · 输入 {usage.inputTokens} / 输出 {usage.outputTokens} tokens{usage.usageUnknown > 0 ? ` · ${usage.usageUnknown} 次待对账` : ''}</p>}
    {role === 'teacher' && <div><strong>本班提问方向</strong>{topics?.buckets.length ? <ul>{topics.buckets.map(t => <li key={t.bucket+t.topic}>{t.bucket} · 课程资料理解：{t.count} 次</li>)}</ul> : <p>暂无达到展示门槛的主题{topics ? `（至少${topics.privacyThreshold}次）` : ''}；不展示个人问题或对话。</p>}</div>}
    {error && <p role="alert">{error}</p>}
  </aside>;
}
