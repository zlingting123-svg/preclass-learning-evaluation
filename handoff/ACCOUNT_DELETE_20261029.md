> 产品0.3已统一同步；下文为各阶段原始交付记录，其中“未同步GitHub”及发布目录仅描述当时状态。最新状态见[RELEASE_0.3.md](RELEASE_0.3.md)。

# 账号删除功能（2026-10-29）

已实现并部署：管理员登录服务管理→账户管理→账号行“删除账号”→显示账号/姓名/关联数量与保留范围的二次确认弹窗。取消时不发送DELETE、不修改账号；确认后才删除。管理员及当前登录账号的删除按钮禁用，后台也禁止删除管理员。

删除范围：移除account、user和对应student_identity，撤销原登录，移出该学生的班级关系，解除该教师的任课/批次授权。若删除班级主教师，优先选择已有其他任课教师为主教师；没有则保留班级并置为待分配。其他教师和学生的关联不删除。

保留范围：班级、问卷、历史答卷/作业、学习记录、私人AI对话、计费与审计记录不级联删除。此功能用于删除登录账号，不是清空测试教学数据或抹除全部个人历史。界面确认弹窗明确说明此范围。重新创建同名账号会生成新userId，不能继承旧账号的访问或旧历史。

后台接口：

- POST /api/v1/admin/users/:id/delete-preview，body={}。仅管理员，可生成5分钟有效、绑定操作者/目标/版本/关联概况的确认计划，返回planId和公开账号信息及数量，不返回密码哈希或教学正文。
- DELETE /api/v1/admin/users/:id，body={planId,expectedVersion,confirmUsername}。重新校验管理员身份、目标角色、计划归属、有效期、账号版本、用户名和关联概况；未预览、过期、他人计划或记录变更会拒绝，需要重新核对。
- 删除在同步SQLite事务中执行，故障回滚包括账号、班级关系、会话epoch、审计和确认计划；删除成功会消费该账号全部旧确认计划。账号正在生成AI回答时禁止删除，避免中断/迟到结果。

验证：

1. 后台定向测试共12项通过，含5个新增子场景和真实HTTP两步删除；覆盖师生无权、管理员保护、错误确认、其他管理员盗用计划、过期/版本变化、AI忙、模拟故障回滚、旧登录失效、同名重建隔离、教师关系清理和历史保留。
2. 后台和前端构建通过。
3. 独立内存数据库+实际HTTP/Vite/Chrome验证：取消保留账号且DELETE次数0；二次确认后DELETE次数1，账号从数据库和列表移除；管理员按钮禁用。证据浏览器验证.json及两张截图。
4. 部署后实际管理网页检查删除按钮存在、管理员按钮禁用；实际HTTP检查管理员删除预览被403保护。没有对服务器现有师生账号执行删除，也没有插入或删除真实测试账号。
5. 上线后真实AI模式、32000字节输入、8192输出、180000ms超时与余额状态ok保持，证据account-delete-deployment-verified.json。本次没有额外真实模型生成调用。

发布路径：/opt/preclass/releases/20261029-account-delete，current已切换。上一版/opt/preclass/releases/20261029-ai-context-teacher-math保留。上线前在线数据库备份/var/backups/preclass/before-account-delete-feature.sqlite，root0600，integrity_check=ok。仅增加功能，没有由脚本删除现有账号。

本次新变更：backend/src/account-deletion.ts、backend/src/admin.ts、backend/test/account-deletion.test.ts、frontend/src/pages/AdminPage.tsx、frontend/src/pages/admin.css、frontend/src/preview/ServicePanels.tsx。隔离源码仍在本机work/deepseek-live-source/preclass-learning-evaluation-ddc55257eccf2aba137f4e38ce3f645393eb54a1。

交付：source-changes.tar.gz（6个源文件）、account-delete-runtime.tar.gz（编译后后台/前端及字体/许可证）、manifest.json。无密钥、node_modules、真实数据库或学生资料。变更尚未同步GitHub。

部署脚本：work/server-access/deploy-account-delete.py；验证脚本：work/test-account-deletion-browser.mjs、work/server-access/verify-account-delete.py和verify-account-delete-browser.mjs。远端对应文件在/home/ubuntu。部署脚本一次性，拒绝覆盖已有发布，勿直接重跑。

回退代码可把current原子切回上一发布后重启后台和网关；不需要改AI环境文件或配置。不能通过回退代码恢复已经由管理员确认删除的账号；历史答卷/对话本来就保留。不要盲目恢复整个业务库以撤销单个账号删除，避免覆盖其他用户的新数据。

新对话继续时先核对本记录、服务器current与源码。真实账号删除必须由用户在界面核对并二次确认；不要依据名称包含“测试”就批量代删。
