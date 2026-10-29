> 2026-10-29：独立交付当前说明见[AI模块独立交付](../docs/integration/AI模块独立交付.md)及[专用接续](../handoff/AI_MODULE_ONLY.md)。本文件主要描述引擎独立接口；宿主持久会话接口不在/api/ai/v1，其路径为/api/v1/core/ai。账本不存正文，宿主按最新要求私有保存本人对话。

# 给主系统/前端工作者的合并说明

独立模块目录course-ai-module，Node/TypeScript，无前端变更、无旧数据库依赖。先读MERGE_CONTRACT.md；公共入口src/index.ts，编译输出同时有.d.ts。

主系统负责：登录/角色、稳定课程标识、学生选课/教师授课实时授权、资料上传与审批、前端提问框/POST SSE和统计展示。
本模块负责：通过注入接口核对身份/选课、课程证据检索边界、模型调用与流解析、限流/调度/预算、元数据账本、主题聚合及余额状态。

合并时不要向浏览器发DeepSeek Key或让浏览器调用DeepSeek。前端用现有访问令牌调用POST /api/ai/v1/questions，只传courseId/question/clientRequestId。不要传可信userId、model或endpoint。done才代表完整完成，error/refusal/insufficient_evidence分别展示；delta按纯文本展示，勿直接插入HTML。

现有课程可能只有班级ID和批次ID，需由主系统明确courseId→knowledgeScope映射。不要用课程名称自动共享资料。接口联调使用JWT可信issuer/audience或宿主IdentityResolver；StaticAuthorization与模拟JWT只作本机演示。

容量目标300同时AI/API + 500系统用户。模块配置示例350生成/600排队。测试只证明替身峰值300、500鉴权访问与500已建立连接（握手1/10ms）；不是整站在线/真实DeepSeek/瞬间新连接风暴。跨实例生产还需要PG BillingStore、Redis AdmissionScheduler、共享预算和租约、故障恢复压测；本机SQLite同库拒绝多进程。

不留具体对话：前端可在当前页面内存显示，禁止默认历史对话持久化；后端日志/APM/代理/队列/缓存都不能保存正文或问题向量。只保留计费元数据和不关联个人的主题聚合。未知usage保持费用预留，不能按失败自动退款/重试。

用户尚未确定预算/配额/余额阈值，模拟价格不是正式价格。真实环境须配置课程资料、阈值标定、供应商账号与数据处理政策，再单独验收受控付费调用。源码包不含Key/JWT/数据库/node_modules。
