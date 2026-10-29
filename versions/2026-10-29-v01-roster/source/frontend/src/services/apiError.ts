export type ErrorDetails = Record<string, unknown>

/**
 * 统一业务/网络错误。code 对应共享契约中的错误码；status 为 HTTP 状态，
 * 网络失败时为 0。details 携带契约约定的补充信息（如最新版本号）。
 */
export class ApiError extends Error {
  readonly code: string
  readonly status: number
  readonly details?: ErrorDetails
  readonly requestId?: string

  constructor(
    code: string,
    message: string,
    status: number,
    details?: ErrorDetails,
    requestId?: string,
  ) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
    this.details = details
    this.requestId = requestId
  }

  /** 从契约 details 中读取 latestVersion（版本冲突时的最新版本号）。 */
  get latestVersion(): number | undefined {
    const v = this.details?.latestVersion
    return typeof v === 'number' ? v : undefined
  }
}
