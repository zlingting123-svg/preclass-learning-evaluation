# 中国大陆单机部署准备

状态：**尚未购买服务器，没有公网部署或正式二维码。** 本目录提供待上机验证的Ubuntu/systemd/Caddy方案；不会自动采购、创建云资源、修改本机防火墙或导入模拟账号。

## 建议购买配置（核对日期2026-10-29）

首选腾讯云轻量应用服务器，中国内地、4核8GB、10Mbps、SSD约120GB，Ubuntu 24.04 LTS x86-64纯净系统。地域选最靠近授课学生的内地地域，不选中国香港。一个实例、一个Node进程，AI使用同学接入的外部API，不购买GPU或在此机器运行大模型。

这是起始配置建议，不是300人压测结论。每期500人是总规模；300人集中提交须在真实服务器按真实业务窗口测试。低预算可先2核4GB开发验证，但本方案不把它当成300人正式验收配置。

价格证据：[腾讯官方套餐公告](https://cloud.tencent.com/document/product/1207/118332)列出的内地入门档4核8GB/120GB/10Mbps/每月1500GB流量为210元/月，按12个月算2520元，仅作预算基准；公告更新时间2025-04-29，**不是2026年的结算报价**。[当前官方活动页](https://cloud.tencent.com/act/pro/lighthouse)仍列4核8GB10M档，但活动资格、具体成交与续费需登录核对。不要把4核4GB3M的109元新客价当成4核8GB价格，也不拿第三方文章报价下单。

原一年约5000元总预算，应包含服务器、域名、独立备份、API及余量。先按服务器约2500–3000元/年、域名/备份/余量约300–500元预留，再将剩余部分用于API；这是预算分配建议，不是云厂商套餐或AI用量承诺。若订单接近耗尽总预算，先停下比价，不自动购买三年套餐/数据库/CDN。

阿里云ECS可作备选，同样选择4核8GB、5–10Mbps、SSD约100GB，按[官方购买页](https://www.aliyun.com/product/ecs)实际总价与续费比较；本轮没有取得可对该配置直接下单的阿里云含带宽年价，不编造对比数字。

## 备案与域名

大陆域名网站正式服务前需准备域名实名认证和ICP备案，按主体与接入商办理：[腾讯备案准备](https://cloud.tencent.cn/document/product/1207/45756)、[阿里备案说明](https://help.aliyun.com/zh/icp-filing/basic-icp-service/support/for-the-record-process-faq)。腾讯文档列轻量备案资源需包年包月购买至少90天且备案期间剩余至少30天；实际办理时再核对最新要求。学校教学用途先确认使用学校/单位主体还是个人主体；这影响材料，不由代码推定。

建议最终用稳定子域名，例如classroom.你的域名。域名、备案、DNS和HTTPS验证完成后再制作静态二维码。当前方案不以裸IP/临时局域网二维码当正式课堂入口。

## 部署结构

```text
用户 → 域名HTTPS:443 → Caddy → 127.0.0.1:3001 Node
                                    ├─ frontend/dist 静态资源与SPA
                                    └─ /var/lib/preclass/app.sqlite 持久数据
备份 → /var/backups/preclass（另需复制到独立云存储）
```

公网只开放80/443；SSH仅允许管理者来源IP，3001/5173不开放公网。Caddy负责HTTPS/压缩；Node仅绑定回环，校验正式Host与Origin，仅信任回环代理。保留单实例SQLite，不能直接用PM2 cluster或多机器共享这个数据库。此阶段AI仍503未接入，不启动旧评分worker。

## 已准备的文件

- `preclass.env.example`：单机生产环境模板，正式配置放/etc/preclass.env，0600，不进Git。
- `preclass.service`：非root用户运行、自动重启、代码只读、数据目录可写、启动前检查。
- `Caddyfile.example`：域名HTTPS反向代理。依据[官方安装](https://caddyserver.com/docs/install)与[代理文档](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy)。
- `preflight.mjs`：检查Linux/Node版本/普通用户、静态构建、可写数据目录及已创建的私密管理员；不运行模拟初始化。
- `preclass-backup.service` / `.timer` / `backup.mjs`：每日在线SQLite备份及完整性检查，不覆盖原库、不自动删除旧备份；未配置异机备份之前不能当灾备完成。
- `package.mjs`：从干净Git提交打包白名单源码与新构建的前端，带提交号/逐文件SHA256/压缩包SHA256；不含node_modules、运行库、账号口令或work。

本机打包（前后端依赖已安装、代码已提交后）：

```powershell
node deployment/package.mjs C:/你的交付目录
```

主入口仍为原核心业务+管理员；design-preview.html是独立设计预览，默认未作为生产构建入口。不要将未确认的外观替换主系统。

## 服务器拿到后的执行顺序（尚未在真实Ubuntu执行）

1. 提供厂商/地域/Ubuntu版本、公网IP、SSH用户名/端口及域名/备案状态；不在聊天发送密码或私钥。确认SSH可连接，再进行下列操作。
2. 安装项目兼容的Node24.15.0（<25）与Caddy官方包；Node的下载和校验文件取自[官方版本目录](https://nodejs.org/download/release/v24.15.0/)。模板假定node位于/usr/local/bin/node，若不同需先修改所有unit路径。不开自动curl管道运行第三方安装脚本。
3. 创建preclass系统用户（不用于SSH登录），建立/opt/preclass/releases、/var/lib/preclass、/var/backups/preclass，数据/备份目录仅preclass可写。数据库永远不放frontend/dist或release目录中。
4. 校验.tar.gz.sha256后解压到新的release目录，不覆盖旧版本；在Linux执行`npm --prefix backend ci`、`npm --prefix backend run check`、`npm --prefix backend run build`和`npm --prefix backend test`。前端dist已在包内；若重建，需frontend npm ci/build。Node依赖含SheetJS官方CDN地址，服务器必须能获取锁定依赖；不能改用未审计的旧版xlsx绕过网络失败。
5. 使用/opt/preclass/current符号链接指向新release。复制并编辑/etc/preclass.env：APP_ORIGIN为真实https域名且无尾斜杠，STATIC_DIR为current/frontend/dist，DB_PATH为独立固定路径；仅授予root与preclass访问。采用同一配置运行建号命令，不运行sample:seed，不复制本机测试数据库。
6. 通过现有backend管理命令安全创建管理员。例如在backend目录，用终端标准输入而非命令参数传密码：

```bash
read -rsp '新的管理员密码（至少12字符）: ' initial_admin_password; printf '\n'
printf '%s\n' "$initial_admin_password" | sudo -u preclass env USERNAME=course_admin DISPLAY_NAME=课程管理员 ROLE=admin /usr/local/bin/node --env-file=/etc/preclass.env dist/backend/src/manage.js user
unset initial_admin_password
```

7. 安装unit到/etc/systemd/system，核对权限及路径，再执行`systemd-analyze verify`、`systemctl daemon-reload`、`systemctl enable --now preclass`。先本机带Host验证：

```bash
curl -f -H 'Host: classroom.你的域名' http://127.0.0.1:3001/api/v1/health
```

8. 完成备案/DNS后，替换Caddy模板中的域名，先`caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile`，再加载服务；确认真实HTTPS证书、80→443和手机访问。不要直接开放Vite开发服务器。
9. 将Linux时区设为Asia/Shanghai后启用备份timer；执行一次backup service，并从副本做独立恢复验证。再配置经授权的异机对象存储/快照与费用提醒，不把同盘备份当灾难恢复。
10. 用真实设备、独立师生账号验证权限/提交/重启保留/密码重置；首次/主动改密和学生统一初始密码的正式使用策略还需确认。真实AI接入及300独立账号窗口压测仍未完成。

目前健康接口保留productionReady:false，表示正式上机、TLS、真实设备、业务/压力验收尚未完成；single-host模式能启动不等于这些验证已通过。

## 更新、回滚与恢复

发布前在线备份，保留旧release和数据库。停止preclass后，将current链接切回已验证旧release，再启动；操作前确认current确实是符号链接。涉及数据库格式变更时另做兼容审查，不直接强行回滚。

恢复数据时停服务，将已校验的备份复制为新的数据库文件，设置preclass所有权/0600并修改DB_PATH指向新文件，再启动验证。保留原数据库和WAL，不把备份直接覆盖到运行中的SQLite文件。备份JSON只报告路径与完整性，不打印用户答卷。

## 完成边界

本轮是配置选择、部署代码与本机测试准备。Windows本机没有systemd/Caddy，模板没有冒充已在大陆云端验证；不声称有公网网址、备案、证书、正式AI、真机或300人压测。费用、备案周期、云网络及实际容量需在购买/办理/上机时确认。

## 本机集成补记（2026-10-29）

当前组合包含 `file:../ai-module` 依赖：部署前先在 ai-module 执行 npm ci、npm run build，再安装构建 backend。发布包白名单已包含此模块；新组合尚未在Linux重新打包安装验收。前端现在构建两个入口，用户当前选择的学习空间为 `/design-preview.html`，根入口保留原核心业务。备份脚本只覆盖主数据库，另需安全备份数据库旁 ai/metadata.sqlite 和 fingerprint.secret；不得将它们放入公开源码或发布包。真实部署前必须完成组合验证及恢复演练。
