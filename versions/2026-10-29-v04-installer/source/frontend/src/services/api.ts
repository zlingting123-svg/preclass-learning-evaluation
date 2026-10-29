import { API_MODE } from '../config'
import type { FrontendApi } from './apiTypes'
import { httpApi } from './httpApi'

export * from './apiError'
export * from './apiTypes'
export type { FrontendApi } from './apiTypes'
export { getCurrentUser, setSession, clearSession, setUnauthorizedHandler, notifyUnauthorized } from './authStore'

/**
 * 统一数据访问入口。组件只 import { api }，不直接依赖 mock/http 实现。
 * http 模式失败时抛出 ApiError，绝不静默回退到模拟成功。
 */
export const api: FrontendApi = import.meta.env.DEV && API_MODE === 'mock'
  ? (await import('../mocks/mockApi')).mockApi
  : httpApi
