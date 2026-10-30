import { setTimeout } from 'node:timers/promises';
import { SqliteStore } from './store.js';
import { Service } from './service.js';
import { Worker } from './worker.js';
import { config } from './config.js';

const store = new SqliteStore(config().dbPath);
const worker = new Worker(new Service(store));
process.stdout.write('本地评分任务处理器：尚无正式评分适配器，配置规则后任务会有限重试并显式失败。\n');
let running = true;
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => { running = false; });
try { while (running) { await worker.tick(); if (running) await setTimeout(500); } }
finally { store.close(); }
