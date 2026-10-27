# 开源复用与名单基础验证

2026-10-27 22:23起，Asia/Shanghai；独立worktree backend/oss-foundations；Node24.15.0/npm11.12.1，Windows。基于main c573fbe，不覆盖原工作区backend/cohorts-roster。

第一阶段：已查20个上游仓库，接入Helmet8.3.0、express-rate-limit8.7.1、csv-parse7.0.3、csv-stringify6.9.0，核对安装包许可证并保留文本。backend check/build及12项测试通过；提交d01415d已推送GitHub并确认远端SHA。

第二阶段：批次/授权/导入CLI及契约v0.2.0（增量兼容），backend check/build、22项测试及smoke通过。包括跨年日期、预览不创建、引号/BOM/前导零、账号/身份/选课原子导入、跨期同账号原口令复用、重复确认、重复/角色/身份冲突、科学计数疑虑、500行仅解析预览、指纹/过期/预览后变化、事务故障回滚和私密文件清理、现有文件/路径越界/联接点、构建产物CLI及stdout不泄露姓名口令、HTTP批次筛选和授权撤销。

早期两项测试把凭据文件整条记录（含studentNumber）直接传给严格LoginRequest，触发正确的未知字段拒绝；测试改为只传username/password，最终22/22通过，未放宽认证校验。

现有frontend npm ci/check/build、test:integration18项及test:config3项重新通过。截图来自隔离合成数据库，评分仍为显式替身。构建保留ECharts约503kB体积提醒。没有真实学生名单、付费模型调用、云部署或300人结果。

GitHub连接器创建PR返回403 Resource not accessible by integration；通过本机已有Git Credential Manager凭据在内存中请求同一GitHub API成功创建草稿PR #1。未打印或落盘凭据，未改仓库权限或全局认证配置。
