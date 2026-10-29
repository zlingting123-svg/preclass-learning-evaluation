import type { Express, Response } from 'express';
import { z } from 'zod';
import type { User } from '../../shared/contracts.js';
import type { ApiSettings } from '../../shared/admin.js';
import { AdminService } from './admin.js';
import { Service, page } from './service.js';
import { ensure } from './errors.js';
import { serverSettings, serverSettingsBody, apiSettingsBody } from './admin-settings.js';
import type { CourseAi } from './ai.js';

/** Extends the other creator's admin service; accounts/auth/audit retain their existing contract. */
export function serviceAdminRoutes(app: Express, core: Service, ai?: CourseAi) {
  const admin = new AdminService(core), store = core.store;
  const actor = (res: Response): User => res.locals.user;
  const ok = (res: Response, data: unknown) => res.json({ ok: true, data, requestId: res.locals.requestId });
  const checkVersion = (actual: number, expected: number) => ensure(actual === expected, 409, 'VERSION_CONFLICT', '设置已变更，请重新读取后再保存');
  app.use('/api/v1/admin', (_req, res, next) => { admin.require(actor(res)); next(); });
  app.get('/api/v1/admin/server', (_req, res) => ok(res, serverSettings(store)));
  app.put('/api/v1/admin/server', (req, res) => {
    const b = serverSettingsBody.parse(req.body);
    const result = store.transaction(() => {
      checkVersion(serverSettings(store).version, b.expectedVersion);
      const value = { maintenance: b.maintenance, sessionHours: b.sessionHours, version: b.expectedVersion + 1 };
      store.put('server_settings', 'current', value); admin.audit(actor(res), 'server.configure', 'server_settings'); return value;
    }); ok(res, result);
  });
  app.get('/api/v1/admin/api', async (_req, res) => ok(res, {
    mode: ai?.mode ?? 'disabled', liveReady: ai?.mode==='deepseek', settings: ai?.management() ?? null,
    status: ai ? await ai.gateway.scheduler.status() : null,
    ...ai?.credentialStatus(), balanceState: ai?.mode==='deepseek'?'live':'not_configured', balances: ai ? await ai.balanceStatus():[]
  }));
  app.put('/api/v1/admin/api', (req, res) => {
    ensure(ai, 503, 'AI_NOT_CONNECTED', '请先在服务器启用AI模块');
    const { expectedVersion, credentialUpdates=[], ...value } = apiSettingsBody.parse(req.body);
    ensure(new Set(credentialUpdates.map(v=>v.deploymentId)).size===credentialUpdates.length,400,'DUPLICATE_KEY_UPDATE','同一配置不能重复更新密钥');
    const updates=Object.fromEntries(credentialUpdates.map(v=>[v.deploymentId,v.apiKey])); checkVersion(ai.management().version, expectedVersion);
    ai.configure(value, () => {
      checkVersion(store.get<ApiSettings>('ai_admin_settings', 'current')?.version ?? 0, expectedVersion);
      store.put<ApiSettings>('ai_admin_settings', 'current', { ...value, version: expectedVersion + 1 });
      admin.audit(actor(res), 'api.configure', 'ai_admin_settings');
    }, updates); ok(res, ai.management());
  });
  app.get('/api/v1/admin/usage', async (req, res) => {
    const q = z.object({ userId: z.string().min(1).max(128).optional(), limit: z.coerce.number().int().min(1).max(100).default(20), cursor: z.string().max(256).optional() }).strict().parse(req.query);
    const entries = ai ? (await ai.store.rows()).filter(r => !q.userId || r.subjectId === q.userId).map(r => ({ id: r.id, userId: r.subjectId, createdAt: r.createdAt, state: r.state, purpose: r.purpose, accountId: r.accountId, model: r.model, inputTokens: r.inputTokens, outputTokens: r.outputTokens, costMicros: r.costMicros, currency: r.currency, pricingVersion: r.pricingVersion, errorCode: r.errorCode })) : [];
    ok(res, page(entries, q.limit, q.cursor));
  });
}
