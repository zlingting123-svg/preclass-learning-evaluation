import { resolve } from 'node:path';
import { z } from 'zod';
import { SqliteStore } from './store.js';
import { LocalAuth } from './auth.js';
import { config } from './config.js';

const settings = config();
const store = new SqliteStore(settings.dbPath);
try {
  if (process.argv[2] === 'user') {
    const data = z.object({ USERNAME: z.string().regex(/^[a-zA-Z0-9_.@-]{3,100}$/), DISPLAY_NAME: z.string().trim().min(1).max(100),
      ROLE: z.enum(['teacher', 'student', 'admin']) }).parse(process.env);
    if (process.stdin.isTTY) throw new Error('请通过标准输入安全传入口令，不要将口令写入命令参数');
    const chunks: Buffer[] = []; let bytes = 0;
    for await (const chunk of process.stdin) {
      const buffer = Buffer.from(chunk); bytes += buffer.length;
      if (bytes > 1024) throw new Error('输入过长'); chunks.push(buffer);
    }
    const password = Buffer.concat(chunks).toString('utf8').replace(/\r?\n$/, '');
    const user = await new LocalAuth(store).createUser(data.USERNAME, password, data.DISPLAY_NAME, data.ROLE);
    process.stdout.write(JSON.stringify({ success: true, userId: user.id, role: user.role }) + '\n');
  } else if (process.argv[2] === 'backup') {
    const destination = resolve(z.string().min(1).parse(process.env.BACKUP_PATH));
    if (destination === settings.dbPath) throw new Error('备份目标不能是当前数据库');
    await store.backupTo(destination); process.stdout.write('本地备份已生成；恢复仍需在独立数据库验证\n');
  } else throw new Error('未知管理命令');
} catch {
  process.stderr.write('管理操作失败；检查参数、口令长度（12字符以上且不超过72字节）、账号是否重复及文件权限。\n');
  process.exitCode = 1;
} finally { store.close(); }
