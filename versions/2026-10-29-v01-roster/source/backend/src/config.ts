import { resolve } from 'node:path';
import { ensure } from './errors.js';

export function config() {
  ensure(process.env.NODE_ENV !== 'production', 503, 'PRODUCTION_UNCONFIGURED', '当前仅有本地适配器，禁止以生产模式启动');
  ensure(!process.env.STORAGE_MODE || process.env.STORAGE_MODE === 'local-sqlite', 503, 'STORAGE_UNCONFIGURED', '尚未配置云存储适配器');
  ensure(!process.env.AUTH_MODE || process.env.AUTH_MODE === 'local-bcrypt', 503, 'AUTH_UNCONFIGURED', '尚未配置云认证适配器');
  const host = process.env.HOST ?? '127.0.0.1';
  ensure(['127.0.0.1', 'localhost', '::1'].includes(host), 503, 'LOCAL_ONLY', '当前适配器仅允许本机访问');
  const port = Number(process.env.PORT ?? '3001');
  ensure(Number.isInteger(port) && port >= 1 && port <= 65535, 400, 'VALIDATION_ERROR', '端口配置无效');
  return { host, port, dbPath: resolve(process.env.DB_PATH ?? 'work/local.sqlite') };
}
