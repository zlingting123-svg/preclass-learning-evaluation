> 产品0.3已统一同步；下文为各阶段原始交付记录，其中“未同步GitHub”及发布目录仅描述当时状态。最新状态见[RELEASE_0.3.md](RELEASE_0.3.md)。

# 范围外简短回复（2026-10-29）

用户先提出独立AI判题，随后明确改为“维持现状，可以调低无关内容的回答内容量”。因此没有实现独立分类器、额外判题调用或双阶段计费，只收紧现有单次回答模型的提示词。

范围外问题要求一至两句简短说明课程范围，正文目标不超过80字，不加标题、列表、公式、学习计划或泛学科建议；不能先说无关又继续回答。泛问“线性代数怎么学”“计算机原理怎么学”不因此前讨论过环评就扩展放行；具体课程模型中的矩阵、回归等仍可讲解。课程问题和“总结一下”“大气的呢”等合理上下文追问保留原处理。

这是模型提示约束，不是独立审核或代码层硬字数上限，不承诺所有问题都稳定精确分类。没有减少正常课程问答的8192输出上限、180秒超时或上下文预算。

已构建AI模块并在服务器候选发布执行真实DeepSeek验证：

- 线性代数怎么学：正文28字，简短说明范围。
- 计算机原理怎么学：正文44字，简短说明范围。
- 水环境流程前文后追问“大气的呢”：正常给出大气评价流程与公式，未因缺少环境关键词而拒答。

三题实际POST模型请求计数为3，没有独立判题调用。测试使用独立内存模拟账号和班级，只在服务器内读取原加密Key，没有写入正式测试账号、课程或对话。估算本批费用5088micros=0.005088元，以供应商账单为准。证据brief-offtopic-smoke-result.json。

当前发布 `/opt/preclass/releases/20261029-brief-offtopic`；上一发布20261029-current-ui-only保留。仅覆盖ai-module/dist/src/deepseek.js及deepseek.d.ts，源文件仅ai-module/src/deepseek.ts。等待现有AI请求完成后重启后台，网关不重启。统一入口、旧版入口移除、账号删除、管理端密钥及其他设置不变。

切换前在线备份 `/var/backups/preclass/before-brief-offtopic.sqlite`，root0600。回退可切current回上一发布并重启preclass-test.service，不恢复业务库、不更改密钥。部署时初始打包误列不存在的.js.map，导致准备阶段停止；修正为实际2个运行文件，补齐manifest后续接，旧服务在验证完成前未切换。

交付brief-offtopic-runtime.tar.gz、source-change.tar.gz、manifest.json无真实Key或用户数据。脚本work/server-access/deploy-brief-offtopic.py、resume-brief-offtopic.py、brief-offtopic-smoke.mjs；远端对应/home/ubuntu。源码位置与之前隔离目录相同，尚未同步GitHub。不要恢复用户已撤回的独立判题计划。
