# 前端检查记录

更新时间：2026-10-27（Asia/Shanghai）
执行环境：Windows，Node v24.15.0，npm 11.12.1
工作目录：`frontend/`

> 以下只记录**实际执行并通过**的检查。浏览器真实交互、真机、http 模式对接真实后台均未在本轮执行，明确标记为“待验证”，不写成通过。

## 已执行并通过的检查

### 1. 类型检查

命令：`npm run check`（即 `tsc -b`）
结果：**通过**（无错误）。共享契约 `shared/contracts.ts` 通过 `@shared` 别名被前端引用，类型一致。

### 2. 生产构建

命令：`npm run build`（`tsc -b && vite build`）
结果：**通过**。产物：

| 分片 | 大小 | gzip |
|---|---|---|
| index（应用代码） | 58.9 kB | 19.4 kB |
| react（React + router） | 163.9 kB | 53.4 kB |
| echarts（按需引入） | 467.4 kB | 156.7 kB |
| CSS | 6.0 kB | 1.8 kB |

ECharts 使用 `echarts/core` 按需引入（BarChart/RadarChart + 必要组件），本地打包、不依赖 CDN。

### 3. 开发服务器冒烟测试

命令：`npm run dev`（后台启动），随后请求：
- `GET /` → HTTP 200（返回 index.html）
- `GET /src/main.tsx` → HTTP 200（模块正常转换）
- `GET /@fs/.../shared/contracts.ts` → HTTP 200（`@shared` 别名在开发态可解析）

结果：**通过**，开发服务器 259ms 就绪，无报错。

### 4. 关键契约行为（代码级核对）

| 检查项 | 证据位置 | 结果 |
|---|---|---|
| 提交使用 `Idempotency-Key` 请求头 | `src/services/httpClient.ts:25`、`StudentAnswerPage` 复用同一幂等键 | 已实现 |
| 409 版本冲突不静默覆盖 | `mockApi.ts:88`、答题/编辑/复核页均处理 `VERSION_CONFLICT` 并提示刷新 | 已实现 |
| 401 会话失效统一跳转登录 | `authStore.notifyUnauthorized`、`httpClient.ts:57`、`App.tsx` AuthBridge | 已实现 |
| mock 模式持续演示标识 | `DemoBanner.tsx`（“演示数据 / 尚未连接后台”） | 已实现 |
| http 模式失败不回退模拟成功 | `api.ts`/`httpClient.ts` 抛出 `ApiError`，无静默回退 | 已实现 |
| 图表 NaN 防护（无维度/满分无效显示空态） | `ScoreChart.tsx:21`、`format.ts:54` | 已实现 |
| 令牌仅存运行内存 | `authStore.ts`（模块变量，刷新即失效） | 已实现 |
| 无评分规则显示“待配置评价体系” | `StudentReportPage`/`SCORING_STATUS_LABEL` | 已实现 |

## 待验证（本轮未执行，需后续完成）

- [ ] 浏览器真实交互：登录、学生答题草稿/提交、教师创建/发布/复核、导出下载等逐页点击验证（无浏览器自动化工具，未执行）。
- [ ] 桌面与 320/375/414/768 宽度布局实际目视检查（需真机/浏览器）。
- [ ] http 模式对接真实后台（依赖 Codex 完成 backend 与部署，未执行）。
- [ ] Windows / Android / MagicOS / iOS 真机浏览器验证（需用户参与）。

以上未完成项照实记录；完成口径为“前端已按契约开发、检查有记录、等待/配合 Codex 接入”，而非“联网系统已完成”。
