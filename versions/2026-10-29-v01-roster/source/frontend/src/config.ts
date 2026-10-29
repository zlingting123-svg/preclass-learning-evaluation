export type ApiMode = 'mock' | 'http'

/**
 * 前端只读取公开配置。任何云密钥、模型密钥、数据库凭证都必须留在后台，
 * 不得出现在此文件、打包产物或页面上。
 */
const configuredMode = import.meta.env.VITE_API_MODE ?? 'http'
if (configuredMode !== 'http' && configuredMode !== 'mock') throw new Error('数据访问模式配置无效')
if (import.meta.env.PROD && configuredMode !== 'http') throw new Error('生产环境禁止演示数据')
export const API_MODE: ApiMode = configuredMode

export const API_BASE_URL: string = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/+$/, '')
