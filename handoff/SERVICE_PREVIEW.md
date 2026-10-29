# 按用户截图接入服务管理

2026-10-29，工作区preclass-admin-preview，分支feature/service-admin-preview，精确基线3ffef2eb6a27c361e92d96de29797d27d35e6db3（其他工作者feature/admin-console，承接design/commercial-preview）。用户否定旧自制UI；preclass-ai-integration的ef9adb6已用4b7af6d撤回，旧工作区源码与5775779一致，账号/数据库保留。

本轮保留其他工作者preview.css、星形标识、深绿/三主题、两栏登录、pv-sidebar/topbar和师生工作台。管理登录复用PreviewLogin，仅右侧登录身份/提示切换；管理身份仍进入同一个Workspace，在内容区嵌入其他工作者AdminConsole的账户/审计能力与新增API/服务器/用量面板。不使用上轮pages/admin/AdminApp或PlatformTheme组件。主App/Layout/LoginPage保持基线，不将它们当本次目标。

后端保留原admin.ts及session_epoch认证方案；service-admin.ts只补API、服务器与AI用量接口，审计复用AdminService的at/actorName结构。复用此前AI引擎/权限/会话接口，但不覆盖独立AI交付PR #9。真实调用仍关闭，PG/Redis/真实模型/整站并发未验收。

最新验证：新工作区后台check/build、62/62测试与启动/登录/备份smoke通过。前端check/build、3项生产限制通过，AI模块check/build与18/18通过。CUA实际验证截图UI、学生与教师入口、管理员登录、账户搜索、API读取、服务器设置读取、教师被403拒绝。375 API/账户、320账户无整页横向溢出；内嵌浏览器截图viewport方法修正了native getScreenshot缩放伪影，DOM实际宽度一直正确。

运行：python3 integration/service-preview.py start（默认API3003/web5175）；正确页面http://127.0.0.1:5175/design-preview.html。停止同脚本stop，保留work。是独立模拟数据库，旧3002/5174数据未迁移或删除；新测试账号见backend/work/platform-sample/accounts.json、测试账号.txt；专用service_admin随机口令见同目录服务管理员账号.txt，禁止上传。新凭据与旧工作区可能不同。

本地已收尾：最后重新加载后浏览器warn/error为空，退出返回及用量/日志导航通过。工作日志为更新日志/2026-10-29-按截图纠正服务管理UI.md，完整说明docs/integration/2026-10-29-截图UI服务集成.md。当前尚未上传或合并远端。证据在仓库外../outputs/admin-correct-preview-20261029，不含凭据。不要将旧端口5174或旧自制UI再展示为本次成果。下一步接续先读本文件和用户截图、核对分支，而不是从旧接续里的管理界面继续。
