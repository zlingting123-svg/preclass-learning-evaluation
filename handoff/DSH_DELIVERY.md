# DSH 前端交付单

更新时间：2026-10-27（Asia/Shanghai）

## 交付版本

- 实际项目路径：`C:\Users\96496\Documents\Codex\2026-10-27\wo-2\outputs\课前问答项目\frontend`
- 分支/提交号：本轮未使用 Git（未初始化仓库、未提交）。
- 使用共享契约版本：**`0.1.1`**（`shared/contracts.ts`、`shared/API_CONTRACT.md`，由 Codex 维护；前端未修改）。已核对 v0.1.0 → v0.1.1 变化：新增 `ClassInfo.joinCode?: string`（仅所属教师返回），其余路径/字段未删改。
- 前端依赖锁定：React 18.3.1、react-router-dom 6.30.6、ECharts 5.6.0、Vite 5.4.21、TypeScript 5.6.3；Node v24.15.0、npm 11.12.1。

## 契约 v0.1.1 核对结果（本轮只读核对，未改源码）

- `ClassInfo.joinCode?`：前端**尚未展示/复制加入码**（见“已知问题”P1），mock 数据也未提供该字段；类型检查仍通过（字段为可选）。
- 后台端口：`integration/BACKEND_READY.md` 注明后台默认 `127.0.0.1:3001`；前端开发代理当前默认 `localhost:3000`（见 P2），待定点修复。
- 生产禁用 mock：前端 `config.ts` 对未设置 `VITE_API_MODE` 缺省回落 mock，尚无“生产禁用/缺配置报错”（见 P3）。

## 变更文件与页面路由

新增（全部在 `frontend/`，未改动 `backend/`、`shared/`、Codex 接续文件）：

- 工程：`package.json`、`package-lock.json`、`tsconfig*.json`、`vite.config.ts`、`index.html`、`.env`、`.env.example`、`.gitignore`
- 服务层：`src/services/`（api、apiTypes、httpApi、httpClient、authStore、apiError）
- 模拟层：`src/mocks/`（data、mockApi）
- 页面：`src/pages/`（登录、学生任务/答题/报告、教师概览/班级/编辑/提交列表/复核、状态演示）
- 组件与图表：`src/components/`（含 `ScoreChart.tsx`）
- 检查记录：`frontend/verification/2026-10-27_frontend_check.md`、`frontend/verification/2026-10-27_browser_check.md`、`frontend/verification/screenshots/`
- 说明：`frontend/README.md`

| 路由 | 页面 | 角色 |
|---|---|---|
| `/login` | 登录 | 公开 |
| `/demo/states` | 状态演示（仅 mock） | 公开 |
| `/student/assignments` | 学生任务列表 | 学生 |
| `/student/assignments/:id` | 学生答题（草稿/提交） | 学生 |
| `/student/report/:submissionId` | 学生个人报告 | 学生 |
| `/teacher/overview` | 教师班级概览 | 教师 |
| `/teacher/classes/:classId` | 班级作业列表 | 教师 |
| `/teacher/classes/:classId/assignments/new` | 新建作业 | 教师 |
| `/teacher/assignments/:id/edit` | 编辑/发布/关闭/绑定规则 | 教师 |
| `/teacher/assignments/:id/submissions` | 提交列表+汇总+导出 | 教师 |
| `/teacher/submissions/:id` | 评分复核 | 教师 |

## 启动、构建和配置（已实际验证）

```bash
cd frontend
npm install
npm run dev      # http://localhost:5173
npm run build    # tsc -b && vite build → dist/
npm run check    # tsc -b
npm run preview  # 预览 dist/
```

环境变量（仅公开配置，无密钥）：

- `VITE_API_MODE`：`mock`（默认）| `http`
- `VITE_API_BASE_URL`：http 模式基础地址，留空为同源 `/api/v1`
- `VITE_DEV_PROXY_TARGET`：开发代理目标，**待修正为 `http://127.0.0.1:3001`（当前默认 3000）**

开发代理见 `vite.config.ts`（`/api` → 目标端口）。生产构建只含公开配置。

## 已完成与未完成

**已完成（前端侧，mock 模式经浏览器验证）：** 学生登录/加入班级/任务列表/答题（草稿手动+防抖自动保存、幂等提交、只读）与报告；教师班级概览/作业编辑（草稿→发布→关闭、绑定规则）/提交列表与汇总/评分复核与导出；ECharts 条形图与雷达图；统一 mock/http service 与错误/状态处理；320/375/414/768 无横向溢出。

**未完成 / 待接入：** 教师加入码展示（P1）；代理端口 3001（P2）；生产禁用 mock（P3）；真实后台与云能力（Codex 负责）；真实设备与真机验证（需用户）。

## 模拟数据位置与演示标识

- 初始数据：`frontend/src/mocks/data.ts`；行为与内存状态：`frontend/src/mocks/mockApi.ts`。
- 演示账号（仅 mock）：`student`/`demo123`、`teacher`/`demo123`、`expired`/`demo123`（会话过期演示）。
- mock 模式全程显示“演示数据 / 尚未连接后台”横幅；所有维度/题目/评语均标注“演示”，非正式评价体系。

## 已执行检查与证据

1. 类型检查 `npm run check`：通过（含 v0.1.1 契约）。
2. 生产构建 `npm run build`：通过（ECharts 按需引入后 gzip 约 157 kB）。
3. 浏览器检查（Playwright + Chrome 无头，mock 模式）：**32/32 通过**。学生/教师核心操作、会话过期、320/375/414/768 无横向溢出均通过；截图在 `frontend/verification/screenshots/`。
4. 详见 `frontend/verification/2026-10-27_frontend_check.md` 与 `frontend/verification/2026-10-27_browser_check.md`。

**未执行（明确不视为通过）：** 真实设备浏览器、http 模式对接真实后台、300 人压测、像素级人工目视。

## 交给 Codex 的接口差异与建议

已按 `shared/API_CONTRACT.md` v0.1.1 核对，未发现字段删除/改名。以下为**待办与建议**：

1. **教师加入码展示（P1）**：需按 v0.1.1 展示/复制 `ClassInfo.joinCode`（仅教师可见）。DSH 将在收到缺陷清单后定点修复；mock 数据同步补 joinCode。
2. **开发代理端口（P2）**：统一为 `http://127.0.0.1:3001`，并建议固定 Vite 端口 5173（后台仅允许 5173/3001 的 loopback 来源）。
3. **生产禁用 mock（P3）**：http 模式配置缺失时明确报错，禁止静默回落 mock。
4. **学生任务列表“我的提交状态”批量接口（建议）**：当前列表只展示标题/截止时间，草稿/提交状态需进入答题页；如需列表级状态，可提供批量接口避免 N+1。
5. **导出接口**：前端从 `Content-Disposition` 解析文件名；请确认后台 CSV 编码（UTF-8 + BOM）与公式注入防护。

## 已知问题与对接下一步

- P1 加入码未展示、P2 端口 3000、P3 生产未禁用 mock、P4 缺少 favicon（404 噪音，次要）。复现/预期/实际/文件见 `frontend/verification/2026-10-27_browser_check.md`。
- 本轮按用户要求**暂停修改业务源码/依赖/配置**，上述 P1–P4 未改，待 Codex 缺陷清单后定点修复。
- Codex 应首先读取的 service 入口：`frontend/src/services/api.ts`（导出 `api`）与 `frontend/src/services/apiTypes.ts`（`FrontendApi` 接口）；http 适配在 `frontend/src/services/httpApi.ts`。

## 对接完成条件

本交付单已填实并含浏览器检查证据；代码可按上述命令启动/构建/类型检查；模拟与真实模式通过 `VITE_API_MODE` 切换（生产禁用 mock 待修）。请 Codex 按 `handoff/INTEGRATION.md` 完成前后端接入与验证。前端交付不代表全系统已上线。
