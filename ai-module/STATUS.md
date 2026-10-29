> **2026-10-29 最新交付：** feature/ai-module-only基于61751cc重新提取，未带入PR #6的前端、管理端或认证变更。包含主系统会话保存/删除/续聊，最新接口见../docs/integration/AI模块独立交付.md，接续见../handoff/AI_MODULE_ONLY.md。下方为独立引擎历史验证，不能当成本分支整站或真实模型验收。

# AI/API模块接续

更新：2026-10-28。用户最新分工只做独立AI/API模块，原前端交由其他人；不改或合并旧项目。新容量目标：至少300同时API请求、500系统用户，配置需留余量。

第一版本地模块已实现：src/index.ts导出合并接口；jose鉴权、独立选课授权、检索边界与词项覆盖样例、DeepSeek Flash SSE适配、按用途部署池/账户共享并发、有界RAM队列、单用户并发、取消、余额告警/停止/未知状态、SQLite仅元数据账本/预算预留/幂等/崩溃保守恢复、教师聚合主题与管理员统计。预算与真实价格未确定，真实调用关闭；无真实模型Key/调用/费用。

测试与边界见verification/2026-10-28-local.md、tests-latest.txt和容量JSON。受控本地HTTP可完成300请求且替身峰值300（配置350/600），500请求/500连接通过；TCP握手按1/10ms，不是瞬时连接风暴或真实DeepSeek/整站验收。前期ECONNRESET仍如实记录。SQLite强制单进程；异步BillingStore/AdmissionScheduler为PG/Redis及未来合并预留，生产适配尚未实现。

启动：npm ci、npm run build、python3 scripts/sample.py start；8891端口，问答printf输入通过scripts/client.mjs ask测试；usage/topics/accounts可看接口。停止python3 scripts/sample.py stop。JWT/密钥/数据库只在work，不共享。保留旧模块目录的只读背景，不回头改前端。

下一步：先读README、MERGE_CONTRACT和本文件，核对最终check/build/test/audit结果；按主系统提供的课程/账号授权接口替换本机适配器。继续真实课程检索与生产共享调度/账本，再等预算/上游政策确认后进行受控真实API对账和压测。未完成项不能改写为通过。

最终本轮check/build与18/18测试通过；依赖审计0已知漏洞。独立服务8891的health与SSE/用量接口已实际调用，停止/重启后元数据保留。配置提供350生成/600排队技术余量，但没有因此开启付费或宣称多副本容灾。

2026-10-28打开调试：服务保持8891本机mock运行，scripts/debug.mjs对实际HTTP接口11项检查通过，结果见verification/debug-latest.json；浏览器已显示health。本次未重跑容量压测、未调用真实模型。
