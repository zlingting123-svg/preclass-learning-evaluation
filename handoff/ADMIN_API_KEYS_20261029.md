> 产品0.3已统一同步；下文为各阶段原始交付记录，其中“未同步GitHub”及发布目录仅描述当时状态。最新状态见[RELEASE_0.3.md](RELEASE_0.3.md)。

# 管理端API密钥配置（2026-10-29）

用户要求直接在管理员网页配置/更换Key，并按不同AI功能分别管理。代码、服务器部署、现有Key迁移及真实模型验证均已完成。

已实现：管理端密码框只写不回显、留空保留原Key；Key与配置同步事务保存，失败回滚；AES-256-GCM加密数据库存储，32字节主密钥独立于数据库，随机12字节nonce、16字节tag、部署ID作AAD。读取/审计/用量接口不返回Key。兼容旧环境变量Key，管理端Key优先，移除配置会删除对应密文。

学生/教师问答可分别绑定Key和并发池；教师无专用池时兼容共用学生池。按用途调度，学生排队不阻塞独立教师池；同账户共享并发组和全站预算。问卷生成、教师统计和系统管理仍是预留，UI明确标注，保存Key不启用尚未实现的功能。

已验证：三模块构建；后台93/93；AI模块20/20；浏览器管理端录入两个不同替身Key，学生/教师真实HTTP问答分别用对应Key，输入清空且响应不回显。后端验证Key轮换、只改一个不影响另一个、持久化故障回滚、重启后不依赖原环境Key、篡改/错误主密钥解密失败、权限与用途隔离。浏览器功能测试上游为替身；另已执行下方服务器真实模型验证。

加密主密钥仅在服务器自动生成并以root0600保存；迁移原服务Key时只在服务器内存处理，不传回聊天/本地。源码尚未推送GitHub。

## 实际部署与验证

- 当前发布：`/opt/preclass/releases/20261029-admin-api-vault`，current已切换；上一发布`20261029-account-delete`保留。
- 主密钥文件：`/etc/preclass-vault.env`，root0600，由systemd drop-in `/etc/systemd/system/preclass-test.service.d/vault.conf`加载。只记录变量名AI_SECRET_MASTER_KEY，任何交付不得含其值。主密钥不在业务数据库；今后备份/迁移包含密文的数据库时必须另行安全保管该文件，否则无法恢复管理端保存的Key。
- 现有1个部署Key已迁移到ai_provider_credential密文记录，原环境文件保留作回退。Key读取优先级：本次提交的新值→管理端加密存储→旧环境变量。
- 真实验证：从服务器密文读取原Key，仅复制到独立内存模拟数据库，删除测试进程的旧Key环境变量后，通过实际DeepSeek调用成功。deepseek-flash，输入319、输出30 tokens，completed，按保守价格估算878micros=0.000878元。正式业务数据库未插入测试教师/学生/班级。证据live-vault-smoke.mjs.result.json。
- 在服务器内比较原Key与应用数据库/当前WAL，未发现原Key明文。未把Key或数据库下载到本地。
- 上线后真实HTTP验证storageReady=true、全部现有凭据source=managed，余额ok，8192输出/180秒超时/32000字节输入保持。用户当前选择的次数与预算“不限制”也保持，没有改回旧默认限额。证据api-vault-deployment-verified.json。
- 上线后Chrome管理员页面验证新Key密码输入框存在且值为空，显示“API Key已加密保存”，截图服务器管理端密钥配置.png已查看。

## 保存与路由行为

PUT /api/v1/admin/api在原配置与expectedVersion之外可带credentialUpdates:[{deploymentId,apiKey}]，仅管理员可写。同一部署不得重复提交更新；ID必须属于本次部署配置。未提交/空白Key保持现有值；新配置须提供可用Key。Key与设置、审计在同一个SQLite事务中保存，不把Key混入ai_admin_settings或日志；审计仅记录api.configure。

修改配置仍要求没有排队或调用中的请求。保存成功后更新运行时提供商、用途路由并清空旧余额缓存，后续请求生效，重启后解密恢复。移除池会清理索引中对应密文。教师专用池存在时不会悄悄转到学生池；没有专用池时保留共用行为。问卷生成等预留目的不可由浏览器直接指定来绕过角色和班级权限。

后台93项测试包含之前的账号删除、会话隔离和课程权限回归；AI模块20项包括新的功能池排队隔离。用途路由使用既有单进程调度器，不能据此声称多实例或整站300人已验收。

## 文件和回退

运行包admin-api-vault-runtime.tar.gz含118个运行文件及第三方许可证，manifest.json逐文件SHA256；source-changes.tar.gz含13个本轮修改文件。无主密钥、提供商Key、node_modules或真实用户数据。源码仍在本地work/deepseek-live-source/preclass-learning-evaluation-ddc55257eccf2aba137f4e38ce3f645393eb54a1。

主要变更：backend/src/credential-vault.ts、ai.ts、admin-settings.ts、service-admin.ts；shared/admin.ts；ai-module/src/contracts.ts/config.ts/scheduler.ts/gateway.ts/balance.ts；frontend/src/preview/ServicePanels.tsx；对应managed-credentials和purpose-routing测试。

切换前在线备份：`/var/backups/preclass/before-admin-api-vault.sqlite`，root0600，integrity_check=ok。首次部署脚本因复制的发布已有deployment目录而在迁移前停止，原服务未切换；后续resume脚本验证阶段文件SHA256并复用原备份和主密钥，成功迁移。不要重跑最初脚本生成新主密钥。

脚本：work/server-access/deploy-api-vault.py、resume-api-vault.py、migrate-api-vault.mjs、live-vault-smoke.mjs、verify-api-vault.py；本地浏览器work/test-managed-key-browser.mjs、verify-vault-browser.mjs。远端验证结果在/home/ubuntu，本地仅下载不含秘密的结果JSON。

紧急回退应先等待AI请求结束，切回上一发布并停用vault.conf后daemon-reload/重启。刚迁移时原环境Key与原用途配置均保留，可以回退；如果管理员之后已新增管理端Key或teacher_qa等新用途，旧版本不能解释它们，不能直接切回旧代码或盲目恢复整库，需要先制定兼容配置回退方案。不要删除主密钥或密文以“修复”启动。

仍为私有调试，没有新增公网端口、正式域名/HTTPS上线或检索校准。本轮未实现问卷AI生成、教师AI统计、系统AI管理，页面已标预留。新对话先核对本记录、服务器current、root主密钥文件是否存在及配置元数据；不要读取/输出主密钥或要求用户把Key发到聊天。
