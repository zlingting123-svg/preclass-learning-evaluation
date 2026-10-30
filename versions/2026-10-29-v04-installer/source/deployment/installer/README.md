# 课堂系统 Ubuntu 一键安装包

仅支持全新的 Ubuntu24.04 x86_64（amd64）服务器。包含构建好的网页/后台、生产Node依赖、Node24运行程序、Caddy及PDF解析Python wheel。基础OS仍需Python3、python3-venv、ca-certificates、libstdc++6、libatomic1、curl和systemd；缺项时默认通过Ubuntu apt安装。已预装这些系统包时可加--offline，应用依赖与pypdf无需服务器从npm/PyPI下载。并非包含整个操作系统的完全离线镜像。

先从可信项目发布/CI下载tar.gz与sha256文件，在同目录执行 `sha256sum -c *.tar.gz.sha256`，再解压到空文件夹。可以先运行 `bash install.sh --check` 核对包内哈希。

首次安装示例：

```
sudo bash install.sh --domain classroom.你的域名 --admin course_admin
```

域名参数需使用小写ASCII或punycode，不带https://、端口或路径。安装会安全提示输入两次初始密码（至少12字符且不超过72字节），不将明文密码放入参数、日志或口令文件。请提前完成域名解析、必要的备案及80/443防火墙配置；程序不会替你办理或创建这些资源。

安装会创建专用服务账号、私有数据目录，安装应用/HTTPS网关/完整备份定时任务；Node/Caddy位于/opt/preclass/runtime，不覆盖系统Node或既有Caddy程序。正式配置为/etc/preclass.env，root权限0600。代码、运行程序和current链接由root管理；应用以preclass用户运行，网关以preclass-web运行。AI/搜索默认关闭，后续再配置验证。

`--no-start`仅安装配置并启用开机启动，不立即启动服务，适合上机前人工检查；不需要开机启动时自行disable相应unit。`--password-stdin`仅供安全密码管理器/测试经标准输入传入，不要把真实密码写在命令行或脚本中。

安装时如发现现有current、配置或数据库，会拒绝覆盖。这是首次安装器，不提供一键升级或卸载数据；失败时会保留已创建文件供诊断，不自动删除数据库。升级前须完整备份，使用单独审核的更新流程。

检查命令：`systemctl status preclass preclass-caddy`；日志：`journalctl -u preclass -u preclass-caddy`。HTTPS签发需要真实域名可达，服务启动不等于证书或公网已经验收。

完整备份每日定时执行，会在备份期间暂停应用，耗时取决于资料量；请在非教学时段安排。备份目录/var/backups/preclass由root保管，另需异机副本。包内没有实际账号、数据库、上传资料或API密钥，也不提供已验证的300人公网负载承诺。
