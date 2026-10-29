# AI伙伴形象一键更新包

此包用于已经部署的学习空间：只更新完整静态网页和本地伙伴图片，不安装模型、Node或Python依赖，不改后台、数据库、课程文件、域名、systemd、环境变量和密钥。支持之前Ubuntu24.04一键部署结构，默认目标/opt/preclass/current/frontend/dist；本机macOS可指定--target验收。需要原有Python3，无须npm或联网安装依赖。

## 服务器安装（交给服务器Codex）

1. 从同项目Releases下载tar.gz及.sha256，放在同一目录，用sha256sum -c 对应.tar.gz.sha256校验。
2. mkdir companion-update，然后tar -xzf 对应.tar.gz -C companion-update。解压目录只放包内文件。
3. 执行sudo bash companion-update/install.sh check 校验完整包。
4. 执行sudo bash companion-update/install.sh install --dry-run，检查当前网页版本兼容与原子交换能力。
5. 执行sudo bash companion-update/install.sh install 完成更新，随后查看正式/design-preview.html并登录、提问和拖动验收。通常不需要重启Node或Caddy，刷新浏览器获取新入口。

安装前会验证当前网页完整指纹，支持原v04安装包内网页；对服务器Codex自改过的网页会拒绝覆盖。不要盲目强制安装。先比较服务器新增功能与本包源码，由安装者评审是否接受替换；评审后才可使用--expected-current-sha256 精确指定已确认的当前指纹（用fingerprint子命令获取）。本包替换整个frontend/dist，而非给任意版本注入一个脚本；相同后台契约下的既有网页功能随包保留。存在他人网页改动时应先合并后重建包。

包使用同文件系统原子目录交换；不支持该操作的文件系统会提前拒绝。更新有独占锁、完整网页备份、更新后校验，失败自动切回；保留旧指纹命名assets，方便已打开的页面继续取资源。运行中旧页面可能继续显示旧UI，刷新后查看新UI。

## 回滚

安装成功输出backupId。保留该值，执行：

sudo bash companion-update/install.sh rollback --backup-id 安装输出的backupId

回滚只恢复此前静态网页；不会回滚账号/作答/资料/模型配置。若安装后网页又被其他人更新，回滚会拒绝覆盖新工作。备份及回执在目标frontend目录下.companion-update-backups/与.companion-update-state.json，均位于公开dist之外；不要手动删旧备份后再要求回滚。

## 本机验收

bash companion-update/install.sh install --target /项目绝对路径/frontend/dist --dry-run
bash companion-update/install.sh install --target /项目绝对路径/frontend/dist

本机使用已安装dist的静态预览服务验收，不能只看Vite源码预览就声称安装包生效。截图/测试范围见更新日志。安装包只包含正式入口index.html/design-preview.html；开发期动作展示页不进入生产包。浏览器控制台没有形象设置面板，状态与拖动自动驱动动作。
