> **2026-10-29集中名单与首次改密本地完成。** feature/admin-roster-onboarding基于a8f7e6e，契约0.5.0。管理员统一导入学生学号/姓名/班级，按教学分组分班，一键创建；初始密码管理员输入/生成且不存明文，新建/重置师生首次必须改密，成功后全部旧令牌失效。教师旧名单写入/自建班级HTTP关闭，只能选托管班级并只读名单。用户明确同班允许多位教师，class_teacher链接参与统一classAccess，不抢占旧主教师。重复导入不重置旧密码、不移除旧成员，身份冲突整批拒绝。
>
> 后台70/70、check/build与smoke通过；前端check/build/3生产限制通过，CI浏览器脚本改写后仅语法检查。CUA实际CSV3人2班建号、教师A/B共享一班、名单无导入控件、新学生强制改密页、无表头保留3行首行通过；完整改密由HTTP测试执行，未在浏览器提交。实际stop/start后共享关系和mustChangePassword保留，初始会话业务403。375改密/教师选择/管理员导入、320教师选择无整页溢出，浏览器日志空。旧演示账号不变；新测试账号00990101等初始口令仅work/platform-sample/名单导入测试账号.txt，不上传。
>
> 继续用python3 integration/service-preview.py start（3003/5175），正确入口/design-preview.html。本轮源码/日志已在本地，尚未上传；不改独立AI PR #9。新记录类型managed_class/class_teacher/admin_roster_plan/admin_roster_receipt，旧数据库自动兼容，保留原数据与权限。预备班级teacherId为空字符串，首位教师作兼容字段，实际共享权限看关系。完整操作/API/测试边界见docs/integration/2026-10-29-管理员名单与多教师班级.md及本轮更新日志。截图在../outputs/roster-onboarding-20261029；真实名单/口令/数据库禁止上传。未测真实手机、生产、多副本/整站并发、500实际建号负载。


# 按用户截图接入服务管理

2026-10-29，工作区preclass-admin-preview，分支feature/service-admin-preview，精确基线3ffef2eb6a27c361e92d96de29797d27d35e6db3（其他工作者feature/admin-console，承接design/commercial-preview）。用户否定旧自制UI；preclass-ai-integration的ef9adb6已用4b7af6d撤回，旧工作区源码与5775779一致，账号/数据库保留。

本轮保留其他工作者preview.css、星形标识、深绿/三主题、两栏登录、pv-sidebar/topbar和师生工作台。管理登录复用PreviewLogin，仅右侧登录身份/提示切换；管理身份仍进入同一个Workspace，在内容区嵌入其他工作者AdminConsole的账户/审计能力与新增API/服务器/用量面板。不使用上轮pages/admin/AdminApp或PlatformTheme组件。主App/Layout/LoginPage保持基线，不将它们当本次目标。

后端保留原admin.ts及session_epoch认证方案；service-admin.ts只补API、服务器与AI用量接口，审计复用AdminService的at/actorName结构。复用此前AI引擎/权限/会话接口，但不覆盖独立AI交付PR #9。真实调用仍关闭，PG/Redis/真实模型/整站并发未验收。

最新验证：新工作区后台check/build、62/62测试与启动/登录/备份smoke通过。前端check/build、3项生产限制通过，AI模块check/build与18/18通过。CUA实际验证截图UI、学生与教师入口、管理员登录、账户搜索、API读取、服务器设置读取、教师被403拒绝。375 API/账户、320账户无整页横向溢出；内嵌浏览器截图viewport方法修正了native getScreenshot缩放伪影，DOM实际宽度一直正确。

运行：python3 integration/service-preview.py start（默认API3003/web5175）；正确页面http://127.0.0.1:5175/design-preview.html。停止同脚本stop，保留work。是独立模拟数据库，旧3002/5174数据未迁移或删除；新测试账号见backend/work/platform-sample/accounts.json、测试账号.txt；专用service_admin随机口令见同目录服务管理员账号.txt，禁止上传。新凭据与旧工作区可能不同。

本地已收尾：最后重新加载后浏览器warn/error为空，退出返回及用量/日志导航通过。工作日志为更新日志/2026-10-29-按截图纠正服务管理UI.md，完整说明docs/integration/2026-10-29-截图UI服务集成.md。当前尚未上传或合并远端。证据在仓库外../outputs/admin-correct-preview-20261029，不含凭据。不要将旧端口5174或旧自制UI再展示为本次成果。下一步接续先读本文件和用户截图、核对分支，而不是从旧接续里的管理界面继续。
