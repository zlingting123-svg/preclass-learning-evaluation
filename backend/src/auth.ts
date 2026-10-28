import { randomBytes, createHash, randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import type { AuthSession, Role, User } from '../../shared/contracts.js';
import type { Store } from './store.js';
import { ensure } from './errors.js';

export interface Account { user: User; username: string; passwordHash: string }
interface Session { userId: string; expiresAt: string }
const digest = (token: string) => createHash('sha256').update(token).digest('hex');
export interface AuthProvider {
  login(input: unknown): Promise<AuthSession>;
  authenticate(token: string): User;
  logout(token: string): void;
}
export class LocalAuth implements AuthProvider {
  // Used for absent usernames to avoid the obvious short authentication path.
  private dummyHash = bcrypt.hashSync(randomBytes(24).toString('hex'), 12);
  constructor(private store: Store, private now: () => number = Date.now) {}
  async createUser(username: string, password: string, displayName: string, role: Role): Promise<User> {
    const account = await this.prepareUser(username, password, displayName, role);
    return this.store.transaction(() => this.persistPrepared(account));
  }
  /** Hash outside the SQLite transaction, including controlled roster imports. */
  async prepareUser(username: string, password: string, displayName: string, role: Role): Promise<Account> {
    z.object({ username: z.string().regex(/^[a-zA-Z0-9_.@-]{3,100}$/), password: z.string().min(12).refine(v => Buffer.byteLength(v) <= 72),
      displayName: z.string().trim().min(1).max(100), role: z.enum(['teacher', 'student', 'admin']) }).parse({ username, password, displayName, role });
    const passwordHash = await bcrypt.hash(password, 12);
    return { username, passwordHash, user: { id: randomUUID(), displayName, role } };
  }
  /** Caller must wrap this and related enrollment writes in store.transaction. */
  async prepareImportedStudent(username: string, displayName: string): Promise<Account> {
    z.object({ username:z.string().regex(/^[a-zA-Z0-9_.@-]{3,100}$/),displayName:z.string().trim().min(1).max(100) }).parse({username,displayName});
    return {username,passwordHash:await bcrypt.hash('12345',12),user:{id:randomUUID(),displayName,role:'student'}};
  }
  persistPrepared(account: Account): User {
    ensure(!this.store.get('account', account.username) && !this.store.get('user', account.user.id), 409, 'USERNAME_EXISTS', '账号已存在');
    this.store.put('account', account.username, account); this.store.put('user', account.user.id, account.user);
    return account.user;
  }
  async login(input: unknown): Promise<AuthSession> {
    const { username, password } = z.object({ username: z.string().min(1).max(100), password: z.string().min(1).max(200) }).strict().parse(input);
    const account = this.store.get<Account>('account', username);
    const valid = await bcrypt.compare(password, account?.passwordHash ?? this.dummyHash);
    ensure(valid && account && Buffer.byteLength(password) <= 72, 401, 'UNAUTHENTICATED', '账号或口令错误');
    const accessToken = randomBytes(32).toString('base64url');
    const expiresAt = new Date(this.now() + 8 * 60 * 60 * 1000).toISOString();
    this.store.put<Session>('session', digest(accessToken), { userId: account.user.id, expiresAt });
    return { user: account.user, accessToken, expiresAt };
  }
  authenticate(token: string): User {
    const session = this.store.get<Session>('session', digest(token));
    ensure(session, 401, 'UNAUTHENTICATED', '请登录');
    if (Date.parse(session.expiresAt) <= this.now()) {
      this.logout(token); ensure(false, 401, 'SESSION_EXPIRED', '登录已过期');
    }
    const user = this.store.get<User>('user', session.userId);
    ensure(user, 401, 'UNAUTHENTICATED', '账号不可用');
    return user;
  }
  logout(token: string): void { this.store.remove('session', digest(token)); }
}
