import type { ApiResponse } from '@shared/contracts'
import { API_BASE_URL } from '../config'
import { ApiError } from './apiError'
import { getAccessToken, notifyUnauthorized } from './authStore'

export interface RequestOptions {
  body?: unknown
  idempotencyKey?: string
  signal?: AbortSignal
}

/**
 * 统一 HTTP 客户端：注入 Bearer 令牌、解析成功/失败信封、
 * 按状态码抛出 ApiError。成功时返回 data；失败绝不回退到模拟成功。
 */
export async function apiRequest<T>(
  method: string,
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (options.body !== undefined) headers['Content-Type'] = 'application/json'
  const token = getAccessToken()
  if (token) headers.Authorization = `Bearer ${token}`
  if (options.idempotencyKey) headers['Idempotency-Key'] = options.idempotencyKey

  const url = `${API_BASE_URL}/api/v1${path}`

  let res: Response
  try {
    res = await fetch(url, {
      method,
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: options.signal,
    })
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') throw err
    throw new ApiError('NETWORK_ERROR', '无法连接服务器，请检查网络或稍后重试', 0)
  }

  return parseApiResponse<T>(res, !!token)
}

/** Shared by JSON requests and CSV failures, including malformed 401 responses. */
export async function parseApiResponse<T>(res: Response, hadToken: boolean): Promise<T> {
  if (res.status === 401 && hadToken) notifyUnauthorized()
  let payload: ApiResponse<unknown>
  try {
    payload = (await res.json()) as ApiResponse<unknown>
  } catch {
    throw new ApiError(
      'INVALID_RESPONSE',
      `服务器返回了无法解析的响应（HTTP ${res.status}）`,
      res.status,
    )
  }

  if (!payload || typeof payload !== 'object' || typeof payload.ok !== 'boolean') {
    throw new ApiError('INVALID_RESPONSE', '服务器响应结构无效', res.status)
  }
  if (res.ok && payload.ok) return payload.data as T
  if (payload.ok || !payload.error || typeof payload.error.code !== 'string' || typeof payload.error.message !== 'string') {
    throw new ApiError('INVALID_RESPONSE', '服务器响应结构或HTTP状态无效', res.status)
  }

  const error = payload.error
  // 仅在“已有令牌”的请求上把 401 视为会话失效；登录本身的 401 只是凭据错误。
  throw new ApiError(error.code, error.message, res.status, error.details, payload.requestId)
}
