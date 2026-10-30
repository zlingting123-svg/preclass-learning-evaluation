import { DatabaseSync, backup } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

/** Local development adapter. Transaction callbacks must be synchronous. */
export interface Store {
  get<T>(kind: string, id: string): T | undefined;
  all<T>(kind: string): T[];
  put<T>(kind: string, id: string, value: T): void;
  remove(kind: string, id: string): void;
  transaction<T>(fn: () => T): T;
}

export class SqliteStore implements Store {
  readonly db: DatabaseSync;
  constructor(path: string) {
    if (path !== ':memory:') mkdirSync(dirname(resolve(path)), { recursive: true });
    this.db = new DatabaseSync(path);
    const schemaVersion = Number(this.db.prepare('PRAGMA user_version').get()?.user_version);
    if (schemaVersion > 1) { this.db.close(); throw new Error('数据库版本较新，需要对应版本后台'); }
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS records (
        kind TEXT NOT NULL, id TEXT NOT NULL, payload TEXT NOT NULL,
        PRIMARY KEY (kind,id)
      ); PRAGMA user_version=1;`);
  }
  get<T>(kind: string, id: string): T | undefined {
    const row = this.db.prepare('SELECT payload FROM records WHERE kind=? AND id=?').get(kind, id);
    return row ? JSON.parse(row.payload as string) as T : undefined;
  }
  all<T>(kind: string): T[] {
    return this.db.prepare('SELECT payload FROM records WHERE kind=? ORDER BY id').all(kind)
      .map(row => JSON.parse(row.payload as string) as T);
  }
  put<T>(kind: string, id: string, value: T): void {
    this.db.prepare('INSERT INTO records(kind,id,payload) VALUES(?,?,?) ON CONFLICT(kind,id) DO UPDATE SET payload=excluded.payload')
      .run(kind, id, JSON.stringify(value));
  }
  remove(kind: string, id: string): void { this.db.prepare('DELETE FROM records WHERE kind=? AND id=?').run(kind, id); }
  transaction<T>(fn: () => T): T {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const value = fn();
      if (value && typeof (value as { then?: unknown }).then === 'function') throw new Error('Async transaction is forbidden');
      this.db.exec('COMMIT'); return value;
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  async backupTo(path: string): Promise<void> {
    mkdirSync(dirname(resolve(path)), { recursive: true });
    await backup(this.db, path);
  }
  close(): void { this.db.close(); }
}
