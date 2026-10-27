# 前端（DSH开发，Codex集成修复）

课前问答与学习评价系统的网页前端：教师端、学生端、报告图表与跨设备布局。
独立 npm 包；公共类型直接引用 `../shared/contracts.ts`（v0.1.1）。2026-10-27已接入本地HTTP后台，18项浏览器联调通过，非云端上线或300人压测。最新启动和验证说明见 `../integration/LOCAL_RUN.md`、`../integration/verification/2026-10-27-integration.md`。DSH交付单记录的是集成前版本，后续修复以此处及Codex记录为准。

## 技术基线（已在本机实际安装锁定）

- Node.js `v24.15.0`，npm `11.12.1`
- React `18.3.1`、react-router-dom `7.18.4`、ECharts `6.1.0`（按需引入，本地打包，不依赖 CDN）
- Vite `7.3.7`、React插件 `5.1.1`、TypeScript `5.6.3`；Playwright-core `1.64.1`用于本机浏览器验证（不下载浏览器）
- 锁文件：`package-lock.json`（与 backend 各自独立，不在根目录建 workspaces）

## 安装 / 启动 / 构建 / 检查

以下命令均在 `frontend/` 目录执行（已实际验证）：

```bash
npm install        # 安装依赖（生成/更新 package-lock.json）
npm run dev        # 真实HTTP模式；固定 http://127.0.0.1:5173，代理到127.0.0.1:3001
npm run dev:mock   # 显式演示模式，有持续横幅；不能用于生产构建
npm run build      # 类型检查(tsc -b) + 生产构建到 dist/
npm run check      # 仅类型检查（tsc -b）
npm run preview    # 预览 dist/ 构建产物
npm run test:integration # 需先在backend构建；自动启停隔离后台/前端，18项真实HTTP浏览器检查
npm run test:config      # 需先build；验证生产禁mock/非法配置及无模拟登录数据
npm run test:mock        # 显式mock独立冒烟，不能当作HTTP或上线证据
```

## 环境变量（仅公开配置，禁止写入任何密钥）

| 变量 | 取值 | 说明 |
|---|---|---|
| `VITE_API_MODE` | `http`（默认）\| `mock` | 生产构建只允许http；mock仅显式开发演示 |
| `VITE_API_BASE_URL` | 空或 URL | http 模式接口基础地址；留空表示同源 `/api/v1`（经开发代理） |
| `VITE_DEV_PROXY_TARGET` | URL | 开发代理目标默认 `http://127.0.0.1:3001` |

参考 `.env.example`。生产构建只包含公开配置；云密钥/模型密钥/数据库凭证一律由后台管理。

## 目录结构

```
frontend/
├─ src/
│  ├─ services/        统一数据访问层：api.ts(入口)、apiTypes.ts(接口)、httpApi.ts、httpClient.ts、authStore.ts、apiError.ts
│  ├─ mocks/           模拟数据与 mock 适配器：data.ts、mockApi.ts
│  ├─ pages/           页面：LoginPage、student/、teacher/、DemoStatesPage
│  ├─ components/      通用组件：Layout、DemoBanner、ui、ScoreChart、ScoreSection、ReportDetail
│  ├─ lib/             format.ts、idempotency.ts、useAsync.ts
│  ├─ config.ts        API_MODE / API_BASE_URL
│  ├─ App.tsx          路由与角色守卫
│  └─ main.tsx         入口
├─ verification/       前端检查记录（见 DSH_DELIVERY.md 汇总）
├─ work/               中间文件（当前为空）
├─ vite.config.ts      @shared 别名、开发代理、代码分包
└─ index.html
```

## 统一数据访问层（service）

组件只 import `src/services/api.ts` 的 `api`，不直接接触 mock/http 实现。接口定义见 `src/services/apiTypes.ts` 的 `FrontendApi`，语义与 `shared/API_CONTRACT.md` 一致。

- **mock 模式**：`src/mocks/mockApi.ts` 实现同一份接口，使用内存演示数据，覆盖成功、空数据、无权限(403)、会话过期(401)、版本冲突(409)、待配置规则、排队、失败、待复核等状态；全程显示“演示数据 / 尚未连接后台”横幅。
- **http 模式**：`src/services/httpApi.ts` 走真实 `/api/v1`，统一处理 Bearer 令牌、成功/失败信封、401 重新登录、403/409/429/5xx 错误。**失败绝不静默回退到模拟成功**。

访问令牌仅保存在运行内存（`src/services/authStore.ts`），刷新后需重新登录。401 会话失效统一跳转登录并提示。

未提交输入和待确认的幂等请求在同一标签页内存中按用户+作业隔离；过期后重新登录同一账号可恢复，整页刷新/关闭标签页会丢失尚未保存输入，显式退出会清除。提交结果未确认时锁定原请求，允许重试或查询状态；版本冲突不覆盖服务器草稿。答卷概览使用分页，班级/作业/规则元数据按游标读取完整列表，不批量读取答案全文。

## 页面与路由映射

| 路由 | 页面 | 角色 |
|---|---|---|
| `/login` | 登录 | 公开 |
| `/demo/states` | 状态演示（仅 mock） | 公开 |
| `/student/assignments` | 学生任务列表（班级/作业） | 学生 |
| `/student/assignments/:id` | 学生答题（草稿/提交） | 学生 |
| `/student/report/:submissionId` | 学生个人报告 | 学生 |
| `/teacher/overview` | 教师班级概览 | 教师 |
| `/teacher/classes/:classId` | 班级作业列表（完成情况） | 教师 |
| `/teacher/classes/:classId/assignments/new` | 新建作业 | 教师 |
| `/teacher/assignments/:id/edit` | 编辑/发布/关闭/绑定规则 | 教师 |
| `/teacher/assignments/:id/submissions` | 提交列表 + 汇总 + 导出 | 教师 |
| `/teacher/submissions/:id` | 评分复核 | 教师 |

## 演示账号（仅 mock 模式）

- 学生：`student` / `demo123`
- 教师：`teacher` / `demo123`
- 会话过期演示：`expired` / `demo123`

演示数据与账号均显式标注“演示”，不冒充正式账号。生产模式（http）禁止使用演示登录。

## 模拟数据位置

`src/mocks/data.ts`（初始数据）与 `src/mocks/mockApi.ts`（内存状态与行为）。所有评分维度、题目、评语均为“演示”，非正式评价体系。

## 已知事项

- ECharts 按需引入后主包已较小；评分图表在报告页按需渲染。
- 开发服务器仅开放frontend/shared文件范围，禁止读取backend、work、环境及凭证文件；端口占用时明确失败，不自动跳端口。
- 时间展示固定Asia/Shanghai，datetime-local编辑按浏览器本地时区转换为UTC ISO；真实手机/时区尚待用户试用。
- 生产预览仅服务静态文件，不自带API代理；正式同源网关/HTTPS尚待云托管配置。生产build通过不等于已上线。
- ECharts升级后分包约503kB（gzip171kB），构建有体积提醒；不影响本轮构建和联调，真实手机网络性能待验证。
- 学生任务列表未逐项拉取“我的提交状态”，草稿/提交状态在答题页展示；如需列表级状态，可在交付单中向 Codex 提出接口建议。

详见 `handoff/DSH_DELIVERY.md`。
