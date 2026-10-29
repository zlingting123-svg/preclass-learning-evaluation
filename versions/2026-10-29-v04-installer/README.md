# Ubuntu一键安装包版本

独立源码在source/，固定提交 `ddc55257eccf2aba137f4e38ce3f645393eb54a1`，不包含递归versions/或运行数据。安装器面向首次安装Ubuntu24.04 x86_64；包含应用产物、生产依赖、Node/Caddy和PDF wheel，基础OS依赖齐全时可离线安装应用。已有系统/配置/数据库拒绝覆盖，不是自动升级或卸载工具。

已在一次性Ubuntu VM验证真实systemd安装、管理员登录、重复安装拒绝、完整备份后服务恢复及独立数据恢复；CI记录见verification/。实际云主机、域名证书/备案和真实负载仍待验证。源内历史说明保留当时状态，最终结果以外层验证及根更新日志为准。

可用安装包由GitHub Actions构建，不将二进制依赖或任何运行数据库提交进Git源码。CI artifact保留30天，应另存到受控长期存储；本机下载位置见根目录最新一键安装包日志。

完成补记：安装包为preclass-ubuntu24-x64-ddc55257eccf.tar.gz，约66MiB，3329个包内记录。已下载到本机outputs/ubuntu-installer-20261029，压缩包和全部包内校验通过；校验值与CI结果在verification/。来源push CI运行40844018830，源码与本快照同为ddc5525。包和SHA文件上传到服务器后，解压到单独空文件夹，再执行sudo bash install.sh --domain 正式域名 --admin 管理员账号，终端输入密码。具体命令见包内README及本机安装步骤.md。
