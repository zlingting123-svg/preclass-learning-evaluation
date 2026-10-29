import type { Express, Response } from "express";
import { z } from "zod";
import type { User } from "../../shared/contracts.js";
import type { Service } from "./service.js";
import { QuestionnaireService } from "./questionnaires.js";
import { previewFile } from "./file-preview.js";
import { ensure } from "./errors.js";

export function questionnaireRoutes(
  app: Express,
  core: Service,
  ok: (res: Response, data: unknown) => unknown,
) {
  const service = new QuestionnaireService(core),
    u = (res: Response): User => res.locals.user;
  const param = (v: unknown) => z.string().min(1).max(128).parse(v);
  app.post("/api/v1/core/files/preview", async (req, res) => {
    core.role(u(res), "teacher");
    ok(res, await previewFile(req.body));
  });
  app.get("/api/v1/core/classes/:id/members", (req, res) =>
    ok(res, service.members(u(res), param(req.params.id))),
  );
  app.post("/api/v1/core/classes/:id/roster/preview", (req, res) =>
    ok(res, service.previewRoster(u(res), param(req.params.id), req.body.rows)),
  );
  app.post("/api/v1/core/classes/:id/roster/commit", async (req, res) => {
    const b = z
      .object({ planId: z.string(), fingerprint: z.string() })
      .strict()
      .parse(req.body);
    ok(
      res,
      await service.commitRoster(
        u(res),
        param(req.params.id),
        b.planId,
        b.fingerprint,
      ),
    );
  });
  app.get("/api/v1/core/classes/:id/surveys", (req, res) =>
    ok(res, service.list(u(res), param(req.params.id))),
  );
  app.post("/api/v1/core/surveys", (req, res) =>
    ok(res, service.save(u(res), req.body)),
  );
  app.put("/api/v1/core/surveys/:id", (req, res) =>
    ok(res, service.save(u(res), req.body, param(req.params.id))),
  );
  app.get("/api/v1/core/surveys/:id", (req, res) =>
    ok(res, service.get(u(res), param(req.params.id))),
  );
  for (const action of ["publish", "close"] as const)
    app.post(`/api/v1/core/surveys/:id/${action}`, (req, res) =>
      ok(
        res,
        service.transition(
          u(res),
          param(req.params.id),
          z.number().int().parse(req.body.expectedVersion),
          action,
        ),
      ),
    );
  app.post("/api/v1/core/surveys/:id/start", (req, res) =>
    ok(res, service.start(u(res), param(req.params.id))),
  );
  app.post("/api/v1/core/surveys/:id/submit", (req, res) =>
    ok(res, service.submit(u(res), param(req.params.id), req.body.answers)),
  );
  app.get("/api/v1/core/surveys/:id/stats", (req, res) =>
    ok(res, service.stats(u(res), param(req.params.id))),
  );
  app.get("/api/v1/core/responses/:id", (req, res) =>
    ok(res, service.detail(u(res), param(req.params.id))),
  );
  // A real AI integration must replace these explicit unavailable responses. Never fake a reply.
  for (const kind of ["generate", "insights"])
    app.post(`/api/v1/core/ai/${kind}`, (req, res) => {
      const classId = param(req.body.classId);
      core.classAccess(u(res), classId);
      if (kind !== "chat") core.role(u(res), "teacher");
      ensure(
        false,
        503,
        "AI_NOT_CONNECTED",
        "AI 服务尚未接入，请联系负责 AI 的同学",
      );
    });
}
