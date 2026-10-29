> 产品0.3已统一同步；下文为各阶段原始交付记录，其中“未同步GitHub”及发布目录仅描述当时状态。最新状态见[RELEASE_0.3.md](RELEASE_0.3.md)。

# 2026-10-29 修复进展

本轮授权：继续问卷未完成验证；解决关键词误拒答/上下文追问、教师问答、多班成员查看、Markdown/LaTeX显示。用户要求允许模型按语义判断合理性。

问卷发布反馈已部署，已验证学生可见。新增功能源码、服务器部署与真实模型样例验证均已完成：

- 真实模式无资料时移除关键词和硬编码特定问法的拦截，用同一次付费模型生成按课程语义和前文判断；无关请求仍由模型说明范围。不会额外调用分类模型。
- 历史保留最近最多6轮，在字节预算内截取过长回答，不再因一条长回答超限而丢弃整轮。服务输入预算待扩大到32000字节，费用预留同步计算。
- 教师可在有权限的班级创建自己的私人对话；不能读取学生对话。教师账本purpose=teacher_qa，不计入学生主题统计，共用现有问答池与全站预算。
- 成员页明确班级选择器、标题人数和班级列，切换时清空旧名单并检查请求有效期；不混班。
- react-markdown/remark-gfm/remark-math/rehype-katex/KaTeX渲染，跳过原始HTML、不加载图片，KaTeX trust=false。锁定KaTeX0.19.1并覆盖旧传递依赖，npm audit生产依赖0漏洞。复制保留原始文本。

已验证：三模块构建；后台84/84；AI模块19/19；独立内存数据库+真实HTTP/Chrome浏览器验证名单分班、教师问答、私人对话隔离、Markdown/公式/表格显示及不执行HTML、复制原文、追问传递历史、学生预习问题进入模型。浏览器上游为替身，不将此等同于真实模型语义验证。证据在本目录，测试脚本work/test-chat-features.mjs。

最新本地源码仍为 work/deepseek-live-source/preclass-learning-evaluation-ddc55257eccf2aba137f4e38ce3f645393eb54a1。源码尚未同步GitHub。以下为最终部署结果。

## 部署和真实验证

当前发布目录 `/opt/preclass/releases/20261029-ai-context-teacher-math`，`/opt/preclass/current` 已切换。三模块构建通过，正式服务与网关均健康。仅使用原有 SSH 私有调试入口，没有开放公网端口。

上线前使用独立内存模拟账户、班级、真实 DeepSeek 上游验证6例：水环境评价基本流程→“大气的呢？”（传入2条历史）→“总结一下”（传入4条历史）；教师问“大气污染评价中的高斯方程是什么”；学生问课程预习；明显无关的游戏出装。前5例正常回答；游戏请求由模型解释不属于课程范围。每次只调用一次模型，没有额外分类调用。记录见 `live-context-smoke-result.json`，保守估算本批总费用0.016086元，实际以供应商账单为准。这些是小样例验证，不是教学有效性或所有语义分类准确率证明。

已增加输入预算至32000字节，最近历史最多6轮/24000字节，传入时还根据当前问题长度预留空间；超长历史显式标记截取。管理配置保留输出8192、超时180000ms和用户原有预算/次数/账户配置。最坏费用预留自动重算，不是每次实际扣费。

切换后真实管理员HTTP与浏览器检查模式deepseek、余额状态ok、8192输出与180秒超时，详见 `context-deployment-verified.json`。真实用户账号、已发布问卷、资料、对话和密钥均未被测试覆盖；测试全在内存中。此次更新会重启后台，因此用户需刷新重新登录。旧拒答消息不会被自动重写，需要重新提问。

## 文件与回退

- 运行补丁：chat-features-runtime.tar.gz，120个运行文件，manifest.json记录逐文件SHA256；包含数学渲染字体与生产依赖许可证说明。
- 源码补丁：source-changes.tar.gz，21个变更文件，涵盖之前补丁和本轮功能，包含前端package.json与lockfile。无node_modules、真实Key、业务数据库或学生资料。
- 部署脚本：本地work/server-access/deploy-context-features.py、live-context-smoke.mjs；远端对应/home/ubuntu文件。一次性脚本会拒绝覆盖发布，不直接重跑。
- 上线前数据库在线备份：/var/backups/preclass/before-context-features.sqlite，root0600，integrity_check=ok。
- 旧配置备份：/etc/preclass/deepseek-private-test.before-context.json，root0600；当前无密钥配置仍为/etc/preclass/deepseek-private-test.json。Key仍仅在/etc/preclass-deepseek.env，root0600。
- 回退时先等待正在运行的AI调用结束，将current切回 `/opt/preclass/releases/ddc55257eccf-deepseek-20261029-reservefix-8192-general-publish`；同时恢复上述旧配置文件，再重启preclass-test.service与preclass-test-web.service。不恢复业务数据库，不丢弃新对话或计费元数据。旧版本会再限制教师对话及关键词，故仅用于故障回退。

仍未完成的是正式课程检索校准、正式域名/HTTPS上线、异机自动备份、真实整站并发验收；本轮功能不等于这些事项已完成。当前retrievalCalibrated=false，私有开发测试开关保留。新源码还未同步GitHub，不能把原安装包或原PR称为已包含这些修改。

新对话先读取本记录及 `../DeepSeek真实接入/接入记录与接续.md`，核对服务器发布路径和实际源文件后继续。不要要求用户再次发送Key，不读取或输出真实学生对话正文。
