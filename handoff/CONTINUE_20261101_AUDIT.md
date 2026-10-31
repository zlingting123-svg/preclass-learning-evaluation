# 产品0.3接续：审计修复与快速签到

本次用户要求：先上传GitHub，再逐个优化审计问题；二维码在能签到成功的前提下尽可能快。审计先行上传已完成，7项问题修复、问卷草稿及自动备份已实施，快速二维码已部署。没有创建新聊天或新目标。

## 基线和版本

- 项目主目录仍为 `C:/Users/96496/Documents/Codex/2026-10-29/jie`。
- 本轮维护脚本、源码及测试在 `C:/Users/96496/Documents/Codex/2026-10-31/c-users-96496-documents-codex-2026/work/project-audit/`。
- 本轮交付在同目录的 `outputs/项目优化与快速签到-2026-11-01/`。
- current为 `/opt/preclass/releases/20261101-audit-fast-checkin-bound`，本轮优化前为 `20261031-rollcall-stage`，补充设备绑定前的中间版为`20261031-audit-fast-checkin`。不能以旧本地工程覆盖服务器。
- 新入口 `/assets/main-entry-audit-fix.js`，主脚本 `main-audit-fix.js`；点名/签到模块 `attendance-audit-fix.js/css`；问卷模块 `survey-draft-fix.js`。
- GitHub分支 `release/v0.3`。审计提交507d4c1，代码提交568df4d；最终部署同步提交以本目录GitHub同步记录和远端head为准。不强推、不擅自合并main。
- 产品0.3、契约0.5.0、productionReady=false；域名仍等待，不等于公网就绪。

## 快速二维码约定

新后端 `attendance-qr.js`：QR_INTERVAL_MS=2000，QR_VALID_MS=10000，SCAN_PROOF_MS=180000。票据版本q2，扫码凭证s3，HMAC签名和服务器时间校验。s3绑定当前浏览器HttpOnly/SameSite Cookie，HTTPS下使用Secure及__Host-前缀；转发凭证到无对应Cookie的浏览器会失败。教师状态返回16帧未来码，用独立组件更新画面，不让2秒换码触发整张拼图重绘。

`POST /api/v1/attendance/scan` 是刻意新增的匿名扫码校验接口，置于主站认证中间件之前；1200次/分钟/IP限制。只验证短期票据，返回sessionId/scanProof/expiresAt，没有名单、签到写入。`POST /core/attendance-checkin` 仍需已登录学生，只接受ticket或scanProof其中之一；班级/快照/场次校验不变。

扫码时先换取3分钟凭证，以容纳登录和首次改密。过期后重新扫码；不能宣传为本人到场证明。旧版本显示的30秒票据只在新进程启动的前30秒保留短暂兼容。

## 其他修复

Gateway在结算实际用量后、输出课程答案前重新授权；不能因为撤权把真实已调用费用退款。reference-ai调度system_admin，输出不超过Math.min(policy.maxOutputTokens,4096)。隐私过滤补全文件名/中英文页码和连续复制边界。章节编号仅唯一匹配，不放开常识或其他网站。

名单刷新串行，不让慢请求被下一次轮询持续作废。点名同一失败重试保留clientRequestId；配置变化或成功后才进入新的操作。

问卷新增 `PUT /core/surveys/:id/draft`，本人权限、expectedVersion、时限和只读状态均检查。最终提交有草稿时必须携带expectedDraftVersion，旧无草稿客户端可兼容。临时会话缓存按用户隔离，退出清除；发生版本冲突不自动覆盖其他页面的数据。

## 自动备份

- 脚本 `/opt/preclass/ops/automatic_backup.py`。
- 单元 `preclass-backup.service` 和 `preclass-backup.timer`，每日北京时间03:30加最多5分钟随机延迟，保留14份。
- 私有目录 `/var/backups/preclass/automatic`，只读SQLite备份API捕获WAL提交数据。systemd放行数据目录写权限用于SQLite共享内存协调，不使用immutable方式忽略WAL。
- 已有一次成功备份：146文件、15库、约207MB；校验和、隔离文件恢复及数据库完整性通过。无已验证异机副本，未做整站启动恢复。
- 不把私有备份、env、真实课件、账本原始数据或凭据写入GitHub/交接。

## 验证与回退

隔离内存库、合成资料与模拟模型服务测试17组通过；浏览器7组通过；正式资源HTTP哈希与服务健康通过。最终正式资源浏览器验证结果见交付JSON。真实付费模型调用0，手机真机扫码待验收。

后台代码安全重启，相对本轮开始应用包累计改8文件、加6文件、3685保持，无SQL迁移；Caddy、图谱服务保持。整轮回退审查后切20261031-rollcall-stage并重启主站，不恢复整库。不要长期回退到未绑定浏览器的中间版本。备份timer独立于主站release。

## 后续边界

本轮仍为受控编译补丁，不宣称全站TypeScript迁移完成。域名/HTTPS、真机扫码、真实模型校准、异机备份和整站恢复演练未完成；会话不过期配置未改。用户要求中文简洁、独立判断，已授权工作不要重复确认。

SSH沿用既有server-access目录材料与严格主机校验，不打印认证内容。详细历史参照原 `新窗口接续任务-2026-10-31.md`，其中旧current和512输出上限已被本次现场记录替代；当前输出管理值8192，本轮未调整该用户设置。
