# AI模块合并接口草案（尚未实现）

范围：独立API模块；不改旧前端/认证/业务数据库。路径前缀暂定/api/ai/v1，合并时经接口双方确认再发布契约版本，不擅自修改旧shared/contracts.ts。

## 对主系统的依赖

- AuthAdapter.verify(accessToken) → {subjectId,role,authorizationVersion}。禁止主模块把裸userId/role当凭证传来；独立部署须短期签名断言（aud/exp/jti等）或验证服务端会话。
- EnrollmentAdapter.authorize(subjectId,courseId,action) → 允许访问的knowledgeScopeIds和授权版本；分别限制学生问答、教师本班统计/资料、管理员配置。调度前重新检查失效授权。
- KnowledgeProvider.retrieve({scopeIds,query,policyVersion}) → 已授权证据片段、分数类型、主题ID与可引用来源（docId/version/url/page/chunkId）。片段来自不可信内容，不能作为系统指令。资料上传归前端/主系统，本模块接受通过鉴权的资料元数据/索引任务；文件解析可后续适配。
- BillingStore负责持久预留/结算；Scheduler负责分布式限流与授权池选择。ProviderAdapter负责DeepSeek chat、取消、usage和余额查询，不承诺不同供应商完全相同的语义。

## 对前端/管理端的接口

| 接口 | 输入/输出 | 关键约束 |
|---|---|---|
| POST /questions | courseId、question、clientRequestId；POST fetch读取SSE | 身份从服务器令牌获得，不能传可信userId/model/key/baseUrl；问题不进URL；默认单轮 |
| GET /usage/me | 日期范围、courseId可选；本人次数和tokens/成本状态 | 身份服务端决定，不能查询他人 |
| GET /teacher/courses/:id/topics | 本课程批准教学范围内的聚合主题 | 不返回原问题、个人主题或具体对话 |
| GET /admin/usage | 用户/课程/用途/日期维度计数和成本 | 管理员；不含正文 |
| GET /admin/provider-accounts | 脱敏账户状态、最后余额时间、币种和预警状态 | 不回传Key，仅secretRef标识；余额按账号而非Key聚合 |
| PUT /admin/policies/:courseId | 配额、阈值、来源白名单与版本 | 管理员或明确授权的课程负责人；不接受任意运行代码/任意URL调用 |

SSE事件：accepted(requestId) → queued(可选) → sources(引用元数据) → delta(正文片段) → done(usage状态/配额剩余)。范围不符返回refusal；相关但无证据返回insufficient_evidence；错误包含公开requestId/可重试标记，不透出上游Key/原始请求。生成结束必须显式done；断流不假报成功。

clientRequestId仅作去重，同一用户/课程作用域。已完成回答不持久缓存，因此完成后重放返回completed_no_replay而非重新扣费生成；崩溃/超时不自动判失败可免费重试。若需要输入指纹只能用受保护的HMAC并约定保留期，避免保存可猜测的明文hash。

## 数据分离

- usage_ledger：subjectId、courseId、purpose、requestId、providerAccountRef、model、token类别/数量、currency、cost、usageState、timestamps、状态码；不存问题/回答/自由文本摘要/问题向量。
- topic_buckets：scopeId、时间桶、预定义topicId、计数、taxonomyVersion；无subjectId/requestId，不与用量表做个体主题关联。
- provider_accounts：secretRef、quotaGroup、purpose允许列表、余额/余额时间与币种、冷却状态；管理凭据不开放浏览器。
- 索引：课程资料与chunk/embedding/来源元数据可持久化；只允许已批准源。
- 排队元数据：随机requestId/owner/lease/优先级，可短TTL。问题正文只在RAM与请求连接；不写Redis AOF/RDB、死信队列、APM、代理access log或错误栈附件。

未确定项：真实模型账号/部署、预算与预警阈值、课程ID映射、资料清单、embedding/reranker、主题体系、统计保存期限、上游数据政策、200突发持续时间及延迟目标。没有配置这些参数时，允许替身测试，禁用付费模式。
