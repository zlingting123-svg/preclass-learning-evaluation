> 产品0.3已统一同步；下文为各阶段原始交付记录，其中“未同步GitHub”及发布目录仅描述当时状态。最新状态见[RELEASE_0.3.md](RELEASE_0.3.md)。

# 移除废案入口（2026-10-29）

用户明确将旧版作为废案，要求去掉“返回当前版本”。已移除登录页该链接及师生顶部“当前版本”链接，保留管理员“切换账号”。网站根地址 `/` 和原 `/design-preview.html` 现在均使用选定的学习空间UI，避免其他地址落回旧方案。

旧App源码保留历史参考。仅在显式本地开发测试 `DEV && VITE_LEGACY_UI=true` 时可运行旧界面，生产构建会移除此分支和旧App导入；没有新增生产旧版入口。原两个历史浏览器脚本显式打开该测试开关；新增portable selected-ui-browser.mjs并加入CI，验证真正选定的生产入口/角色路由。没有伪称已在远端跑完整CI。

验证：生产构建通过；生产产物中搜索“返回当前版本”“当前版本 ↗”及旧登录页独有文案均无命中；当前学习空间三角色浏览器、管理员退出/身份隔离、伪造角色拒绝、根地址登录页面验证通过。证据浏览器与权限验证.json。线上另核对根页面和preview页面实际HTML与新发布文件一致，并用真实管理员通过根地址登录、进入API管理，已验证加密Key页面仍正常。

当前发布 `/opt/preclass/releases/20261029-current-ui-only`，上一发布20261029-unified-login保留。前端采用干净dist，旧发布复制的dist在新发布中移至frontend/dist-before-current-ui，不处于Web根目录；新dist不再提供旧散列包。仅原子切换current，没有重启后台/网关，没有修改账号、问卷、Key或其他业务数据。

回退可切回上一发布；不需恢复数据库。切换前只读在线备份 `/var/backups/preclass/before-current-ui-only.sqlite`，root0600。加密主密钥与Key配置不变，仍只在服务器私密文件和加密记录中。

源码变更共6文件：frontend/src/main.tsx、frontend/src/preview/main.tsx、integration/test/core-browser.mjs、admin-browser.mjs、selected-ui-browser.mjs、.github/workflows/verify.yml。运行包current-ui-only-frontend.tar.gz，源文件包source-changes.tar.gz，manifest.json提供SHA256；不含密钥、数据库、node_modules或真实用户数据。隔离源码位置不变，代码仍未同步GitHub。

部署脚本work/server-access/deploy-current-ui-only.py；本地验证work/test-selected-ui-only.mjs、verify-current-ui-only-browser.mjs；仓库新增测试integration/test/selected-ui-browser.mjs。部署脚本一次性，勿直接重跑。今后正式入口可直接使用http://127.0.0.1:5173/（仍依赖SSH隧道），不再要求用户选择版本。
