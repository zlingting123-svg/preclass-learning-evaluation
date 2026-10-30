import { createHash } from 'node:crypto';
import type { Request, Response } from 'express';
import { rateLimit, ipKeyGenerator } from 'express-rate-limit';

export function loginLimiters() {
  const handler = (_req: Request, res: Response) => {
    res.status(429).json({ ok: false, error: { code: 'RATE_LIMITED', message: '登录尝试过多，请稍后重试' }, requestId: res.locals.requestId });
  };
  // Shared school NATs must not be locked after ten successful student logins.
  const burst = rateLimit({ windowMs: 300000, limit: 600, standardHeaders: 'draft-8', legacyHeaders: false, identifier: 'login-burst', handler });
  const account = rateLimit({
    windowMs: 300000, limit: 10, skipSuccessfulRequests: true,
    standardHeaders: 'draft-8', legacyHeaders: false, identifier: 'login-account', handler,
    keyGenerator: req => {
      const username = typeof req.body?.username === 'string' ? req.body.username.slice(0, 100).toLowerCase() : '';
      return createHash('sha256').update(ipKeyGenerator(req.ip ?? '127.0.0.1') + '\0' + username).digest('hex');
    },
  });
  return [burst, account];
}
