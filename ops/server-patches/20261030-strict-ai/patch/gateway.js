import { createHmac } from "node:crypto";
import { Scheduler } from "./scheduler.js";
import { ModuleError, requireValue } from "./errors.js";
import { messages } from "./deepseek.js";
export class Gateway {
    deps;
    store;
    policy;
    deployments;
    fingerprintKey;
    balances;
    scheduler;
    constructor(deps, store, policy, deployments, fingerprintKey, balances, scheduler) {
        this.deps = deps;
        this.store = store;
        this.policy = policy;
        this.deployments = deployments;
        this.fingerprintKey = fingerprintKey;
        this.balances = balances;
        this.scheduler = scheduler ?? new Scheduler(deployments, policy);
        requireValue(fingerprintKey.length >= 32, 500, "FINGERPRINT_KEY_REQUIRED");
    }
    async prepare(user, input) {
        requireValue(user.role === "student" || (user.role === "teacher" && this.deps.allowTeacherQuestions === true), 403, "QUESTION_ROLE_REQUIRED");
        requireValue(!input.purpose || input.purpose === "teacher_analytics" && user.role === "teacher",403,"INVALID_PURPOSE");
        await this.deps.authorization.authorize(user, input.courseId, "ask");
        requireValue(this.policy.enabled, 503, "AI_DISABLED");
        requireValue(Buffer.byteLength(input.question) <= this.policy.maxInputBytes, 400, "QUESTION_TOO_LONG");
        const hash = (v) => createHmac("sha256", this.fingerprintKey).update(v).digest("hex");
        const id = hash(JSON.stringify([user.subjectId, input.courseId, input.clientRequestId]));
        await this.store.reserve({
            id,
            fingerprint: hash(JSON.stringify(input)),
            subjectId: user.subjectId,
            purpose: input.purpose ?? (user.role === "teacher" ? "teacher_qa" : "student_qa"),
            courseId: input.courseId,
        }, this.policy);
        return id;
    }
    async answer(user, input, id, signal, emit) {
        let lease;
        let called = false, usage, finished = false;
        let inputBytes = 0;
        try {
            await emit("accepted", { requestId: id });
            const grants = await this.deps.authorization.authorize(user, input.courseId, "ask");
            requireValue(!input.purpose || input.purpose === "teacher_analytics" && user.role === "teacher",403,"INVALID_PURPOSE");
            const found = input.purpose === "teacher_analytics" ? {status:"general_knowledge",evidence:[],scoreType:"anonymous_survey_summary"} : await this.deps.knowledge.retrieve({
                ...input,
                scopeIds: grants.scopeIds,
                signal,
            });
            if (!input.purpose && found.status === "general_knowledge") {found.status="insufficient";found.evidence=[];}
            if (!input.purpose && found.status === "local_guidance") {
                requireValue(typeof found.message === "string" && found.message.length <= 180,500,"INVALID_GUIDANCE");
                const localUsage={inputTokens:0,outputTokens:0,cacheHitTokens:0};
                await this.store.finish(id,localUsage,this.policy);
                await emit("sources",{requestId:id,sources:[],scoreType:"non_subject_guidance"});
                await emit("delta",{text:found.message});
                await emit("done",{requestId:id,usage:localUsage,usageState:"not_called",answerBasis:"non_subject_guidance"});
                return;
            }
            if (found.status !== "supported" && found.status !== "general_knowledge") {
                const status = found.status === "out_of_scope" ? "refusal" : "insufficient_evidence";
                await this.store.noCall(id, status);
                await emit(status, {
                    requestId: id,
                    message: found.message ?? (status === "refusal"
                        ? "此问题不在本课程范围内。"
                        : "已上传资料与生态环境部官网文件暂不足以支持回答，不能自行补充专业知识。"),
                });
                return;
            }
            requireValue((found.status === "general_knowledge" ? found.evidence.length === 0 : found.evidence.length > 0) &&
                found.evidence.every((e) => e.approved && grants.scopeIds.includes(e.scopeId)), 403, "RETRIEVAL_SCOPE_VIOLATION");
            if (!input.purpose) requireValue(found.evidence.every(e=>e.sourceType==="uploaded_material" || e.sourceType==="mee_official" && typeof e.url==="string" && (()=>{try{const u=new URL(e.url);return u.protocol==="https:"&&!u.username&&!u.password&&!u.port&&(u.hostname==="mee.gov.cn"||u.hostname.endsWith(".mee.gov.cn"))}catch{return false}})()),403,"UNAUTHORIZED_KNOWLEDGE_SOURCE");
            const upstream = {
                task: input.purpose === "teacher_analytics" ? "survey_analysis" : undefined,
                answerBasis: found.status === "general_knowledge" ? "general_knowledge" : "course_evidence",
                question: input.question,
                history: input.history ? (input.purpose ? [...input.history] : input.history.filter(m=>m.role==="user").slice(-3)) : undefined,
                evidence: found.evidence,
                userId: createHmac("sha256", this.fingerprintKey)
                    .update(user.subjectId)
                    .digest("hex"),
                maxOutputTokens: this.policy.maxOutputTokens,
                signal,
            };
            inputBytes = Buffer.byteLength(JSON.stringify(messages(upstream)));
            while (inputBytes > this.policy.maxInputBytes && upstream.history?.length) {
                upstream.history.splice(0, 2);
                inputBytes = Buffer.byteLength(JSON.stringify(messages(upstream)));
            }
            requireValue(inputBytes <= this.policy.maxInputBytes, 400, "CONTEXT_TOO_LONG");
            await emit("queued", { requestId: id });
            const purpose = input.purpose === "teacher_analytics" && this.deployments.some(d=>d.purposes.includes("teacher_analytics")) ? "teacher_analytics" : user.role === "teacher" && this.deployments.some(d => d.purposes.includes("teacher_qa")) ? "teacher_qa" : "student_qa";
            lease = await this.scheduler.take(user.subjectId, signal, purpose);
            signal.throwIfAborted();
            await this.deps.authorization.authorize(user, input.courseId, "ask");
            if (this.balances)
                await this.balances.admit(lease.deployment, signal);
            await this.store.update(id, {
                state: "calling",
                deploymentId: lease.deployment.id,
                accountId: lease.deployment.accountId,
                model: lease.deployment.provider.model,
            });
            called = true;
            await emit("sources", {
                requestId: id,
                sources: found.evidence.map(({ id, title, url, version }) => ({
                    id,
                    title,
                    url,
                    version,
                })),
                scoreType: found.scoreType,
            });
            if (found.status === "general_knowledge" && !input.purpose)
                await emit("delta", { text: "【一般知识解释，未依据已上传课程资料】\n\n" });
            for await (const event of lease.deployment.provider.stream(upstream)) {
                if (event.type === "model")
                    await this.store.update(id, { model: event.model });
                else if (event.type === "delta") {
                    requireValue(!finished, 502, "CONTENT_AFTER_FINISH");
                    await emit("delta", { text: event.text });
                }
                else if (event.type === "usage") {
                    const u = event.usage;
                    requireValue(!usage, 502, "DUPLICATE_USAGE");
                    requireValue(Object.values(u).every((n) => Number.isSafeInteger(n) && n >= 0) &&
                        u.cacheHitTokens <= u.inputTokens, 502, "INVALID_USAGE");
                    usage = u;
                }
                else {
                    requireValue(!finished, 502, "DUPLICATE_FINISH");
                    finished = true;
                }
            }
            requireValue(finished && usage, 502, "UPSTREAM_INCOMPLETE");
            await this.store.finish(id, usage, this.policy);
            for (const topic of user.role === "student" ? new Set(found.evidence.map((e) => e.topicId)) : [])
                await this.store.topic(input.courseId, topic);
            await emit("done", { requestId: id, usage, usageState: "settled" });
        }
        catch (error) {
            const code = signal.aborted
                ? "CANCELLED"
                : error instanceof ModuleError
                    ? error.code
                    : "REQUEST_FAILED";
            const current = await this.store.get(id);
            if (current?.state !== "completed") {
                if (called) {
                    await this.store.update(id, {
                        state: "usage_unknown",
                        errorCode: code,
                    });
                    if (lease)
                        await this.scheduler.fail(lease.deployment.quotaGroup);
                }
                else
                    await this.store.noCall(id, code);
            }
            try {
                await emit("error", {
                    requestId: id,
                    code,
                    usageState: current?.state === "completed"
                        ? "settled"
                        : called
                            ? "unknown"
                            : "not_called",
                    retryable: false,
                });
            }
            catch {
                /* Closed socket: never log content. */
            }
        }
        finally {
            await lease?.release();
        }
    }
}
