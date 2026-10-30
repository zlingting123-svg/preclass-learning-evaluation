import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

const frontendRoot = fileURLToPath(new URL('.', import.meta.url))
const sharedRoot = fileURLToPath(new URL('../shared', import.meta.url))
const frontendPath = frontendRoot.replaceAll('\\', '/').replace(/\/$/, '')

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const apiMode = env.VITE_API_MODE ?? 'http'
  if (!['http', 'mock'].includes(apiMode)) throw new Error('VITE_API_MODE 必须为 http 或 mock')
  if (command === 'build' && apiMode !== 'http') throw new Error('生产构建禁止 mock；请设置 VITE_API_MODE=http')
  return {
  plugins: [react()],
  resolve: {
    alias: {
      '@shared': fileURLToPath(new URL('../shared', import.meta.url)),
    },
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    // Only share source contracts; never expose the backend database or private files.
    fs: {
      allow: [frontendRoot, sharedRoot],
      deny: ['**/.env', '**/.env.*', '**/*.{crt,pem,key}', '**/.git/**', `${frontendPath}/**/work/**`, `${frontendPath}/**/private-data/**`, `${frontendPath}/**/credentials/**`],
    },
    // Local HTTP adapter; mock mode never calls this proxy.
    proxy: {
      '/api': {
        target: env.VITE_DEV_PROXY_TARGET || 'http://127.0.0.1:3001',
        changeOrigin: true,
      },
    },
  },
  build: {
    // 拆分 ECharts 与 React 依赖，减小主包体积并利于缓存。
    rollupOptions: {
      input: {main:fileURLToPath(new URL("./index.html",import.meta.url)),design:fileURLToPath(new URL("./design-preview.html",import.meta.url))},
      output: {
        manualChunks: {
          echarts: ['echarts'],
          react: ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
  }
})
