import express, { type ErrorRequestHandler, type Response } from "express";
import helmet from "helmet";
import { z } from "zod";
import { once } from "node:events";
import { randomUUID } from "node:crypto";
import type { Principal } from "./contracts.js";
import { Gateway } from "./gateway.js";
import { ModuleError, requireValue } from "./errors.js";
import { BalanceMonitor } from "./balance.js";
const id = z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/);
export const questionBody = z
  .object({
    courseId: id,
    clientRequestId: id,
    question: z.string().trim().min(1).max(6000),
  })
  .strict();
export function createModuleApp(gateway: Gateway, balances?: BalanceMonitor) {
  const app = express();
  app.disable("x-powered-by");
  app.use(helmet());
  app.use((_req, res, next) => {
    res.locals.requestId = randomUUID();
    res.setHeader("Cache-Control", "no-store");
    next();
  });
  app.get("/health", (_req, res) =>
    res.json({ module: "course-ai", version: "0.1.0", liveReady: false }),
  );
  app.use("/api/ai/v1", async (req, res, next) => {
    try {
      const token = req.headers.authorization;
      requireValue(
        typeof token === "string" &&
          token.startsWith("Bearer ") &&
          token.length < 8192,
        401,
        "LOGIN_REQUIRED",
      );
      res.locals.user = await gateway.deps.identity.verify(token.slice(7));
      next();
    } catch {
      next(new ModuleError(401, "INVALID_IDENTITY"));
    }
  });
  app.use(express.json({ limit: "32kb", strict: true }));
  const ok = (res: Response, data: unknown) =>
    res.json({ ok: true, data, requestId: res.locals.requestId });
  const user = (res: Response) => res.locals.user as Principal;
  app.post("/api/ai/v1/questions", async (req, res, next) => {
    try {
      const input = questionBody.parse(req.body);
      const principal = user(res);
      const requestId = await gateway.prepare(principal, input);
      res.locals.requestId = requestId;
      const controller = new AbortController();
      const abort = () => controller.abort();
      res.on("close", abort);
      const timer = setTimeout(abort, gateway.policy.requestTimeoutMs);
      res.status(200).set({
        "Content-Type": "text/event-stream; charset=utf-8",
        "X-Accel-Buffering": "no",
      });
      res.flushHeaders();
      const emit = async (event: string, data: unknown) => {
        requireValue(
          !controller.signal.aborted && !res.destroyed,
          499,
          "CANCELLED",
        );
        if (!res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
          await once(res, "drain", { signal: controller.signal });
      };
      try {
        await gateway.answer(
          principal,
          input,
          requestId,
          controller.signal,
          emit,
        );
      } finally {
        clearTimeout(timer);
        res.off("close", abort);
        res.end();
      }
    } catch (e) {
      next(e);
    }
  });
  app.get("/api/ai/v1/usage/me", async (_req, res) =>
    ok(res, await gateway.store.summary(user(res).subjectId)),
  );
  app.get("/api/ai/v1/teacher/courses/:id/topics", async (req, res, next) => {
    try {
      const p = user(res);
      requireValue(p.role === "teacher", 403, "TEACHER_REQUIRED");
      const course = id.parse(req.params.id);
      await gateway.deps.authorization.authorize(p, course, "topics");
      ok(res, {
        courseId: course,
        buckets: await gateway.store.topics(
          course,
          gateway.policy.topicsMinCount,
        ),
        privacyThreshold: gateway.policy.topicsMinCount,
      });
    } catch (e) {
      next(e);
    }
  });
  app.get("/api/ai/v1/admin/usage", async (_req, res, next) => {
    try {
      requireValue(user(res).role === "admin", 403, "ADMIN_REQUIRED");
      ok(res, {
        summary: await gateway.store.summary(),
        entries: (await gateway.store.rows()).map(({ fingerprint, ...row }) => {
          void fingerprint;
          return row;
        }),
      });
    } catch (e) {
      next(e);
    }
  });
  app.get("/api/ai/v1/admin/provider-accounts", async (_req, res, next) => {
    try {
      requireValue(user(res).role === "admin", 403, "ADMIN_REQUIRED");
      const unique = [
        ...new Map(gateway.deployments.map((d) => [d.accountId, d])).values(),
      ];
      const balanceStates = await Promise.all(
        unique.map(async (d) => {
          try {
            return balances
              ? await balances.inspect(d, AbortSignal.timeout(6000))
              : { accountId: d.accountId, state: "not_configured" };
          } catch {
            return { accountId: d.accountId, state: "unknown" };
          }
        }),
      );
      ok(res, {
        ...(await gateway.scheduler.status()),
        balances: balanceStates,
      });
    } catch (e) {
      next(e);
    }
  });
  app.use((_req, _res, next) => next(new ModuleError(404, "NOT_FOUND")));
  const errors: ErrorRequestHandler = (error, _req, res, _next) => {
    if (res.headersSent) {
      res.end();
      return;
    }
    const err =
      error instanceof ModuleError
        ? error
        : error instanceof z.ZodError
          ? new ModuleError(400, "INVALID_INPUT")
          : (error as { type?: string })?.type === "entity.too.large"
            ? new ModuleError(413, "INPUT_TOO_LARGE")
            : (error as { type?: string })?.type === "entity.parse.failed"
              ? new ModuleError(400, "INVALID_JSON")
              : new ModuleError(500, "INTERNAL_ERROR");
    if (err.status === 429) res.setHeader("Retry-After", "5");
    res.status(err.status).json({
      ok: false,
      error: { code: err.code },
      requestId: res.locals.requestId,
    });
  };
  app.use(errors);
  return app;
}
