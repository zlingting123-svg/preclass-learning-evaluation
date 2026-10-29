# 前端浏览器检查记录（mock 模式）

更新时间：2026-10-27（Asia/Shanghai）
方法：Playwright-core 1.64.1 + 本机 Google Chrome 无头浏览器，连接 `http://localhost:5173`（Vite 开发服务器，`VITE_API_MODE=mock`），全部通过 SPA 内部点击导航（不做整页刷新，因为令牌只在运行内存，刷新即重新登录）。
截图存放：`frontend/verification/screenshots/`。

> 说明：本模型无法直接读取图片做像素级人工目视，布局结论以“无横向溢出（`scrollWidth <= innerWidth`）+ 关键交互通过”为准；截图留作 Codex/用户复核。

## 已通过（32 / 32）

### 布局宽度（320 / 375 / 414 / 768，无横向溢出）

| 页面 | 320 | 375 | 414 | 768 |
|---|---|---|---|---|
| 登录页 | 通过 | 通过 | 通过 | 通过 |
| 学生任务列表 | 通过 | 通过 | 通过 | 通过 |
| 学生答题页 | 通过 | 通过 | 通过 | 通过 |
| 教师班级概览 | 通过 | 通过 | 通过 | 通过 |

### 学生核心流程（mock）

- 登录 `student`/`demo123` → 进入 `/student/assignments` ✓
- 任务列表显示 5 个作业项 ✓
- 进入“已配置评价”作业答题页，显示题目输入框 ✓
- 填写→保存草稿→出现“草稿已保存” ✓
- 提交→跳转 `/student/report/...`，报告显示“系统初评”与维度 ✓
- 提交“待配置评价体系”作业后，报告显示“待配置评价体系” ✓

### 教师核心流程（mock）

- 登录 `teacher`/`demo123` → 进入 `/teacher/overview`，显示 3 个班级 ✓
- 进入班级页，显示作业 ✓
- 进入提交列表，显示“完成情况”与 6 行答卷 ✓
- 进入复核页，显示“评分复核”与“系统初评” ✓

### 会话过期

- `expired`/`demo123` 登录后跳回登录页并提示“会话已过期” ✓

### 运行错误

- 页面 JS 错误（pageerror）：0
- console 错误：1 条 `Failed to load resource: 404`（为 `/favicon.ico`，见 P4）

## 问题清单（待修复；本轮按约定暂停修改源码/依赖/配置）

### P1（高）教师端未展示/复制班级加入码

- **复现步骤**：以教师登录 → 班级概览或班级页，看不到加入码。
- **预期行为**：契约 v0.1.1 新增 `ClassInfo.joinCode?`，仅所属教师返回；教师页面应展示并可复制加入码（学生响应省略该字段）。
- **实际行为**：前端仍按 v0.1.0 逻辑，未读取/展示 `joinCode`；mock 数据 `ClassInfo` 也未提供该字段。
- **相关文件**：`src/mocks/data.ts`、`src/pages/teacher/TeacherOverviewPage.tsx`、`src/pages/teacher/TeacherClassPage.tsx`。

### P2（高）开发代理端口与后台不一致

- **复现步骤**：将 `VITE_API_MODE=http` 后走开发代理，请求无法命中后台。
- **预期行为**：代理 `/api` 到 `http://127.0.0.1:3001`（后台默认端口，见 `integration/BACKEND_READY.md`）。
- **实际行为**：`vite.config.ts` 默认 `target: localhost:3000`。
- **相关文件**：`vite.config.ts`。

### P3（高）生产构建未强制禁用 mock / 缺配置未报错

- **复现步骤**：不设置 `VITE_API_MODE` 即构建，`config.ts` 缺省回落到 `mock`。
- **预期行为**：生产构建必须禁用 mock；http 模式缺失配置时明确报错，而非静默回退 mock。
- **实际行为**：`API_MODE` 对未知值缺省为 `mock`，无“生产禁用/缺配置报错”分支。
- **相关文件**：`src/config.ts`。

### P4（低）缺少 favicon

- **复现步骤**：打开任意页面，浏览器自动请求 `/favicon.ico` 返回 404，console 报“Failed to load resource”。
- **预期行为**：提供 favicon 或显式忽略该资源，避免 404 噪音。
- **实际行为**：`index.html` 未声明 favicon。
- **相关文件**：`index.html`。

## 未验证（明确不视为“通过”）

- 真实设备浏览器：Windows/Android/MagicOS/iOS 真机未执行。
- http 模式对接真实后台：未执行（依赖 Codex backend、受控账号与端口）。
- 300 人集中提交压测：未执行。
- 上述“宽度无横向溢出”是浏览器（Chrome 无头）结论，不代表真机或其它内核。

## 结论

mock 模式学生/教师核心操作与 320/375/414/768 布局在本机 Chrome 无头浏览器中通过。契约 v0.1.1 的 `joinCode` 展示、后台端口 3001、生产禁用 mock 三项为待修复差距（P1–P3），按约定本轮不改源码，待 Codex 缺陷清单后定点修复。
