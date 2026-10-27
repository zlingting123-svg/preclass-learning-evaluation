import express, { type ErrorRequestHandler, type Request, type Response } from 'express';
import helmet from 'helmet';
import { randomUUID } from 'node:crypto';
import { z, ZodError } from 'zod';
import { CONTRACT_VERSION, type User } from '../../shared/contracts.js';
import type { AuthProvider } from './auth.js';
import { AppError, ensure } from './errors.js';
import { Service, page } from './service.js';
import { answersBody, assignmentBody, id, reviewBody, versionBody } from './validation.js';
import { loginLimiters } from './security.js';

export function createApp(service: Service, auth: AuthProvider) {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet({ strictTransportSecurity: false, contentSecurityPolicy: { directives: { upgradeInsecureRequests: null } } }));
  app.use((_req, res, next) => {
    res.locals.requestId = randomUUID(); res.setHeader('X-Request-Id', res.locals.requestId);
    res.setHeader('Cache-Control', 'no-store'); res.setHeader('X-Content-Type-Options', 'nosniff');
    next();
  });
  app.use((req, _res, next) => {
    // Intended for Vite's same-origin proxy, not arbitrary CORS clients.
    const origin = req.get('origin');
    ensure(!origin || ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:3001', 'http://127.0.0.1:3001'].includes(origin), 403, 'FORBIDDEN', '请求来源不允许');
    next();
  });
  app.use(express.json({ limit: '2mb', strict: true }));
  const ok = (res: Response, data: unknown) => res.json({ ok: true, data, requestId: res.locals.requestId });
  app.get('/api/v1/health', (_req, res) => ok(res, { contractVersion: CONTRACT_VERSION, storage: 'local-sqlite', auth: 'local-bcrypt', productionReady: false }));
  app.post('/api/v1/auth/login', ...loginLimiters(), async (req, res) => ok(res, await auth.login(req.body)));
  app.use('/api/v1', (req, res, next) => {
    const header = req.get('authorization');
    ensure(header && header.startsWith('Bearer ') && header.length <= 200, 401, 'UNAUTHENTICATED', '请登录');
    res.locals.token = header.slice(7); res.locals.user = auth.authenticate(res.locals.token); next();
  });
  const user = (res: Response): User => res.locals.user;
  const param = (req: Request) => id.parse(req.params.id);
  const pagination = (req: Request) => z.object({ limit: z.coerce.number().int().min(1).max(100).default(20), cursor: z.string().min(1).max(256).optional() }).parse(req.query);
  const list = <T extends { id: string }>(req: Request, res: Response, items: T[]) => {
    const { limit, cursor } = pagination(req); return ok(res, page(items, limit, cursor));
  };
  app.get('/api/v1/auth/me', (_req, res) => ok(res, user(res)));
  app.post('/api/v1/auth/logout', (_req, res) => { auth.logout(res.locals.token); ok(res, { success: true }); });
  app.get('/api/v1/classes', (req, res) => list(req, res, service.classes(user(res))));
  app.post('/api/v1/teacher/classes', (req, res) => {
    const body = z.object({ name: z.string().trim().min(1).max(200) }).strict().parse(req.body);
    ok(res, service.createClass(user(res), body.name));
  });
  app.post('/api/v1/classes/join', (req, res) => {
    const body = z.object({ joinCode: z.string().trim().min(1).max(100).transform(v => v.toUpperCase()) }).strict().parse(req.body);
    ok(res, service.join(user(res), body.joinCode));
  });
  app.get('/api/v1/assignments', (req, res) => {
    const classId = id.optional().parse(req.query.classId);
    list(req, res, service.assignments(user(res), classId));
  });
  app.get('/api/v1/assignments/:id', (req, res) => ok(res, service.assignment(user(res), param(req))));
  app.get('/api/v1/teacher/rubrics', (req, res) => list(req, res, service.rubrics(user(res))));
  app.post('/api/v1/teacher/assignments', (req, res) => ok(res, service.saveAssignment(user(res), assignmentBody.parse(req.body))));
  app.put('/api/v1/teacher/assignments/:id', (req, res) => ok(res, service.saveAssignment(user(res), assignmentBody.parse(req.body), param(req))));
  for (const action of ['publish', 'close'] as const) {
    app.post(`/api/v1/teacher/assignments/:id/${action}`, (req, res) => ok(res, service.transition(user(res), param(req), versionBody.parse(req.body).expectedVersion, action)));
  }
  app.put('/api/v1/teacher/assignments/:id/rubric', (req, res) => {
    const body = versionBody.extend({ rubricId: id }).strict().parse(req.body);
    ok(res, service.bindRubric(user(res), param(req), body.rubricId, body.expectedVersion));
  });
  app.get('/api/v1/assignments/:id/my-submission', (req, res) => ok(res, service.mySubmission(user(res), param(req))));
  app.put('/api/v1/assignments/:id/my-draft', (req, res) => ok(res, service.saveAnswers(user(res), param(req), answersBody.parse(req.body))));
  app.post('/api/v1/assignments/:id/submit', (req, res) => {
    const key = z.string().min(8).max(128).regex(/^[a-zA-Z0-9_-]+$/).parse(req.get('Idempotency-Key'));
    ok(res, service.saveAnswers(user(res), param(req), answersBody.parse(req.body), key));
  });
  app.get('/api/v1/submissions/:id/report', (req, res) => ok(res, service.report(user(res), param(req))));
  app.get('/api/v1/teacher/assignments/:id/submissions', (req, res) => list(req, res, service.overviews(user(res), param(req))));
  app.get('/api/v1/teacher/submissions/:id', (req, res) => ok(res, service.submission(user(res), param(req), true)));
  app.get('/api/v1/teacher/assignments/:id/summary', (req, res) => ok(res, service.summary(user(res), param(req))));
  app.post('/api/v1/teacher/submissions/:id/retry', (req, res) => ok(res, service.retry(user(res), param(req), versionBody.parse(req.body).expectedVersion)));
  app.put('/api/v1/teacher/submissions/:id/review', (req, res) => ok(res, service.review(user(res), param(req), reviewBody.parse(req.body))));
  app.get('/api/v1/teacher/assignments/:id/export', (req, res) => {
    const csv = service.export(user(res), param(req));
    res.type('text/csv; charset=utf-8').setHeader('Content-Disposition', 'attachment; filename="assignment.csv"'); res.send(csv);
  });
  app.use((_req, _res, next) => next(new AppError(404, 'NOT_FOUND', '接口不存在')));
  const errors: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
    const bodyError = error as { type?: string };
    const known = error instanceof AppError ? error : error instanceof ZodError ? new AppError(400, 'VALIDATION_ERROR', '请求字段无效') :
      bodyError?.type === 'entity.too.large' ? new AppError(413, 'VALIDATION_ERROR', '请求内容过长') :
      bodyError?.type === 'entity.parse.failed' ? new AppError(400, 'VALIDATION_ERROR', 'JSON格式无效') :
      new AppError(500, 'INTERNAL_ERROR', '服务暂时异常，请凭请求标识联系维护者');
    if (known.status === 429) res.setHeader('Retry-After', '300');
    if (known.status >= 500) process.stderr.write(JSON.stringify({ event: 'request_failed', requestId: res.locals.requestId, code: known.code }) + '\n');
    res.status(known.status).json({ ok: false, error: { code: known.code, message: known.message, ...(known.details ? { details: known.details } : {}) }, requestId: res.locals.requestId });
  };
  app.use(errors); return app;
}
