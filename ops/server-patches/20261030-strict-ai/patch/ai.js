import {retrieveStrict} from './strict-knowledge.js';
import { CredentialVault } from './credential-vault.js';
import { searchOfficial, sharedWebPolicy } from './web-knowledge.js';
import { importedEvidence } from './knowledge-import.js';
import { officialSnapshot, searchMee } from './official-support.js';
import { randomUUID, randomBytes } from 'node:crypto';
import { readFileSync, mkdirSync, existsSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { once } from 'node:events';
import { z } from 'zod';
import { Gateway, Ledger, KeywordKnowledge, MockProvider, DeepSeekProvider, BalanceMonitor, ModuleError, readConfig, configSchema } from 'course-ai-module';
import { AppError, ensure } from './errors.js';
/** Host sessions and class membership remain authoritative. No demo token or identity bridge. */
export function createCourseAi(core, auth, options) {
    const vault = new CredentialVault(core.store);
    const persisted = core.store.get("ai_admin_settings", "current");
    let config = readConfig(options.configPath, d => !!persisted || vault.has(d.id) || !!(d.credentialEnv && process.env[d.credentialEnv]));
    if (persisted)
        config = managedConfig(config, persisted);
    const provider = (d, updates = {}) => {
        if (config.mode === 'mock')
            return new MockProvider('ok', options.delayMs ?? 800);
        const key = updates[d.id] ?? vault.get(d.id) ?? (d.credentialEnv && process.env[d.credentialEnv]);
        ensure(key, 503, 'MISSING_PROVIDER_KEY', '请在管理端为此配置填写API Key');
        return new DeepSeekProvider(key);
    };
    const balances = config.mode === 'deepseek' ? new BalanceMonitor(config.balance) : undefined;
    const store = new Ledger(options.ledgerPath), sessions = new WeakMap();
    const policy = { ...config.policy, ...options.policy };
    const gateway = new Gateway({
        allowTeacherQuestions: true,
        identity: { async verify(token) {
                const user = auth.authenticate(token);
                const principal = { subjectId: user.id, role: user.role };
                sessions.set(principal, token);
                return principal;
            } },
        authorization: { async authorize(principal, classId, action) {
                const token = sessions.get(principal);
                ensure(token, 401, 'UNAUTHENTICATED', '请重新登录');
                const user = auth.authenticate(token);
                ensure(user.id === principal.subjectId && user.role === principal.role, 403, 'FORBIDDEN', '账号权限已变更');
                if (action === 'ask')
                    ensure(user.role === 'student' || user.role === 'teacher', 403, 'FORBIDDEN', '仅师生可使用课程问答');
                else
                    core.role(user, 'teacher');
                core.classAccess(user, classId);
                return { scopeIds: [classId] };
            } },
        knowledge: { async retrieve(input) {
                return retrieveStrict(core, input);
            } },
    }, store, policy, config.deployments.map(d => ({ ...d, provider: provider(d) })), options.fingerprintKey, balances);
    return { gateway, store, mode: config.mode, close: () => store.close(),
        credentialStatus() { return { storageReady: vault.ready, credentials: config.deployments.map(d => ({ id: d.id, configured: vault.has(d.id) || !!(d.credentialEnv && process.env[d.credentialEnv]), source: vault.has(d.id) ? 'managed' : d.credentialEnv && process.env[d.credentialEnv] ? 'environment' : 'missing' })) }; },
        async balanceStatus() {
            if (!balances)
                return [{ state: 'not_configured', mode: 'mock' }];
            return Promise.all(gateway.deployments.filter((d, i, all) => all.findIndex(x => x.accountId === d.accountId) === i).map(async (d) => {
                try {
                    return await balances.inspect(d, AbortSignal.timeout(6000));
                }
                catch {
                    return { accountId: d.accountId, state: 'unknown' };
                }
            }));
        },
        management() {
            const version = core.store.get('ai_admin_settings', 'current')?.version ?? 0;
            const p = gateway.policy;
            return { version, enabled: p.enabled, dailyRequests: p.dailyRequests, dailyUserBudgetMicros: p.dailyUserBudgetMicros, monthlyBudgetMicros: p.monthlyBudgetMicros, maxOutputTokens: p.maxOutputTokens, maxQueue: p.maxQueue, queueTimeoutMs: p.queueTimeoutMs, requestTimeoutMs: p.requestTimeoutMs, topicsMinCount: p.topicsMinCount, warningMicros: config.balance.warningMicros, stopMicros: config.balance.stopMicros, deployments: config.deployments.map(d => ({ ...d })) };
        },
        configure(value, persist, updates = {}) {
            // Apply only while quiescent: no active/queued request loses its pool or reservation.
            ensure(!store.rows().some(r => r.state === 'reserved' || r.state === 'calling'), 409, 'AI_BUSY', '尚有AI请求，请等待完成后保存配置');
            const next = managedConfig(config, value);
            for (const [id, key] of Object.entries(updates)) {
                ensure(next.deployments.some(d => d.id === id), 400, 'KEY_DEPLOYMENT_MISMATCH', '密钥没有对应的账户配置');
                vault.validate(key);
            }
            const deployments = next.deployments.map(d => ({ ...d, provider: provider(d, updates) }));
            core.store.transaction(() => { for (const [id, key] of Object.entries(updates))
                vault.set(id, key); vault.prune(next.deployments.map(d => d.id)); persist(); });
            Object.assign(gateway.policy, next.policy);
            gateway.deployments.splice(0, gateway.deployments.length, ...deployments);
            if (balances) {
                Object.assign(balances.settings, next.balance);
                balances.reset();
            }
            config = next;
        },
    };
}
function managedConfig(base, value) {
    // Output limits are editable; the internal worst-case reservation must follow them.
    const minimumReserve = Math.ceil(((base.policy.maxInputBytes + 1024) * Math.max(base.policy.rates.inputPerMillion, base.policy.rates.cacheHitPerMillion) + value.maxOutputTokens * base.policy.rates.outputPerMillion) / 1e6);
    return configSchema.parse({ ...base, policy: { ...base.policy, reserveMicros: Math.max(base.policy.reserveMicros, minimumReserve), enabled: value.enabled, dailyRequests: value.dailyRequests, dailyUserBudgetMicros: value.dailyUserBudgetMicros, monthlyBudgetMicros: value.monthlyBudgetMicros, maxOutputTokens: value.maxOutputTokens, maxQueue: value.maxQueue, queueTimeoutMs: value.queueTimeoutMs, requestTimeoutMs: value.requestTimeoutMs, topicsMinCount: value.topicsMinCount }, balance: { ...base.balance, warningMicros: value.warningMicros, stopMicros: value.stopMicros }, deployments: value.deployments });
}
/** Explicit opt-in for the local sample; never silently start paid or unconfigured providers. */
export function localCourseAi(core, auth, dbPath) {
    if (!process.env.AI_MODE || process.env.AI_MODE === 'disabled')
        return undefined;
    ensure(['mock', 'deepseek'].includes(process.env.AI_MODE), 503, 'AI_MODE_INVALID', 'AI_MODE无效');
    ensure(process.env.AI_MODE !== 'deepseek' || process.env.AI_CONFIG, 503, 'AI_CONFIG_REQUIRED', '真实模式需要明确配置文件');
    const dir = resolve(dirname(dbPath), 'ai');
    mkdirSync(dir, { recursive: true, mode: 0o700 });
    const key = resolve(dir, 'fingerprint.secret');
    if (!existsSync(key))
        writeFileSync(key, randomBytes(32).toString('hex'), { mode: 0o600, flag: 'wx' });
    const configPath = resolve(process.env.AI_CONFIG ?? '../ai-module/config/mock.example.json');
    ensure(configSchema.parse(JSON.parse(readFileSync(configPath, 'utf8'))).mode === process.env.AI_MODE, 503, 'AI_MODE_MISMATCH', 'AI模式与配置文件不一致');
    return createCourseAi(core, auth, { ledgerPath: resolve(dir, 'metadata.sqlite'), fingerprintKey: readFileSync(key, 'utf8'),
        configPath });
}
const identifier = z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/);
const chatBody = z.object({ classId: identifier, question: z.string().trim().min(1).max(5000), clientRequestId: identifier }).strict();
const compatibilityBody = z.object({ classId: identifier, messages: z.array(z.object({ role: z.enum(['user', 'assistant']), text: z.string().trim().min(1).max(5000) }).strict()).min(1).max(40), clientRequestId: identifier.default(() => randomUUID()) }).strict();
function translate(error) {
    if (error instanceof ModuleError)
        throw new AppError(error.status, error.code, 'AI请求未完成，请根据状态检查课程权限、额度或稍后重试');
    throw error;
}
export function aiRoutes(app, core, ai) {
    const ok = (res, data) => res.json({ ok: true, data, requestId: res.locals.requestId });
    const runtime = () => { ensure(ai, 503, 'AI_NOT_CONNECTED', 'AI服务尚未启用'); return ai; };
    const user = (res) => res.locals.user;
    app.get('/api/v1/core/ai/status', (_req, res) => ok(res, { mode: ai?.mode ?? 'disabled', liveReady: ai?.mode === 'deepseek', retrievalCalibrated: process.env.AI_RETRIEVAL_CALIBRATED === 'true', historyStored: true, retrieval: 'keyword_baseline' }));
    app.get('/api/v1/core/ai/usage', async (_req, res) => ok(res, await runtime().store.summary(user(res).id)));
    app.get('/api/v1/core/ai/topics/:classId', async (req, res) => {
        core.role(user(res), 'teacher');
        const classId = identifier.parse(req.params.classId);
        core.classAccess(user(res), classId);
        const a = runtime();
        ok(res, { buckets: await a.store.topics(classId, a.gateway.policy.topicsMinCount), privacyThreshold: a.gateway.policy.topicsMinCount });
    });
    app.get('/api/v1/core/ai/admin', async (_req, res) => {
        core.role(user(res), 'admin');
        const a = runtime();
        ok(res, { summary: await a.store.summary(), ...(await a.gateway.scheduler.status()), balances: await a.balanceStatus() });
    });
    const prepare = async (res, body) => {
        const a = runtime();
        const principal = await a.gateway.deps.identity.verify(res.locals.token);
        const input = { courseId: body.classId, question: body.question, clientRequestId: body.clientRequestId };
        const requestId = await a.gateway.prepare(principal, input);
        return { a, principal, input, requestId };
    };
    app.post('/api/v1/core/ai/chat/stream', async (req, res) => {
        let prepared;
        try {
            prepared = await prepare(res, chatBody.parse(req.body));
        }
        catch (e) {
            translate(e);
        }
        const { a, principal, input, requestId } = prepared;
        const controller = new AbortController(), abort = () => controller.abort();
        res.on('close', abort);
        const timer = setTimeout(abort, a.gateway.policy.requestTimeoutMs);
        res.status(200).set({ 'Content-Type': 'text/event-stream; charset=utf-8', 'X-Accel-Buffering': 'no', 'X-Request-Id': requestId });
        res.flushHeaders();
        const emit = async (event, data) => {
            controller.signal.throwIfAborted();
            if (!res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
                await once(res, 'drain', { signal: controller.signal });
        };
        try {
            await a.gateway.answer(principal, input, requestId, controller.signal, emit);
        }
        finally {
            clearTimeout(timer);
            res.off('close', abort);
            res.end();
        }
    });
    // Retain the documented JSON endpoint for existing clients; no context/history is persisted or sent.
    app.post('/api/v1/core/ai/chat', async (req, res) => {
        core.classAccess(user(res), identifier.parse(req.body?.classId));
        runtime();
        const body = compatibilityBody.parse(req.body), last = body.messages.at(-1);
        ensure(last.role === 'user', 400, 'INVALID_INPUT', '最后一条消息必须是学生问题');
        let prepared;
        try {
            prepared = await prepare(res, { classId: body.classId, question: last.text, clientRequestId: body.clientRequestId });
        }
        catch (e) {
            translate(e);
        }
        const { a, principal, input, requestId } = prepared;
        const controller = new AbortController(), abort = () => controller.abort();
        res.on('close', abort);
        const timer = setTimeout(abort, a.gateway.policy.requestTimeoutMs);
        let reply = '', terminal = '', failure = '', sources = [];
        try {
            await a.gateway.answer(principal, input, requestId, controller.signal, async (event, raw) => {
                const d = raw;
                if (event === 'delta')
                    reply += d.text ?? '';
                if (event === 'sources')
                    sources = d.sources ?? [];
                if (event === 'refusal' || event === 'insufficient_evidence') {
                    reply = d.message ?? '';
                    terminal = event;
                }
                if (event === 'done')
                    terminal = 'done';
                if (event === 'error')
                    failure = d.code ?? 'REQUEST_FAILED';
            });
            ensure(!failure && terminal, 502, failure || 'UPSTREAM_INCOMPLETE', 'AI请求未完成，费用状态请查看用量');
            ok(res, { reply, sources, outcome: terminal, mode: a.mode });
        }
        finally {
            clearTimeout(timer);
            res.off('close', abort);
        }
    });
}
//# sourceMappingURL=ai.js.map