import { localCourseAi } from './ai.js';
import { SqliteStore } from './store.js';
import { LocalAuth } from './auth.js';
import { Service } from './service.js';
import { createApp } from './app.js';
import { config } from './config.js';

const settings = config();
const store = new SqliteStore(settings.dbPath);
const service = new Service(store), auth = new LocalAuth(store), ai = localCourseAi(service, auth, settings.dbPath);
const server = createApp(service, auth, ai).listen(settings.port, settings.host, () => {
  process.stdout.write(JSON.stringify({ event: 'local_server_started', host: settings.host, port: settings.port, productionReady: false }) + '\n');
});
server.requestTimeout = 30000;
server.headersTimeout = 10000;
server.on('error', () => { process.stderr.write('后台启动失败，请检查端口与本地数据库权限\n'); ai?.close(); store.close(); process.exitCode = 1; });
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => server.close(() => { ai?.close(); store.close(); process.exit(0); }));
