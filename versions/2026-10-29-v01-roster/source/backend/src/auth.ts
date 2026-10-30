import { randomBytes, createHash, randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import type { AuthSession, Role, User } from '../../shared/contracts.js';
import type { Store } from './store.js';
import { ensure } from './errors.js';
import { serverSettings } from './admin-settings.js';

export interface Account { user: User; username: string; passwordHash: string; disabled?: boolean; version?: number; mustChangePassword?: boolean }
interface Session { userId: string; expiresAt: string; epoch?: number }
const digest = (token: string) => createHash('sha256').update(token).digest('hex');
export interface AuthProvider {
  login(input: unknown): Promise<AuthSession>;
  authenticate(token: string): User;
  logout(token: string): void;
  changePassword?(token: string, input: unknown): Promise<void>;
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
    return {username,mustChangePassword:true,passwordHash:await bcrypt.hash('12345',12),user:{id:randomUUID(),displayName,role:'student'}};
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
    ensure(valid && account && !account.disabled && Buffer.byteLength(password) <= 72, 401, 'UNAUTHENTICATED', '账号或口令错误');
    const accessToken = randomBytes(32).toString('base64url');
    const expiresAt = new Date(this.now() + serverSettings(this.store).sessionHours * 60 * 60 * 1000).toISOString();
    this.store.put<Session>('session', digest(accessToken), { userId: account.user.id, expiresAt, epoch: this.store.get<{version:number}>('session_epoch',account.user.id)?.version??0 });
    return { user: { ...account.user, ...(account.mustChangePassword ? {mustChangePassword:true} : {}) }, accessToken, expiresAt };
  }
  authenticate(token: string): User {
    const session = this.store.get<Session>('session', digest(token));
    ensure(session, 401, 'UNAUTHENTICATED', '请登录');
    ensure((session.epoch??0)===(this.store.get<{version:number}>('session_epoch',session.userId)?.version??0),401,'SESSION_REVOKED','账号会话已失效，请重新登录');
    ensure(!this.store.all<Account>('account').find(a=>a.user.id===session.userId)?.disabled,401,'UNAUTHENTICATED','账号不可用');
    if (Date.parse(session.expiresAt) <= this.now()) {
      this.logout(token); ensure(false, 401, 'SESSION_EXPIRED', '登录已过期');
    }
    const user = this.store.get<User>('user', session.userId);
    ensure(user, 401, 'UNAUTHENTICATED', '账号不可用');
    const account=this.store.all<Account>('account').find(a=>a.user.id===user.id);
    return {...user,...(account?.mustChangePassword?{mustChangePassword:true}:{})};
  }
  async changePassword(token:string,input:unknown):Promise<void> {
    const body=z.object({currentPassword:z.string().min(1).max(200),newPassword:z.string().min(12).refine(v=>Buffer.byteLength(v)<=72,'新密码最多72字节')}).strict().parse(input);
    const user=this.authenticate(token),account=this.store.all<Account>('account').find(a=>a.user.id===user.id)!;
    ensure(await bcrypt.compare(body.currentPassword,account.passwordHash),400,'PASSWORD_INCORRECT','当前密码不正确');
    ensure(body.newPassword!==body.currentPassword,400,'PASSWORD_UNCHANGED','新密码必须与初始或当前密码不同');
    const hash=await bcrypt.hash(body.newPassword,12);
    this.store.transaction(()=>{
      this.authenticate(token);const latest=this.store.get<Account>('account',account.username)!;
      ensure(latest.passwordHash===account.passwordHash,409,'ACCOUNT_CHANGED','密码已变更，请重新登录');
      this.store.put<Account>('account',account.username,{...latest,passwordHash:hash,mustChangePassword:false,version:(latest.version??0)+1});
      const epoch=this.store.get<{version:number}>('session_epoch',user.id)?.version??0;
      this.store.put('session_epoch',user.id,{version:epoch+1});
      const id=randomUUID();this.store.put('admin_audit',id,{id,actorId:user.id,actorName:user.displayName,action:'change_own_password',targetId:user.id,targetName:user.displayName,at:new Date(this.now()).toISOString()});
    });
  }
  logout(token: string): void { this.store.remove('session', digest(token)); }
}
