import { searchOfficial, type WebPolicy } from './web-knowledge.js';
import { importedEvidence } from './knowledge-import.js';
import { randomUUID, randomBytes } from 'node:crypto';
import { readFileSync, mkdirSync, existsSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { once } from 'node:events';
import type { Express, Response } from 'express';
import { z } from 'zod';
import { Gateway, Ledger, KeywordKnowledge, MockProvider, ModuleError, readConfig, configSchema, type Principal, type Emit, type Policy } from 'course-ai-module';
import type { AuthProvider } from './auth.js';
import { Service } from './service.js';
import type { User } from '../../shared/contracts.js';
import type { CourseMaterial } from '../../shared/learning.js';
import { AppError, ensure } from './errors.js';
import type { ApiSettings } from '../../shared/admin.js';
import type { ManagedApi } from './admin-settings.js';

/** Host sessions and class membership remain authoritative. No demo token or identity bridge. */
export function createCourseAi(core: Service, auth: AuthProvider, options: {
  ledgerPath: string; fingerprintKey: string; configPath: string; policy?: Partial<Policy>; delayMs?: number;
}) {
  let config = readConfig(options.configPath);
  const persisted=core.store.get<ApiSettings>("ai_admin_settings","current");
  if(persisted) config=managedConfig(config,persisted);
  ensure(config.mode === 'mock', 503, 'AI_LIVE_DISABLED', '真实模型接入尚未启用');
  const store = new Ledger(options.ledgerPath), sessions = new WeakMap<Principal, string>();
  const policy = { ...config.policy, ...options.policy };
  const gateway = new Gateway({
    identity: { async verify(token) {
      const user = auth.authenticate(token);
      const principal: Principal = { subjectId: user.id, role: user.role };
      sessions.set(principal, token); return principal;
    } },
    authorization: { async authorize(principal, classId, action) {
      const token = sessions.get(principal);
      ensure(token, 401, 'UNAUTHENTICATED', '请重新登录');
      const user = auth.authenticate(token);
      ensure(user.id === principal.subjectId && user.role === principal.role, 403, 'FORBIDDEN', '账号权限已变更');
      core.role(user, action === 'ask' ? 'student' : 'teacher');
      core.classAccess(user, classId);
      return { scopeIds: [classId] };
    } },
    knowledge: { async retrieve(input) {
      // Only already-published teacher material from this class. Text stays in request memory.
      const imported = importedEvidence(core.store, input.courseId, input.question);
      if (imported.length && imported[0].score >= 0.5) return {status: 'supported' as const, evidence: imported, scoreType: 'lexical_overlap'};
      const rule = config.courses.environment;
      const materials = core.store.all<CourseMaterial>('course_material').filter(m => m.classId === input.courseId && m.state === 'published');
      const sources = materials.flatMap(m => {
        const chunks = m.content.match(/[\s\S]{1,700}/g) ?? [];
        return chunks.map((content, index) => ({ id: `${m.id}_${index}`, scopeId: m.classId,
          topicId: 'course_material', title: m.title, content, version: String(m.version), approved: true,
          keywords: rule.keywords.filter(k => (m.title + content).includes(k)) }));
      });
      const followup=/^(那|那么)?(它|这个|这一步|上述内容|刚才的内容|前面的内容)(有什么(作用|意义|区别)|的(作用|意义|目的|步骤|流程)(是什么|有哪些|呢)?|为什么重要|怎么理解)[？?。！!]*$/.test(input.question.trim());
      const anchor=followup?[...(input.history??[])].reverse().find(m=>m.role==='user'&&rule.keywords.some(k=>m.text.includes(k)))?.text:undefined;
      const local = await new KeywordKnowledge(sources, { [input.courseId]: rule }).retrieve({...input,question:anchor?anchor+'\n'+input.question:input.question});
      if (local.status === 'supported') return local;
      const p=core.store.get<WebPolicy>('ai_web_policy',input.courseId);
      if (p?.enabled && process.env.BRAVE_SEARCH_API_KEY) {
        try {const found=await searchOfficial(input.question,input.courseId,p.domains,process.env.BRAVE_SEARCH_API_KEY,input.signal);if(found.length)return {status:'supported' as const,evidence:found,scoreType:'web_search_snippet'};}
        catch(e){input.signal.throwIfAborted(); throw e;}
      }
      if(imported.length)return {status:'supported' as const,evidence:imported,scoreType:'lexical_overlap'};
      if(local.status==='out_of_scope'&&/环境影响评价|环境管理|这门课程|课前学习/.test(input.question))return {...local,status:'insufficient' as const};
      return local;
    } },
  }, store, policy, config.deployments.map(d => ({ ...d, provider: new MockProvider('ok', options.delayMs ?? 800) })), options.fingerprintKey);
  return { gateway, store, mode: 'mock' as const, close: () => store.close(),
    management() {
      const version=core.store.get<ApiSettings>('ai_admin_settings','current')?.version??0;
      const p=gateway.policy;
      return {version,enabled:p.enabled,dailyRequests:p.dailyRequests,dailyUserBudgetMicros:p.dailyUserBudgetMicros,monthlyBudgetMicros:p.monthlyBudgetMicros,maxOutputTokens:p.maxOutputTokens,maxQueue:p.maxQueue,queueTimeoutMs:p.queueTimeoutMs,requestTimeoutMs:p.requestTimeoutMs,topicsMinCount:p.topicsMinCount,warningMicros:config.balance.warningMicros,stopMicros:config.balance.stopMicros,deployments:config.deployments.map(d=>({...d}))};
    },
    configure(value:ManagedApi,persist:()=>void) {
      // Apply only while quiescent: no active/queued request loses its pool or reservation.
      ensure(!store.rows().some(r=>r.state==='reserved'||r.state==='calling'),409,'AI_BUSY','尚有AI请求，请等待完成后保存配置');
      const next=managedConfig(config,value);
      const deployments=next.deployments.map(d=>({...d,provider:new MockProvider('ok',options.delayMs??800)}));
      persist();
      Object.assign(gateway.policy,next.policy);
      gateway.deployments.splice(0,gateway.deployments.length,...deployments);
      config=next;
    },
  };
}
function managedConfig(base:ReturnType<typeof readConfig>,value:ManagedApi) {
  return configSchema.parse({...base,policy:{...base.policy,enabled:value.enabled,dailyRequests:value.dailyRequests,dailyUserBudgetMicros:value.dailyUserBudgetMicros,monthlyBudgetMicros:value.monthlyBudgetMicros,maxOutputTokens:value.maxOutputTokens,maxQueue:value.maxQueue,queueTimeoutMs:value.queueTimeoutMs,requestTimeoutMs:value.requestTimeoutMs,topicsMinCount:value.topicsMinCount},balance:{...base.balance,warningMicros:value.warningMicros,stopMicros:value.stopMicros},deployments:value.deployments});
}
export type CourseAi = ReturnType<typeof createCourseAi>;

/** Explicit opt-in for the local sample; never silently start paid or unconfigured providers. */
export function localCourseAi(core: Service, auth: AuthProvider, dbPath: string): CourseAi | undefined {
  if (!process.env.AI_MODE || process.env.AI_MODE === 'disabled') return undefined;
  ensure(process.env.AI_MODE === 'mock', 503, 'AI_LIVE_DISABLED', '当前主系统集成只允许mock模型');
  const dir = resolve(dirname(dbPath), 'ai'); mkdirSync(dir, { recursive: true, mode: 0o700 });
  const key = resolve(dir, 'fingerprint.secret');
  if (!existsSync(key)) writeFileSync(key, randomBytes(32).toString('hex'), { mode: 0o600, flag: 'wx' });
  return createCourseAi(core, auth, { ledgerPath: resolve(dir, 'metadata.sqlite'), fingerprintKey: readFileSync(key, 'utf8'),
    configPath: resolve(process.env.AI_CONFIG ?? '../ai-module/config/mock.example.json') });
}
const identifier = z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/);
const chatBody = z.object({ classId: identifier, question: z.string().trim().min(1).max(5000), clientRequestId: identifier }).strict();
const compatibilityBody = z.object({ classId: identifier, messages: z.array(z.object({ role: z.enum(['user', 'assistant']), text: z.string().trim().min(1).max(5000) }).strict()).min(1).max(40), clientRequestId: identifier.default(() => randomUUID()) }).strict();
function translate(error: unknown): never {
  if (error instanceof ModuleError) throw new AppError(error.status, error.code, 'AI请求未完成，请根据状态检查课程权限、额度或稍后重试');
  throw error;
}
export function aiRoutes(app: Express, core: Service, ai?: CourseAi) {
  const ok = (res: Response, data: unknown) => res.json({ ok: true, data, requestId: res.locals.requestId });
  const runtime = () => { ensure(ai, 503, 'AI_NOT_CONNECTED', 'AI服务尚未启用'); return ai; };
  const user = (res: Response): User => res.locals.user;
  app.get('/api/v1/core/ai/status', (_req, res) => ok(res, { mode: ai?.mode ?? 'disabled', liveReady: false, historyStored: true, retrieval: 'keyword_baseline' }));
  app.get('/api/v1/core/ai/usage', async (_req, res) => ok(res, await runtime().store.summary(user(res).id)));
  app.get('/api/v1/core/ai/topics/:classId', async (req, res) => {
    core.role(user(res), 'teacher'); const classId = identifier.parse(req.params.classId); core.classAccess(user(res), classId);
    const a = runtime(); ok(res, { buckets: await a.store.topics(classId, a.gateway.policy.topicsMinCount), privacyThreshold: a.gateway.policy.topicsMinCount });
  });
  app.get('/api/v1/core/ai/admin', async (_req, res) => {
    core.role(user(res), 'admin'); const a = runtime();
    ok(res, { summary: await a.store.summary(), ...(await a.gateway.scheduler.status()), balances: [{ state: 'not_configured', mode: 'mock' }] });
  });
  const prepare = async (res: Response, body: z.infer<typeof chatBody>) => {
    const a = runtime();
    const principal = await a.gateway.deps.identity.verify(res.locals.token);
    const input = { courseId: body.classId, question: body.question, clientRequestId: body.clientRequestId };
    const requestId = await a.gateway.prepare(principal, input); return { a, principal, input, requestId };
  };
  app.post('/api/v1/core/ai/chat/stream', async (req, res) => {
    let prepared;
    try { prepared = await prepare(res, chatBody.parse(req.body)); } catch (e) { translate(e); }
    const { a, principal, input, requestId } = prepared!;
    const controller = new AbortController(), abort = () => controller.abort(); res.on('close', abort);
    const timer = setTimeout(abort, a.gateway.policy.requestTimeoutMs);
    res.status(200).set({ 'Content-Type': 'text/event-stream; charset=utf-8', 'X-Accel-Buffering': 'no', 'X-Request-Id': requestId }); res.flushHeaders();
    const emit: Emit = async (event, data) => {
      controller.signal.throwIfAborted();
      if (!res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)) await once(res, 'drain', { signal: controller.signal });
    };
    try { await a.gateway.answer(principal, input, requestId, controller.signal, emit); }
    finally { clearTimeout(timer); res.off('close', abort); res.end(); }
  });
  // Retain the documented JSON endpoint for existing clients; no context/history is persisted or sent.
  app.post('/api/v1/core/ai/chat', async (req, res) => {
    core.classAccess(user(res), identifier.parse(req.body?.classId)); runtime();
    const body = compatibilityBody.parse(req.body), last = body.messages.at(-1)!;
    ensure(last.role === 'user', 400, 'INVALID_INPUT', '最后一条消息必须是学生问题');
    let prepared;
    try { prepared = await prepare(res, { classId: body.classId, question: last.text, clientRequestId: body.clientRequestId }); } catch (e) { translate(e); }
    const { a, principal, input, requestId } = prepared!;
    const controller = new AbortController(), abort = () => controller.abort(); res.on('close', abort);
    const timer = setTimeout(abort, a.gateway.policy.requestTimeoutMs);
    let reply = '', terminal = '', failure = '', sources: unknown[] = [];
    try {
      await a.gateway.answer(principal, input, requestId, controller.signal, async (event, raw) => {
        const d = raw as { text?: string; message?: string; sources?: unknown[]; code?: string };
        if (event === 'delta') reply += d.text ?? '';
        if (event === 'sources') sources = d.sources ?? [];
        if (event === 'refusal' || event === 'insufficient_evidence') { reply = d.message ?? ''; terminal = event; }
        if (event === 'done') terminal = 'done';
        if (event === 'error') failure = d.code ?? 'REQUEST_FAILED';
      });
      ensure(!failure && terminal, 502, failure || 'UPSTREAM_INCOMPLETE', 'AI请求未完成，费用状态请查看用量');
      ok(res, { reply, sources, outcome: terminal, mode: 'mock' });
    } finally { clearTimeout(timer); res.off('close', abort); }
  });
}
