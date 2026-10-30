# AI鲸鱼伙伴纯模块一键安装包

此包**不包含、不覆盖、不修改网页、原有应用JS/CSS、后台、账号、数据库或服务器配置**。只安装一个ai-companion资源目录：独立ES模块、隔离样式与React运行时（已内嵌）、两张像素图和来源记录。无需服务器npm构建，也不依赖宿主页面使用React。

## 一键安装资源（此前Ubuntu安装结构）

下载同项目Releases的tar.gz与.sha256，先执行sha256sum -c 对应文件.tar.gz.sha256，再解压到单独空目录：

mkdir companion-module
tar -xzf 对应文件.tar.gz -C companion-module
sudo bash companion-module/install.sh check
sudo bash companion-module/install.sh install --dry-run
sudo bash companion-module/install.sh install

默认只写入/opt/preclass/current/frontend/dist/ai-companion。Python3已是此前部署的基础依赖；不改网页入口或重启服务。已有模块被人工修改时会拒绝替换；需要安装方评审后，用fingerprint子命令取得模块指纹，再通过--expected-current-sha256明确允许替换那个版本。

## 网页接入由服务器Codex完成

安装资源和接入业务是两步：安装器不猜测服务器已修改网页的DOM、路由或请求代码。**请将同包INTEGRATION.md一并交给服务器Codex**，由其在现有页面加入模块标签、主页激活事件和请求状态绑定，保留服务器上的全部网页改动。模块只提供形象动画与拖动，不提供形象设置界面，不读取聊天正文、不发起模型请求。

## 回滚

保留安装输出的backupId，执行：

sudo bash companion-module/install.sh rollback --backup-id 安装输出的backupId

只回滚模块资源。首次安装的回滚移除本次模块目录；覆盖安装则恢复此前模块。不会回滚任何网页或业务数据；接入标签由服务器Codex按自身代码管理。若模块安装后又被人工修改，回滚会拒绝覆盖。备份及回执位于frontend/.ai-companion-backups和.ai-companion-state-dist.json，均在公开dist之外。

## 本机安装

bash companion-module/install.sh install --target /项目绝对路径/frontend/public/ai-companion

本机网页通过PackagedCompanion适配器加载已安装的module.js，并将现有业务状态传入。安装包不携带该适配器或整站网页；适配器源码在项目库中供服务器Codex参考。

支持Ubuntu24.04/Linux与macOS的原子目录交换；其他文件系统不支持时提前拒绝。安装有完整校验、独占锁、模块备份、失败恢复和重复安装识别。已验证范围见更新日志；实际云服务器安装及业务接入由服务器Codex验证。
