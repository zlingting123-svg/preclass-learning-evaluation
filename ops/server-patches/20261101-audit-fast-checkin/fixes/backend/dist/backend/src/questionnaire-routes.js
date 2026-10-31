import { z } from "zod";
import { QuestionnaireService } from "./questionnaires.js";
import { previewFile } from "./file-preview.js";
import { ensure } from "./errors.js";
export function questionnaireRoutes(app, core, ok) {
    const service = new QuestionnaireService(core), u = (res) => res.locals.user;
    const param = (v) => z.string().min(1).max(128).parse(v);
    app.post("/api/v1/core/files/preview", async (req, res) => {
        core.role(u(res), "teacher");
        ok(res, await previewFile(req.body));
    });
    app.get("/api/v1/core/classes/:id/members", (req, res) => ok(res, service.members(u(res), param(req.params.id))));
    for (const action of ['preview', 'commit'])
        app.post(`/api/v1/core/classes/:id/roster/${action}`, (_req, _res) => { ensure(false, 403, 'ADMIN_ROSTER_REQUIRED', '学生名单由管理员统一导入，教师端仅可查看'); });
    app.get("/api/v1/core/classes/:id/surveys", (req, res) => ok(res, service.list(u(res), param(req.params.id))));
    app.post("/api/v1/core/surveys", (req, res) => ok(res, service.save(u(res), req.body)));
    app.put("/api/v1/core/surveys/:id", (req, res) => ok(res, service.save(u(res), req.body, param(req.params.id))));
    app.get("/api/v1/core/surveys/:id", (req, res) => ok(res, service.get(u(res), param(req.params.id))));
    for (const action of ["publish", "close"])
        app.post(`/api/v1/core/surveys/:id/${action}`, (req, res) => ok(res, service.transition(u(res), param(req.params.id), z.number().int().parse(req.body.expectedVersion), action)));
    app.post("/api/v1/core/surveys/:id/start", (req, res) => ok(res, service.start(u(res), param(req.params.id))));
    app.put("/api/v1/core/surveys/:id/draft", (req,res)=>ok(res, service.saveDraft(u(res),param(req.params.id),req.body)));
    app.post("/api/v1/core/surveys/:id/submit", (req, res) => ok(res, service.submit(u(res), param(req.params.id), req.body.answers,req.body.expectedDraftVersion)));
    app.get("/api/v1/core/surveys/:id/stats", (req, res) => ok(res, service.stats(u(res), param(req.params.id))));
    app.get("/api/v1/core/responses/:id", (req, res) => ok(res, service.detail(u(res), param(req.params.id))));
    // A real AI integration must replace these explicit unavailable responses. Never fake a reply.
    for (const kind of ["chat", "generate", "insights"])
        app.post(`/api/v1/core/ai/${kind}`, (req, res) => {
            const classId = param(req.body.classId);
            core.classAccess(u(res), classId);
            if (kind !== "chat")
                core.role(u(res), "teacher");
            ensure(false, 503, "AI_NOT_CONNECTED", "AI 服务尚未接入，请联系负责 AI 的同学");
        });
}
//# sourceMappingURL=questionnaire-routes.js.map