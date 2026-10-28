# GitHub同步交接

## 2026-10-28 接续

用户确认继续React/Node，Moodle PR #2（1422d90）作参考且未合并。原任务分支已上传d24aa96（批次前端集成及Windows CI）、39503bb（失败诊断）；PR #1标题/说明已更新，仍open/draft、未合并main。39503bb远端Actions运行40648068561完整通过后台22/HTTP21/配置3/mock。此前一次HTTP异常未复现，原因未定，历史结果保留在integration/verification/2026-10-28-cohorts-ci.md。

GitHub连接器可读、改PR返回403，使用本机GCM已有授权在内存更新相同仓库；后续Git传输连接重置，采用Git data API上传完全相同对象并验证blob/tree/commit SHA，远端父提交未变才force:false推进原任务分支。未改全局认证、仓库权限或同事分支，未记录凭据。最终文档提交及当前状态仍以实际HEAD与PR head核对。

## 最新同步：backend/oss-foundations（2026-10-27收尾）

- 任务分支：https://github.com/zlingting123-svg/preclass-learning-evaluation/tree/backend/oss-foundations
- 草稿PR：https://github.com/zlingting123-svg/preclass-learning-evaluation/pull/1，保持待审阅，main未合并。
- 代码提交：d01415d（开源复用）及a939ac9（受控批次/学号导入）；其后接续文档提交以远程分支最新HEAD为准。
- 本机用独立worktree工作，不覆盖原backend/cohorts-roster；同事前端业务源码未改。契约v0.2.0兼容旧客户端，新UI待适配。
- 验证：后台22项、smoke、前端18项HTTP和3项构建限制通过；许可证文本及模块调研已入库。未完成改密草稿已撤回，无未验证代码作为已完成交付。
- 未上传真实学生名单、口令、数据库或私密输出；云部署、正式评分、真机和300人仍未验证。CI尚未添加。

新对话从此任务分支读取CODEX_CONTINUE和BACKEND_DELIVERY；不要把下方历史main状态误认为已合并本轮功能。

日期：2026-10-27；协作方式：本机负责人和同事分别使用Codex，通过GitHub分支与PR交接。

## 仓库

- 公开地址：https://github.com/zlingting123-svg/preclass-learning-evaluation
- 克隆地址：https://github.com/zlingting123-svg/preclass-learning-evaluation.git
- 默认分支：main。
- 此记录随首次项目资料提交上传；实际同步状态以远程main、git status和本地HEAD/远程提交对比为准。

## 已整理

- 当前源码、锁文件、公开配置、方案HTML、历史资料、联调证据与截图。
- 本机Codex/同事Codex独立任务书，FRONTEND接续与交付单，GitHub分支/Fork/PR约定。
- 本地已初始化Git，连接origin/main；双方在独立任务分支工作，通过PR交接。
- 公开范围已获用户授权；不包含依赖缓存、构建产物、work、浏览器资料、本地数据库和私有环境配置。

## 账号与写入

仓库所有者为 `zlingting123-svg`。本机通过Git Credential Manager完成GitHub授权；凭据不放项目文件。另一台电脑需独立登录。任何人可读取/Fork；无主仓库写入权限的同事通过Fork和PR贡献。直接推送需要所有者添加协作者。不要向聊天、文档或Git提交访问令牌。

## 双方入口

- 本机：01_Codex任务书.md、handoff/CODEX_CONTINUE.md。
- 同事：02_Codex同事任务书.md、handoff/FRONTEND_CONTINUE.md和FRONTEND_DELIVERY.md。
- 协作方法：docs/双人协作说明.md。历史DSH文件保留，不作为当前职责或最新集成状态。

## 同步确认

在干净工作区fetch后，对比git rev-parse HEAD与origin/main，并检查git status。新任务从更新后的main建立独立分支，按模块修改并通过PR交接，不强推或覆盖另一人修改。长对话接续文件和代码一并提交分支。

## 新对话启动语

请先读取README、AGENTS、这份GITHUB_SYNC及本人任务书/接续文件，核对当前分支、实际代码、远程main和验证记录，再继续未完成任务。不要重建已有前端或后台，不上传数据库/密钥，不把GitHub同步当成教学系统云部署；正式评分、300独立账号、真机和一年云运维仍待完成。

## 最新资料同步（2026-10-27）

新加入课程规模/样题/教师权限/学号导入要求、原始画像Word及来源文本和数据草案。没有真实学生名单、回答或个人资料。新增功能仍待开发，参考要求见docs/需求。
