import { API_BASE_URL, API_MODE } from '../config';
import { apiRequest, parseApiResponse } from './httpClient';
import { getAccessToken } from './authStore';
import { ApiError } from './apiError';
export interface AiUsage { requests: number; modelCalls: number; completed: number; inputTokens: number; outputTokens: number; usageUnknown: number; }
export interface AiStatus { mode: 'mock' | 'disabled'; liveReady: boolean; historyStored: boolean; retrieval: string; }
export interface AiEvent { event: string; data: { text?: string; message?: string; code?: string; sources?: Array<{ id: string; title: string; version: string }>; }; }
export const aiStatus = () => apiRequest<AiStatus>('GET', '/core/ai/status');
export const aiUsage = () => apiRequest<AiUsage>('GET', '/core/ai/usage');
const errors: Record<string, string> = {
  STUDENT_REQUIRED: '课程提问仅向学生开放；教师可查看班级主题统计。',
  USER_BUSY: '你已有一个问题正在处理，请稍后再试。',
  DAILY_REQUEST_LIMIT: '今日提问次数已用完。',
  DAILY_QUOTA_EXCEEDED: '今日提问额度已用完。',
  QUEUE_FULL: '当前提问较多，请稍后再试。',
  QUEUE_TIMEOUT: '排队超时，请稍后重新提问。',
  REQUEST_ALREADY_HANDLED: '此请求已处理，不会重复生成或收费。请检查用量后再决定是否新提问。',
};
/** POST + SSE. Credentials stay in memory; persistent transcripts use private server endpoints. */
export async function askCourse(classId: string, question: string, clientRequestId: string, signal: AbortSignal, emit: (e: AiEvent) => void) {
  return streamQuestion('/core/ai/chat/stream',{classId,question,clientRequestId},signal,emit);
}
export async function askThread(threadId:string, question:string,clientRequestId:string,signal:AbortSignal,emit:(e:AiEvent)=>void){
 return streamQuestion('/core/ai/threads/'+encodeURIComponent(threadId)+'/questions',{question,clientRequestId},signal,emit);
}
async function streamQuestion(path:string,body:unknown,signal:AbortSignal,emit:(e:AiEvent)=>void){
  if (API_MODE !== 'http') throw new Error('AI问答需要连接HTTP后台，演示数据模式不可用。');
  const token = getAccessToken();
  const response = await fetch(`${API_BASE_URL}/api/v1${path}`, { method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body), signal });
  if (!response.ok) {
    try { await parseApiResponse(response, !!token); } catch (error) {
      if (error instanceof ApiError) throw new Error(errors[error.code] ?? error.message); throw error;
    }
    throw new Error('AI服务响应异常');
  }
  if (!response.headers.get('content-type')?.includes('text/event-stream') || !response.body) throw new Error('AI服务未返回有效数据流');
  const reader = response.body.getReader(), decoder = new TextDecoder();
  let buffer = '', terminal = false;
  try {
    for (;;) {
      const chunk = await reader.read();
      signal.throwIfAborted();
      buffer += decoder.decode(chunk.value, { stream: !chunk.done });
      if (buffer.length > 100000) throw new Error('AI数据流超过预期限制');
      let boundary: number;
      while ((boundary = buffer.indexOf('\n\n')) >= 0) {
        const frame = buffer.slice(0, boundary); buffer = buffer.slice(boundary + 2);
        const event = frame.split('\n').find(l => l.startsWith('event:'))?.slice(6).trim();
        const data = frame.split('\n').filter(l => l.startsWith('data:')).map(l => l.slice(5).trimStart()).join('\n');
        if (!event || !data) continue;
        const parsed = JSON.parse(data) as AiEvent['data'];
        if (event === 'error') throw new Error((errors[parsed.code ?? ''] ?? 'AI请求未完成') + '；已用量可能需要对账，请勿连续重试。');
        if (['done', 'refusal', 'insufficient_evidence'].includes(event)) terminal = true;
        emit({ event, data: parsed });
      }
      if (chunk.done) break;
    }
    if (!terminal) throw new Error('连接中断，回答未完成。请先查看用量，再决定是否重新提问。');
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}
