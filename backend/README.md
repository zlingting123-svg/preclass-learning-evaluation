# 后台：本地开发版 0.1.0

2026-10-28；共享契约v0.2.0，批次与受控名单CLI见ROSTER.md。本轮后台22项及smoke、前后端21项HTTP浏览器联调通过；云环境、正式评分模型、真机和300人压测未完成。服务拒绝production模式、未配置云适配器和非loopback地址。当前启动见../integration/LOCAL_RUN.md，最新证据见../integration/verification/2026-10-28-cohorts-ci.md；下方10项/18项等是基础阶段记录。

## 安装、检查、启动

在本目录执行；已验证Windows/PowerShell、Node v24.15.0、npm11.12.1。

```powershell
# 首次安装建议用锁文件；本轮实际安装为npm install --save-exact。
npm ci
npm run check
npm run build
npm test
npm run smoke
npm start
```

默认 `http://127.0.0.1:3001/api/v1`，GET /health为无认证诊断，productionReady始终false；业务接口需Bearer。开发可用 `npm run dev`。构建入口为dist/backend/src/server.js，共享模块输出dist/shared；shared/package.json的ESM标记不可丢失。

配置见.env.example，命令不自动加载.env；使用PowerShell环境变量或Node显式--env-file。默认数据库work/local.sqlite，不含预置账号、班级、题目或评分规则。

## 受控账号

```powershell
$env:USERNAME = 'teacher01'
$env:DISPLAY_NAME = '教师'
$env:ROLE = 'teacher' # 也可student或admin；admin暂无业务网页/旁路
$accountSecret = Read-Host '至少12字符且不超过72字节的口令' -AsSecureString
try {
  ConvertFrom-SecureString -SecureString $accountSecret -AsPlainText | npm run user:create
} finally {
  $accountSecret.Dispose()
  Remove-Item Env:USERNAME,Env:DISPLAY_NAME,Env:ROLE -ErrorAction SilentlyContinue
}
```

账号名为3–100位英文字母/数字/_.@-，bcrypt库验证口令。无注册和默认账号；口令从标准输入读入。管理命令已由smoke以随机模拟口令验证，上述交互仍需用户首次操作确认。真实数据库与备份由账号持有人保管，不交付学生资料。

## 功能及边界

- 本地bcrypt/数据库会话（8小时有效）、注销、教师/学生角色和班级/答卷权限。
- 班级创建/加入、教师可见joinCode，作业创建/编辑/发布/关闭，草稿版本冲突、完整提交和幂等回放。
- 答卷与评分任务同一SQLite事务保存；未配置规则时awaiting_rubric且报告null。
- 评分任务：持久租约30秒、防旧结果覆盖、单worker串行、10秒超时、最多3次尝试及退避、教师显式重试。
- 报告、概览/汇总、CSV转义及公式防护；复核保留原系统评分和审阅历史，不猜测总分。
- 在线备份API、独立恢复副本完整性检查已用模拟数据验证。

src/store.ts与src/auth.ts为本地适配边界。CloudBase未实现；SQLite分页前读取本地集合，登录限流为进程内IP计数，均不能推定生产性能/安全已验收。

src/worker.ts定义Scorer边界。npm run worker启动的是**未配置评分适配器**，任务有限重试后明确失败，不返回假分数。正式规则受控导入、规则计算/AI供应商、预算限额、真实模型及样本对照待实现。当前输出只接受维度分和null总分，聚合规则未实现。当前无prompt/模型调用，不能声称已验证prompt注入防御；后续适配须隔离材料、限制用量、校验输出并支持取消，取消信号不保证供应商不计费。

## 前端接入

Vite代理/api → http://127.0.0.1:3001，前端固定5173；后台仅允许5173/3001的loopback来源。默认VITE_API_MODE=http，base留空使用代理，失败不回退mock；令牌在内存。教师页面已展示/复制v0.1.1的joinCode。无规则显示“待配置评价体系”，规则列表目前为空。18项本地HTTP浏览器联调证据见../integration/verification/。

## 本地备份

```powershell
$env:BACKUP_PATH = 'work/backups/local-copy.sqlite'
npm run backup
Remove-Item Env:BACKUP_PATH
```

不要直接复制运行中的SQLite主文件。测试在独立路径打开恢复副本并核对答卷/报告及integrity_check。真正替换数据库前停止服务/worker、保留原库、验证新库后切换DB_PATH；本轮未替换真实库。自动定期备份、云恢复与一年后数据安排待配置。

验证详见verification/2026-10-27-local.md。10项业务测试与构建产物smoke已通过；模拟账号/材料/评分仅在测试，临时数据位于work/。未执行300独立账号云压测、正式模型、真机或正式联网验收。
