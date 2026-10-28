# 课前问答与学习评价系统

公开仓库：https://github.com/zlingting123-svg/preclass-learning-evaluation

两位开发者分别使用Codex，通过GitHub同步代码与接续记录。最多300人同时使用并集中提交，运行一年，经费约5000元，目标Windows/Android/MagicOS/iOS浏览器。

## Moodle最小样板（2026-10-27任务分支）

[Moodle样板启动说明](moodle-sample/README.md)：实际Moodle5.3+、中文界面、两班模拟权限、画像草稿和原生文字作业。当前基于尚未合并的`backend/oss-foundations@4e15d02` / 契约0.2.0新增独立目录，原React/Node业务源码未修改。先读[最新接续](handoff/CODEX_CONTINUE.md)顶部；下文v0.1.1与验证记录保留为原集成历史。

本机运行`python3 moodle-sample/scripts/sample.py start`，师生随机口令只在本地work/private。此样板仅模拟数据，不是云端或正式评分系统。见[本轮验证](moodle-sample/verification/2026-10-27-local.md)。

## 当前进度

当前任务分支为 React/TypeScript 前端、Node/TypeScript 后台、SQLite 本地集成版，契约 v0.2.0；支持受控批次/学号导入 CLI、教师批次筛选及按批次建班、学生跨期任务筛选。2026-10-28 本机重新通过后台22项、HTTP浏览器21项、生产配置3项及显式mock冒烟。CI工作流已加入，远端执行状态另见验证记录。**这些是本地软件检查，不是正式云部署、真实评分、300人或真机通过。** 用户已确认继续React/Node，独立Moodle样板只作参考。

尚待完成：用户提供真实问题与评价体系，正式规则/模型适配与评分对照，云认证/存储/HTTPS，300独立账号集中提交，真实设备、云备份及一年运行安排。

## 从这里开始

- [本机Codex任务书](01_Codex任务书.md)：后台、共享契约和统一集成。
- [同事Codex任务书](02_Codex同事任务书.md)：前端维护、图表和跨设备体验。
- [双人协作说明](docs/双人协作说明.md)：分支、Fork、PR和职责边界。
- [本地启动](integration/LOCAL_RUN.md)：实际环境、账号和命令。
- [当前集成证据](integration/verification/2026-10-28-cohorts-ci.md)；[历史集成记录](integration/verification/2026-10-27-integration.md)。
- [共享接口](shared/API_CONTRACT.md)与[数据类型](shared/contracts.ts)。
- [方案展示HTML](docs/项目方案.html)：下载后在浏览器打开，仅为方案展示。

## 本机负责人启动语

```text
请在本仓库目录读取AGENTS.md、01_Codex任务书.md、handoff/CODEX_CONTINUE.md、当前shared和integration验证，再核对实际代码。已有本地HTTP集成，不从头重写。你负责后台、共享契约和最终集成，同事Codex在另一电脑负责前端。按阶段更新接续文件，通过任务分支和PR交接。
```

## 同事启动语

```text
请在克隆的本仓库目录读取AGENTS.md、02_Codex同事任务书.md、docs/双人协作说明.md、handoff/FRONTEND_CONTINUE.md、CODEX_CONTINUE和当前shared契约。已有前端和本地集成，请核对现状后继续，不重建。主要负责frontend和自己的接续/交付文件，其他修改先提出建议。任务分支完成后向原仓库main提PR。
```

## 目录

| 路径 | 用途/维护者 |
|---|---|
| frontend/ | 前端；同事Codex |
| backend/ | 后台；本机Codex |
| shared/ | 当前契约；本机Codex统一维护 |
| integration/ | 本地接入、测试脚本和已有证据 |
| handoff/CODEX_CONTINUE.md | 本机接续；读完核对实际文件 |
| handoff/FRONTEND_CONTINUE.md | 同事前端接续 |
| handoff/FRONTEND_DELIVERY.md | 同事PR交付单 |
| handoff/DSH_*.md、docs/history/ | 历史记录；不作为当前分工或最新状态 |
| docs/项目方案.html | 更新分工后的方案展示，不是教学应用 |

## 安装和运行

环境以各package.json和integration/LOCAL_RUN.md为准，当前记录使用Node24.15.0。前后端分别npm ci，不能在根目录安装；依赖由锁文件重建。先构建backend，再分别启动backend和frontend，访问本机127.0.0.1:5173（API3001）。没有默认真实账号，按backend/README受控创建。

每位开发者的本地数据库单独保存在work中，不通过GitHub同步。真实共享教学数据要等云部署，不是靠推送代码同步学生答卷。生产构建禁用mock；显式演示模式仍保留演示标识。

## 公开仓库协作

任何人可读取、下载和Fork；直接推送主仓库仍需写入权限。同事没有权限时，Fork后在任务分支修改并提PR。日常不直接改main，不强推，不提交本地数据库、真实学生资料、密钥、口令、令牌或个人.env配置。

对话接近上下文上限时主动写接续MD；准确用量可见时约70%提前保存，否则按阶段/约10次实质操作保存。代码和接续一起提交，供下一对话和另一台电脑继续。

本仓库尚未配置自动部署或强制分支保护。仓库公开不代表项目已上线，也不自动授予第三方额外的软件许可；如需特定开源许可证，由项目负责人另行确定。

## 最新课程要求（2026-10-27）

课程为**环境评价与管理**。每年2–5月500人、11月至次年1月500人，每人每期4次作业，计划全年4000份提交；每期7位教师，仅查看自己班级，按学号导入学生。另附18题课前画像问卷。

- [课程、样题和教学安排](docs/需求/课程与教学安排.md)
- [原始画像问题Word](docs/资料/课前学生画像问题清单.docx)与[提取文本](docs/需求/课前学生画像问题清单_原文.md)
- [新增需求与双方分工](docs/需求/新增需求待开发清单.md)

这些是已记录的新需求，尚未实现。当前契约v0.1.1未变；每期500人为总规模，300并发目标是否需提高另行确认。真实学号名单和学生回答不得提交公开仓库。
