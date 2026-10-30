import type { AuthSession, User } from '@shared/contracts'

/**
 * 首版访问令牌只保存在前端运行内存：刷新页面后需要重新登录。
 * 更改持久化方式（如 localStorage/cookie）必须与后台同步，不得自行引入。
 */
let session: AuthSession | null = null
let onUnauthorized: (() => void) | null = null

export function setSession(next: AuthSession | null): void {
  session = next
}

export function getSession(): AuthSession | null {
  return session
}

export function getAccessToken(): string | null {
  return session?.accessToken ?? null
}

export function getCurrentUser(): User | null {
  return session?.user ?? null
}

export function clearSession(): void {
  session = null
}

export function setUnauthorizedHandler(handler: (() => void) | null): void {
  onUnauthorized = handler
}

/** 401 会话失效统一处理：清空会话并通知应用跳转登录，mock 与 http 共用。 */
export function notifyUnauthorized(): void {
  session = null
  onUnauthorized?.()
}
