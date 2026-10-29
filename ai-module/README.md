# 独立课程AI/API模块 0.1.0

本目录只负责AI/API模块，保留与主系统合并接口；不修改之前的前端、账号系统或数据库。Node 24.15–24.x。当前交付是本机可测试的第一版，真实DeepSeek调用默认关闭，预算未确定时不能付费调用。

## 快速运行

```sh
npm ci
npm run check
npm run build
npm test
python3 scripts/sample.py start
```

本机API：http://127.0.0.1:8891/health。独立端口，不影响旧系统5173/3001及Moodle8873。没有新做前端页面。

```sh
printf '环境评价的作用是什么？' | node scripts/client.mjs ask
node scripts/client.mjs usage
node scripts/client.mjs topics
node scripts/client.mjs accounts
python3 scripts/sample.py stop
```

返回SSE accepted/queued/sources/delta/done；替身文本明确标注模拟，不是真实模型回答。`npm run sample:setup`只生成模拟资料和8小时的学生/教师/管理员JWT；JWT和签名密钥只在work/sample，过期可重跑，不覆盖已有样板配置。便捷Python启动/停止仅在本机macOS验证，其他系统可按.env.example设置环境变量后npm start（不会自动读.env）。

## 已实现

- jose校验签名、issuer、audience、exp和角色；IdentityResolver/CourseAuthorizer分别预留主系统身份和选课接口，默认拒绝无效凭据，不信X-User-Id或请求体身份。排队完成后再次核对课程授权。
- KnowledgeProvider检索接口和词项覆盖基线：只处理已批准、授权范围内资料；门槛不足不调用回答模型。它不是向量RAG或语义概率，真实课程阈值必须另行标定。
- DeepSeek Flash流式适配：固定官方域名、显式关闭thinking、限制输出、隔离不透明user_id、解析跨字节SSE、使用真实usage、保留实际模型标识。无无限重试/自动跨池重新生成。
- 学生问答、教师主题、管理员用量/账号状态分别鉴权；模型部署池区分student_qa/teacher_analytics/system_admin。当前教师统计直接查询计数，不调用LLM、不读取对话。
- RAM正文队列、单用户并发、账户共享并发组、多部署轮转、失败冷却、有界等待、取消传播。多Key不扩充同账户额度。
- SQLite元数据账本、原子额度预留/结算和幂等；断流/崩溃保留usage_unknown及费用预留；不做免费自动重试。估算不足则阻止相同定价版本继续调用。
- 余额查询按账户合并、并发查询合并、TTL缓存、预警/停止区分、余额未知时阻止真实生成。预算和预警参数只在受控配置文件设置，未开放远程修改。
- 不保存提问、回答、推理或问题向量；用户账本与无个人关联的月度主题计数分表；低频主题按配置隐藏。幂等只保存服务端HMAC，不保存可猜测的明文问题hash。数据库、WAL及日志无正文已做测试；上游供应商留存政策仍需单独确认。

## 当前容量证据及边界

需求更新为至少300个同时AI/API请求、500个同时系统用户，设计预留350生成槽/600排队槽（可配置，不是已获得的供应商额度）。

本机测试实际完成300个HTTP请求，替身上游峰值300；500个鉴权请求成功并同时保持500条已建立TCP连接。详情见verification容量JSON和验收记录。

测试把TCP握手按1条/10ms建立（不重试），不是300/500新连接在同一毫秒涌入的验收。较早不受控连接风暴出现ECONNRESET；本机kern.ipc.somaxconn=128，尚未对瞬间连接风暴给出根因/修复结论，没有改系统参数。本测试是本地HTTP+替身，不是DeepSeek实网、整站500人浏览/交作业、跨服务器高可用或生产压力验收。

当前运行器限制本机且拒绝NODE_ENV=production，SQLite文件强制单进程拥有。横向扩容需主系统/运维实现异步BillingStore（如PostgreSQL）及AdmissionScheduler（如Redis共享信号量），完成余额/未知费用对账、权限撤销和故障切换压测；不能复制本机进程即宣称高可用。

## 合并与配置

公共入口src/index.ts（build后dist/src/index.js及.d.ts）。主系统可注入IdentityResolver、CourseAuthorizer、KnowledgeProvider、BillingStore、AdmissionScheduler，再挂载createModuleApp；不导入本机server.ts。接口说明见MERGE_CONTRACT.md。原系统已有账号、学生班级/课程ID映射由主系统提供，不复制旧数据库。

要进行真实DeepSeek试调用，需要独立的deepseek模式配置、真实密钥环境变量、真实价格版本/币种、日/月预算/预留上限、余额阈值和已标定资料门槛，再显式设置AI_ENABLE_LIVE、AI_PROVIDER_POLICY_ACCEPTED、AI_RETRIEVAL_CALIBRATED。真实模式拒绝synthetic/mock/sample价格；便捷sample.py只允许mock。当前没有上传真实课程资料、调用付费模型或购买服务。

未经批准不把学生问题发送到第三方embedding/分类/追踪服务。生产资料检索器、文件上传解析/官方资料采集、参考书权限、语义阈值标定、真实额度/费用对账、自动未知账目结算均未完成。
