# GitHub同步交接

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
