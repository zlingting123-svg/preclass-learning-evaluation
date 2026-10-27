# DSH接续任务记录

更新时间：2026-10-27（Asia/Shanghai）

## 记录信息

- 当前角色：DSH（前端）
- 项目路径：`C:\Users\96496\Documents\Codex\2026-10-27\wo-2\outputs\课前问答项目`
- 分支/提交号：本轮未使用 Git。
- 任务书版本 / 契约版本：任务框架 V0.1 / 共享契约 **v0.1.1**（Codex 已升级，新增 `ClassInfo.joinCode?`，仅所属教师返回）。
- 当前阶段：前端 D1–D5 完成并经浏览器验证后正式交付；已读 `integration/BACKEND_READY.md`。**Codex 已于 18:49 在 `integration/COMPATIBILITY.md` 注明接管必要的 frontend 集成修复（用户已授权），DSH 冻结源码、等待 Codex 集成结果，不再自行修复 P1–P4。**

## 目标与不能丢失的约束

用户一人推进，DSH 负责 `frontend/`，Codex 负责后台与集成。跨 Windows/Android/MagicOS/iOS 网页版，最多 300 人集中提交、一年运行、约 5000 元。首版文字问答、基础图表、教师复核，不做精细视觉。题目与正式评价体系待用户提供，前端只用“演示”标注占位数据。只改 frontend 与自己的接续/交付文件，不改 backend、shared 与 Codex 接续文件。模拟流程/截图/宽度检查不算正式联网、真机或 300 人压测通过。

## 已完成（内容—实际文件—验证证据）

- React+TS+Vite 独立工程及锁文件：`frontend/package.json`、`package-lock.json`、`vite.config.ts` 等。`npm run check`/`build` 通过（含 v0.1.1）。
- 统一 service 层（mock/http）：`src/services/*`；http 失败不回退模拟成功；令牌仅运行内存；401/403/409/429/5xx 处理。
- mock 数据与适配器：`src/mocks/*`，覆盖成功/空/无权限/过期/版本冲突/待配置/排队/失败/待复核。
- 学生端与教师端全部页面、ECharts 图表（条形/雷达，按需引入）。
- 浏览器检查（Playwright + Chrome 无头，mock 模式）**32/32 通过**：`frontend/verification/2026-10-27_browser_check.md`，截图 `frontend/verification/screenshots/`。
- 交付与检查记录：`frontend/verification/2026-10-27_frontend_check.md`、`handoff/DSH_DELIVERY.md`。

## 未完成 / 待验证 / 待修复

- P1 教师加入码未展示（契约 v0.1.1 新增 `joinCode`）；P2 代理端口仍默认 3000（应为 127.0.0.1:3001）；P3 生产未禁用 mock、缺配置未报错；P4 缺少 favicon。详见 `frontend/verification/2026-10-27_browser_check.md`。
- 真实设备 Windows/Android/MagicOS/iOS、http 模式对接真实后台、300 人压测：**未验证**。

## 当前文件与结构

优先读取：`AGENTS.md`、`02_DSH任务书.md`、`shared/API_CONTRACT.md`、`shared/contracts.ts`、`integration/BACKEND_READY.md`、本文件、`handoff/DSH_DELIVERY.md`、`frontend/README.md`、`frontend/verification/`。service 入口：`frontend/src/services/api.ts`；接口定义 `src/services/apiTypes.ts`；http 适配 `src/services/httpApi.ts`；mock `src/mocks/`。

## 已确认决定与接口变化

- 契约 v0.1.0 → v0.1.1：新增 `ClassInfo.joinCode?`（仅所属教师返回）；无字段删除/改名。前端类型检查已通过；加入码展示待定点修复（P1）。
- 后台端口 3001（`BACKEND_READY.md`）；建议 Vite 固定 5173、代理到 127.0.0.1:3001。
- 后台无默认账号，mock 账号不能登录后台；账号经 `user:create` 受控创建。
- 无规则提交成功但 `awaiting_rubric`、报告 null；规则列表当前为空，不生成假分。

## 如何安装、启动和验证

```bash
cd frontend
npm install
npm run dev      # http://localhost:5173
npm run build    # 类型检查 + 构建
npm run check    # 仅类型检查
```

环境变量：`VITE_API_MODE`（mock/http）、`VITE_API_BASE_URL`、`VITE_DEV_PROXY_TARGET`（待改为 127.0.0.1:3001）。演示账号 student/teacher/expired，密码 demo123。

## 最近执行的检查及结果

2026-10-27：`npm run check` 通过（含 v0.1.1）；`npm run build` 通过；Playwright+Chrome 无头浏览器检查 32/32 通过（学生/教师核心操作、会话过期、320/375/414/768 无横向溢出）。详见 `frontend/verification/`。真实设备与 http 对接未执行。

## 已知问题 / 阻塞 / 待用户提供

- P1–P4 见 `frontend/verification/2026-10-27_browser_check.md`；Codex 已在 `integration/COMPATIBILITY.md` 列表并标注“处理责任：Codex”，DSH 不再自行修复，避免与集成冲突。
- 待用户提供：真实题目、正式评分维度/权重/参考答案、配色偏好。
- 待 Codex：backend 接入、端口确认、云能力。

## 下一步：从这里继续

1. **等待 Codex 完成集成**：Codex 已接管 frontend 集成修复（joinCode、端口 3001、禁用 mock、分页、401、规则绑定、favicon 等），DSH 在此期间不改 `frontend/src`、依赖与配置，避免冲突。
2. 若 Codex 交回 DSH 负责的专项（如某页面/图表按新契约调整），再定点处理并重跑 `npm run check`/`build` 与浏览器检查。
3. Codex 集成完成、用户提供正式题目/评价体系后，按约定替换演示数据并参与真机验证。

## 不要重复或误做的事

- 不要覆盖已验证的 frontend 页面与 service；不要修改 backend/shared/Codex 接续文件；不要在根目录安装依赖。
- 不要把 mock 流程、截图、宽度检查写成正式联网、真机或 300 人压测通过。

## 另一工具的交接情况

已通过 `handoff/DSH_DELIVERY.md` 交付，并已读 `integration/BACKEND_READY.md`。`integration/COMPATIBILITY.md`（18:49）注明 Codex 已接管必要的 frontend 集成修复，缺陷清单已列（joinCode/端口/禁用mock/分页/401/规则绑定/favicon 等，处理责任均为 Codex）。DSH 冻结源码，等待 Codex 集成结果或交回的专项。

## 新对话启动语

```text
请读取本项目 AGENTS.md、02_DSH任务书.md、本接续记录、当前 shared 契约与 integration/BACKEND_READY.md、integration/COMPATIBILITY.md，核对实际 frontend 文件与 verification 记录，从“下一步”继续（等待 Codex 集成结果，不自行改源码）。不要覆盖 backend/shared 或从头重建已验证页面。按阶段更新接续 MD，配合 Codex 集成。
```
