> 产品0.3已统一同步；下文为各阶段原始交付记录，其中“未同步GitHub”及发布目录仅描述当时状态。最新状态见[RELEASE_0.3.md](RELEASE_0.3.md)。

# 统一账号登录（2026-10-29）

用户要求取消服务管理专用入口，将管理员、教师、学生合并到同一登录页，字段统一叫“账号”。已实现并部署。

变更：学习空间PreviewLogin仅调用/api/v1/auth/login，去掉admin专用模式；登录页和教师侧边栏的“服务管理／专用账号入口”已移除；原内存路由/service-login重定向到/login，避免旧页面入口落空。账号/密码登录后，按后台返回的真实身份进入管理员、教师或学生空间，首登强制改密仍保留。管理员顶部“返回师生登录”改为“切换账号”，先退出并撤销原会话，再回统一登录。旧版LoginPage的字段也改为“账号”。

用户观察到普通入口可以登录管理员是原有后台设计：/auth/login本来就返回账号真实角色。没有把入口当作权限边界；未修改后台身份认证或管理权限。/auth/admin-login保留作旧客户端兼容，仍只允许管理员，不再用于新的网页登录。普通教师/学生不能因此访问管理接口，也不能在请求中自行声明管理员角色。

验证：

- 前端TypeScript/Vite生产构建通过。
- 独立内存数据库+实际HTTP/Chrome验证三类账号均由同一个登录页/接口登录并进入对应空间，专用入口不存在。
- 管理员切换账号后原令牌失效；师生管理接口返回403，伪造登录请求role=admin返回400；旧版登录页标签“账号”通过。
- 新页面实际发送3次/auth/login、0次/auth/admin-login。证据浏览器与权限验证.json与统一登录页.png。
- 上线后使用真实管理员账号从统一登录页进入管理空间，并检查加密Key管理页面正常、Key输入为空不回显。服务器统一登录页.png来自实际服务器。

当前发布：/opt/preclass/releases/20261029-unified-login，current已切换；上一版20261029-admin-api-vault保留。仅替换前端与原子切换current，网关已实际返回新前端hash；没有重启后台或网关，也未修改账号、权限、主密钥、Key或业务数据。

切换前在线备份：/var/backups/preclass/before-unified-login.sqlite，root0600。回退只需原子切换current回上一发布；不会恢复单独登录功能以外的业务设置，不要覆盖数据库或密钥。

源码变更：frontend/src/preview/main.tsx、frontend/src/pages/LoginPage.tsx；integration/test/admin-browser.mjs和core-browser.mjs同步更新标签选择器。交付source-changes.tar.gz含4文件，unified-login-frontend.tar.gz为前端运行产物，manifest.json是SHA256。无账号口令、Key、数据库或node_modules。原打包脚本的打印行残留“账号删除／六文件”字样，实际包内容是本段4个登录变更文件，以tar内容和manifest为准。

源码位置仍为work/deepseek-live-source/preclass-learning-evaluation-ddc55257eccf2aba137f4e38ce3f645393eb54a1；尚未同步GitHub。工作脚本work/patch-unified-login.py、test-unified-login.mjs、verify-unified-login-browser.mjs；远端部署脚本/home/ubuntu/deploy-unified-login.py，一次性勿重跑。

旧接续文件中的“点专用入口”“使用admin-login进行网页登录”等操作已过时。后续浏览器验证应直接在登录页填写“账号”和“密码”，不要再寻找已移除的入口。
