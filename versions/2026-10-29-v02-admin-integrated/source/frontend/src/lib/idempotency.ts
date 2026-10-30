/**
 * 为“同一次提交”生成一次幂等键，失败重试时复用同一个键，
 * 避免重复点击或网络重试创建多份答卷。
 * 键只保存在本次提交流程的内存中；刷新页面后重新生成。
 */
export function createIdempotencyKey(prefix = 'submit'): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}-${crypto.randomUUID()}`
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`
}
