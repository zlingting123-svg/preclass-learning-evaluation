> 2026-10-29：独立交付当前说明见[AI模块独立交付](../docs/integration/AI模块独立交付.md)及[专用接续](../handoff/AI_MODULE_ONLY.md)。本文件主要描述引擎独立接口；宿主持久会话接口不在/api/ai/v1，其路径为/api/v1/core/ai。账本不存正文，宿主按最新要求私有保存本人对话。

# 主系统合并接口 0.1.0

本模块独立于旧前端，不修改旧shared契约。JSON成功信封{ok:true,data,requestId}；失败{ok:false,error:{code},requestId}。统一前缀/api/ai/v1。Bearer由主系统签发并验证；本机JWT只是演示，不是新注册系统。

| 方法/路径 | 身份及输入 | 返回 |
|---|---|---|
| POST /questions | student且已选课；严格{courseId,question,clientRequestId} | POST fetch读取SSE |
| GET /usage/me | 已认证；身份从令牌获得 | 本人累计请求/调用尝试、已完成数、未知用量、输入输出tokens、费用与预留 |
| GET /teacher/courses/:id/topics | teacher且有该课程统计权限 | 不含个人关联的月度预定义topicId计数；低于门槛不返回 |
| GET /admin/usage | admin | 元数据账本与汇总，无正文及HMAC |
| GET /admin/provider-accounts | admin | 账户/部署组、活跃/冷却与余额状态，无Key |

SSE路径：accepted → queued → sources → delta → done。若无需模型则refusal（超范围）或insufficient_evidence（无依据）。流式开始前可返回400/401/403/409/429/503；开始后故障为error事件而非更改HTTP状态，未收到done不能认为完整成功。delta是纯文本，前端须安全文本渲染。sources仅为已批准证据引用清单，不能将其视作模型每句话已核实的证明。

clientRequestId在用户/课程内去重；重复请求返回409 REQUEST_ALREADY_HANDLED，不重放原回答（因为没有存储），不同输入复用ID返回IDEMPOTENCY_CONFLICT。前端不要给不确定是否成功的请求换ID盲目重试。usage_unknown保持保守预留，需对账而非自动退款。

余额/策略管理采用受控配置文件，PUT /admin/policies尚未实现。时间额度按UTC日/月，币种不混加；货币金额为整数微单位（1 currency=1,000,000 micros）。当前usage/me为全时累计，日期分页查询尚未实现。modelCalls表示已进入上游调用阶段的尝试数，超时/取消的供应商最终调用数与费用可能待核对。

## 宿主注入

- IdentityResolver.verify(token)：返回经可信签名/会话验证的subjectId与role。内置jwtIdentity支持受控HS256/RS256/ES256 key，算法白名单、issuer/audience必配。
- CourseAuthorizer.authorize(principal,courseId,ask|topics)：独立核对实时选课/授课权限，返回scopeIds；本机StaticAuthorization仅演示。
- KnowledgeProvider.retrieve：返回supported/out_of_scope/insufficient、Evidence及scoreType；网关再次核对approved/scopeId。实现可接LangChain.js/RAGFlow；不要持久缓存查询原文或查询向量。
- ModelProvider.stream：必须给出流结束与有效Usage，否则按未知费用处理；Key由服务端配置注入，不接收用户自选endpoint/model/key。
- BillingStore：异步接口允许接PostgreSQL；reserve必须跨实例原子检查幂等、次数和预算，不能先检查后另行扣费。其余方法须使用元数据白名单，不能存任意请求JSON。
- AdmissionScheduler：take返回部署与release，释放可异步；Redis适配须实现用户/账户组共享并发、租约失效与服务退出释放，正文仅留RAM。默认Scheduler只有单实例语义；当前Ledger会拒绝第二个进程同时打开同一文件。

主系统联调还要确定稳定courseId（旧系统只有classId/cohortId，不按名称猜）、资料范围、教师统计权限、令牌撤销方案、统计保留期及部署SLA。学生API不返回服务端密钥、prompt或原始供应商错误。当前管理端没有模型工具调用/执行代码权限。
