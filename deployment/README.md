> 当前产品版本0.3已有私有服务器部署，经SSH隧道访问；正式公网域名/HTTPS、检索校准与完整生产备份仍待验收。下文“尚未购买”等为原方案阶段，最新状态见[0.3进度](../docs/项目进度-0.3.md)。旧安装器仍对应原固定提交。

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

## 2026-10-29 服务器适配（取代前文相应旧说明）

- Caddy单次请求上限改为8MB，允许4MiB分块；这是每块上限，不是整份PDF大小。根网址跳转到已选学习空间 `/design-preview.html`。模板使用官方Caddy标准发行版，已验证版本2.11.7；[request_body文档](https://caddyserver.com/docs/caddyfile/directives/request_body)中的相关功能需要兼容版本，安装后必须执行caddy validate。
- 正式HTTP请求超时默认120秒，可通过HTTP_REQUEST_TIMEOUT_MS设为30000至300000毫秒，只针对单个分块请求；解析后台任务有自己的超时。应用仍只监听回环地址。
- Python使用独立环境：`python3 -m venv /opt/preclass/python`，然后 `/opt/preclass/python/bin/pip install -r /opt/preclass/current/backend/scripts/requirements.txt`；REFERENCE_PYTHON指向该环境。预检检查pypdf、学习空间构建文件及数据目录可写性。不要把本机Python环境复制到Linux。
- 应用数据保留在DB_PATH旁的reference-files/和ai/，部署时为preclass用户准备0700数据目录；预检拒绝这些目录使用符号链接。代码与Python环境由root管理并保持应用用户不可写，应用仍以preclass用户运行。默认AI_MODE=disabled，实际模型、搜索密钥和AI预读留待配置验收。
- preclass-backup.service现以root执行受控backup-full.sh：先停止preclass服务，生成一致的主库、资料原件/解析文件、AI用量库与指纹密钥备份，再恢复原先运行的服务。每日timer会造成备份期间停服（耗时取决于资料量），应调整到非教学时段；备份失败会返回失败，脚本仍尝试恢复服务。只有root应能修改/切换 /opt/preclass/current、其发布代码、脚本及 /etc/preclass.env，防止应用用户修改被root执行的内容。
- 完整备份目录包含manifest.json及各文件SHA-256。用 `node deployment/verify-backup.mjs /var/backups/preclass/某个备份目录` 验证，能识别缺失、额外文件、符号链接和篡改。恢复时先停服务，核验后复制到新的独立私有数据目录，将主库/资料/AI目录的属主设为preclass，再调整DB_PATH，保留旧数据用于回退。备份含密钥和个人数据，禁止放入公开目录或仓库，并需配置受控异机副本。
- `node deployment/backup.mjs` 的默认行为仍为仅主库在线备份，兼容旧工具；它不等同于完整资料备份。FULL_BACKUP=1只允许由已停止应用的完整备份流程使用。
- 发布包包含AI模块、Python脚本/依赖清单、两个前端入口及部署工具；不含versions历史快照、运行资料、数据库或密钥。安装顺序依然为ai-module npm ci/build，再backend npm ci/build，再前端构建（若包内已有dist可不重建）。从原始根目录的干净提交运行打包工具，不能在历史快照子目录直接打包。
- 新增Ubuntu24.04 CI任务，执行后台回归、Python依赖、非root预检、备份/恢复校验、发布包构建、Caddy配置与实际代理分块上传。本机仅有macOS验证，不冒充systemd、Linux云主机、真实域名或证书验收。

### 适配验证补记

整合头0f3ba94的Ubuntu24.04 CI和Windows完整检查均已通过，覆盖Python环境、非root预检、备份完整性/损坏检测、干净发布包和实际Caddy4MiB代理上传。记录见云服务器版本适配日志及v03/verification/。本机独立解包安装构建也通过。正式服务器仍须验证systemd真实生命周期、域名/TLS和实际负载。

部署时 `/var/backups/preclass` 的属主设为root、权限0700；应用preclass用户不应拥有删除备份权限。完整备份由root单元执行；数据目录 `/var/lib/preclass` 由preclass拥有。应另存异机副本。

## 一键安装包（构建和测试流程）

`deployment/build-installer.mjs`只允许在Linux x64构建，使用已构建程序和官方Node运行程序、哈希验证的Caddy，重装生产依赖并下载PDF wheel，将其制成独立tar.gz安装包；不把macOS依赖直接复制到Linux。`deployment/installer/README.md`说明目标Ubuntu24.04 x86_64、一次安装步骤和基础OS依赖。

安装器是首次安装器：遇到已有配置、数据库或current会拒绝覆盖；不自动升级或删除数据。管理员初始密码只经交互终端/标准输入，不保存明文。系统基础依赖缺项时可从Ubuntu apt安装；应用依赖及pypdf已包含，基础OS依赖齐全时可用--offline。不是包含整个操作系统的完全离线镜像。

Node/Caddy在/opt/preclass/runtime内私有安装，不替换系统程序。安装器创建preclass/preclass-web账号、root管理的代码和配置，部署应用、HTTPS网关及完整备份服务，默认关闭AI/搜索。域名解析、备案、防火墙和真实HTTPS签发仍需服务器外部准备。下载包应先核对可信来源的sha256再解压执行。

新增ubuntu-installer CI任务，在一次性Ubuntu VM上打包并测试真实systemd安装、管理员登录、拒绝覆盖、停服备份后重启和恢复副本，再上传tar.gz及校验文件为GitHub Actions artifact（保留30天）。只在测试完成后提供包，实际结果见最新日志；本地macOS只做脚本、完整性及原备份回归，不冒充Linux安装验证。

### 安装包下载索引

首次安装优先查看[安装包总目录](../installers/README.md)及[v04步骤](../installers/2026-10-29-v04/README.md)。已验收二进制由同项目Releases提供，标签installer-v04-20261029；源码和数据隔离说明不变，已有系统不得用首次安装器覆盖。

