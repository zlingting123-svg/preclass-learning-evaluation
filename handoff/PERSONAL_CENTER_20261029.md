> 产品0.3已统一同步；下文为各阶段原始交付记录，其中“未同步GitHub”及发布目录仅描述当时状态。最新状态见[RELEASE_0.3.md](RELEASE_0.3.md)。

# 个人中心（2026-10-29）

已实现并部署：点击侧栏底部头像/姓名进入个人中心，支持头像上传/移除、自用昵称与本人改密。学生、教师、管理员均可使用。昵称为空时自己的侧栏回退真实姓名；头像与昵称只改变本人的界面。真实姓名、账号与学号只读，教师名单、问卷统计、管理员账户列表和审计身份仍使用原学号/真实姓名。

隐私边界：新增personal_profile记录按认证用户ID保存nickname/avatarDataUrl/version；不修改User、Account.user、student_identity或共享对外身份类型。GET/PUT /api/v1/account/profile只操作当前登录用户，不接受目标userId或真实姓名等字段。管理/教师接口没有加入读取他人私有设置的路径。个人昵称和头像不随课程提问发送给模型。删除账号时同时清理该账号的私有个人设置。

头像：前端接受5MB内PNG/JPG/WebP，居中裁切128×128，输出PNG后再上传。后端仅接受有PNG签名/IHDR/IEND且宽高1–256像素、150KB以内的data URL，拒绝SVG、外部图片URL和越界数据。不存原始上传文件或EXIF，不使用公共头像URL。

保存采用expectedVersion并发校验，拒绝过期写入。密码复用已有/auth/password接口，要求当前密码、新密码与确认；保留至少12字符、最多72字节、与原密码不同等规则。改密成功会撤销旧会话，回统一账号登录页。初始密码强制改密流程保留，不能利用个人信息接口跳过。

界面：侧栏头像/姓名链接保留独立退出按钮；个人中心展示真实身份只读框、头像预览/移除、昵称表单和改密表单。管理员短屏侧栏增加滚动以保证底部入口可达。390像素手机布局无页面横向溢出；已查看桌面/手机截图并修正嵌入改密卡片的多余空白。

验证：

- 前后端构建通过。
- 后台个人资料、账号删除与账号开通回归共16项通过：本人读写、真实身份保护、越权字段拒绝、头像验证、版本冲突、教师/管理端身份保持、问卷统计保持真实姓名、改密撤销会话与新登录保留资料、账号删除清理。
- 独立内存数据库+真实HTTP/Chrome：学生上传头像并保存昵称，侧栏立即更新；教师名单/管理员列表仍显示0012345与模拟真实姓名，没有学生昵称；管理员可进入个人中心；本人改密后原令牌失效，新密码重新登录后头像/昵称保留；手机390布局通过。证据浏览器验证.json、个人中心桌面.png、个人中心手机.png。没有用真实学生账号或数据做这些写入测试。
- 上线后真实管理员从网站根地址登录并进入个人中心，检查真实姓名readOnly、昵称与头像表单、改密表单存在，再进入API管理检查加密Key正常。没有修改真实管理员或其他账号的资料/密码。

当前发布 `/opt/preclass/releases/20261029-personal-center`，current已切换。上一发布20261029-brief-offtopic保留。等候现有模型请求结束后重启后台，网关未重启。没有数据库表结构迁移；新设置沿用records表。原课程、问卷、真实身份、API密钥、范围外短回复规则与限额保持。

上线前在线备份 `/var/backups/preclass/before-personal-center.sqlite`，root0600，integrity_check=ok。回退可把current切回上一版并重启preclass-test.service；不恢复整库。新资料记录在旧UI中不显示但不会丢失；用户新密码仍有效，不通过回退代码撤销改密。

源文件9个：shared/personal.ts；backend/src/personal-profile.ts、app.ts、account-deletion.ts；backend/test/personal-profile.test.ts；frontend/src/pages/PersonalCenter.tsx、PasswordChangePage.tsx、frontend/src/preview/main.tsx、frontend/src/styles/personal.css。源码仍在work/deepseek-live-source/preclass-learning-evaluation-ddc55257eccf2aba137f4e38ce3f645393eb54a1。

交付source-changes.tar.gz、personal-center-runtime.tar.gz、manifest.json不含真实头像、昵称、口令、密钥、数据库或node_modules。截图与浏览器测试仅为模拟用户。新增第三方依赖为0；变更尚未同步GitHub。

工作脚本：work/package-personal-center.py、test-personal-center-browser.mjs、verify-personal-center-browser.mjs、work/server-access/deploy-personal-center.py。远端部署脚本在/home/ubuntu，使用一次性发布检查，勿直接重跑。
