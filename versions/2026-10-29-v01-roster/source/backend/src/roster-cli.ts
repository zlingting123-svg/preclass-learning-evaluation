import { readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';
import type { User } from '../../shared/contracts.js';
import { SqliteStore } from './store.js';
import { config } from './config.js';
import { LocalAuth } from './auth.js';
import { createCohort, requireLocalAdmin } from './cohorts.js';
import { Service } from './service.js';
import { RosterImporter } from './roster.js';
import { AppError, ensure } from './errors.js';

const store = new SqliteStore(config().dbPath);
const privateRoot = resolve('private-data');
const importer = new RosterImporter(store, new LocalAuth(store), privateRoot);
const envId = (name: string) => z.string().min(1).max(128).parse(process.env[name]);
async function jsonInput(): Promise<unknown> {
  ensure(!process.stdin.isTTY, 400, 'INPUT_REQUIRED', '配置JSON从stdin读入，不在命令参数中传名单或口令');
  const chunks: Buffer[] = []; let bytes = 0;
  for await (const chunk of process.stdin) {
    const part = Buffer.from(chunk); bytes += part.length;
    ensure(bytes <= 2 * 1024 * 1024, 400, 'INPUT_TOO_LARGE', '配置过长'); chunks.push(part);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8').replace(/^\uFEFF/, ''));
}
try {
  const actor = store.get<User>('user', envId('ACTOR_ID'));
  ensure(actor, 403, 'FORBIDDEN', '管理员账号不存在'); requireLocalAdmin(store, actor);
  let result: unknown;
  switch (process.argv[2]) {
    case 'cohort': result = createCohort(store, actor, await jsonInput()); break;
    case 'class': {
      const input = z.object({ teacherId: z.string().min(1), cohortId: z.string().min(1), name: z.string().trim().min(1).max(200) }).strict().parse(await jsonInput());
      const teacher = store.get<User>('user', input.teacherId); ensure(teacher?.role === 'teacher', 400, 'INVALID_TEACHER', '教师账号不存在');
      result = new Service(store).createClass(teacher, input.name, input.cohortId); break;
    }
    case 'preview': {
      const file = resolve(z.string().min(1).parse(process.env.ROSTER_FILE));
      ensure(statSync(file).size <= 2 * 1024 * 1024, 400, 'INPUT_TOO_LARGE', 'CSV超过2MB');
      const plan = importer.preview(actor, envId('CLASS_ID'), readFileSync(file, 'utf8'));
      const reportFile = resolve(process.env.PLAN_REPORT_PATH ?? resolve(privateRoot, `roster-preview-${plan.id}.json`));
      importer.writePreview(plan, reportFile);
      result = { planId: plan.id, hash: plan.hash, counts: plan.counts, expiresAt: new Date(plan.expiresAt).toISOString(), reportFile, executed: false }; break;
    }
    case 'commit': {
      const planId = envId('IMPORT_PLAN_ID'); const hash = z.string().regex(/^[a-f0-9]{64}$/).parse(process.env.IMPORT_PLAN_HASH);
      const file = resolve(process.env.CREDENTIALS_PATH ?? resolve(privateRoot, `credentials-${planId}.json`));
      result = await importer.commit(actor, planId, hash, file); break;
    }
    default: throw new AppError(400, 'UNKNOWN_OPERATION', '未知操作');
  }
  process.stdout.write(JSON.stringify({ success: true, data: result }) + '\n');
} catch (error) {
  process.stderr.write(JSON.stringify({ success: false, error: error instanceof AppError ? { code: error.code, message: error.message } :
    { code: 'MANAGEMENT_FAILED', message: '操作失败；检查配置、CSV和私密输出路径，已有文件不会覆盖。输入和口令不写日志。' } }) + '\n');
  process.exitCode = 1;
} finally { store.close(); }
