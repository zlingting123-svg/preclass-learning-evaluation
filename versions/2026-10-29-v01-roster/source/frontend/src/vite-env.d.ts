/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 数据访问模式：mock（演示）或 http（真实接口）。 */
  readonly VITE_API_MODE?: 'mock' | 'http'
  /** http 模式接口基础地址；留空表示同源 /api/v1。 */
  readonly VITE_API_BASE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
