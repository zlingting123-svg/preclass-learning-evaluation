# 批次前端集成与 CI 接续验证

2026-10-28，Windows / PowerShell，Node 24.15.0、npm 11.12.1。工作区为独立 work/oss-foundations，分支 backend/oss-foundations。契约维持 v0.2.0，没有数据库迁移或正式资料导入。

## 同事交付与路线

通过 GitHub 连接器实时读取两个 PR 的元数据、分支、比较结果和交付文件，并 fetch 后审阅代码。核对时 PR #1 head 为 4e15d02，PR #2 head 为 1422d90；均 open、draft、未合并。PR #2 的 base 是 backend/oss-foundations，比基线多3个提交、49个文件；frontend/backend/shared 没有差异。

PR #2 是独立 Moodle/PHP 样板，不是原前端的 Node 接口适配交付。其 README/MAPPING 清楚说明没有 Node API 适配、双库同步或数据迁移；便携启动器只验证 macOS arm64。本机没有 PHP，没有安装该运行时或启动样板，因此其中题型11/HTTP25检查仍是同事在 Mac 上的交付证据。本机只做静态审查，不能改写成 Windows 运行通过。原 FRONTEND_DELIVERY/CONTINUE 仍是旧占位状态，不能由此判断远端没有新交付。

用户在本次接续中明确选择：继续 React/Node，借鉴 Moodle 样板。可借鉴批次筛选、任务状态与权限组织，不引入另一套教学主库。未合并 PR #2、未复制其 GPL 代码、未覆盖同事分支。原第三方许可证范围不变。

## 差异与本轮处理

| 差异 | 实际处理 |
|---|---|
| shared/backend 已支持 v0.2.0，但前端没有批次 API | FrontendApi/httpApi 增加 listCohorts、listClasses.cohortId、createClass.cohortId；共享契约不变 |
| 教师无法按批次看班级或选择所属批次建班 | 只列服务端授权批次；增加筛选及建班批次选择；创建后切换至对应筛选；后端仍检查伪造批次写入 |
| 学生跨期班级混在一起 | 只列选课批次；按批次选择班级与任务；加入后切到目标班与批次 |
| 空班级可能省略 classId 查询所有作业 | 无选中班级时不发作业查询；返回结果携带所属班级，切换时不渲染旧班任务 |
| 旧班级没有 cohortId | 明确保留历史班级筛选及原建班方式，不自动搬移旧作业或选课 |
| 无自动检查 | 新增 .github/workflows/verify.yml：Windows runner、Node 24.15.0、两包 npm ci/check/build、后台测试/smoke、生产限制、真实 loopback HTTP 与显式 mock 检查 |

批次与班级元数据均完整读取分页，再在已授权列表中筛选；这不是新的授权机制。现有后台仍负责全部权限判断。mock 仅返回空批次列表，保留原有演示班级，不编造春秋课程配置；生产请求失败不回退 mock。

## 本轮实际验证

- backend：check、build、22/22测试、smoke通过。后台业务源码未修改。
- frontend：check、build、3/3生产配置限制检查通过；ECharts 502.67kB提示仍在。
- integration：21/21真实本地HTTP浏览器检查通过，见 2026-10-28-http-browser.json。新增检查覆盖授权批次、带批次建班/伪造写入拒绝、历史班级、学生跨期筛选/加入后切换、空筛选不请求全部任务、批次503错误与恢复。
- 显式 mock 冒烟通过。仅模拟账号与测试评分替身，没有正式模型调用。
- 查看教师320px、学生375px批次界面截图，主要控件无重叠或横向溢出；既有320/375/414/768/1280检查通过。截图见 screenshots/2026-10-28。均为桌面Chrome模拟宽度，不是真机。
- 第一次新增检查运行遇到旧脚本用 locator('select') 假设页面只有一个选择框；已改成按“班级”标签定位，并重跑完整21项通过。没有降低业务断言。

## CI 范围与来源

官方 actions/checkout 与 actions/setup-node 的 v6 已通过连接器解析并固定提交：checkout d23441a48e516b6c34aea4fa41551a30e30af803、setup-node 249970729cb0ef3589644e2896645e5dc5ba9c38。来源：[checkout](https://github.com/actions/checkout/commit/d23441a48e516b6c34aea4fa41551a30e30af803)、[setup-node](https://github.com/actions/setup-node/commit/249970729cb0ef3589644e2896645e5dc5ba9c38)。没有新增运行依赖或修改 npm 锁文件。

工作流使用 contents:read、checkout 不保留凭据；无 secrets、部署、真实账号、浏览器下载或数据文件上传步骤。使用 runner 已有 Chrome/Edge，找不到明确失败。push、pull_request 与手动触发；同一 ref 新运行取消旧运行。失败时仅打印测试脚本生成的模拟JSON证据，不上传数据库或口令。

远端首次执行：d24aa96 的 PR 运行 [40647464343](https://github.com/zlingting123-svg/preclass-learning-evaluation/actions/runs/40647464343) 失败于 HTTP 流程；后台22项、smoke、前端安装/check/build及3项配置限制均成功。初始日志在第7项通过后只给 exit code 1，没有具体断言。39503bb 增加逐项开始/失败输出与模拟HTTP证据打印，本机 CI=true 下21项再次通过；随后远端 [40648068561](https://github.com/zlingting123-svg/preclass-learning-evaluation/actions/runs/40648068561) 完整成功，已通过API核对job所有执行步骤并读取日志确认后台22、HTTP21、配置3及mock。机器可读快照见2026-10-28-github-actions.json。未删除断言、未加入自动测试重试；首次单次异常未复现，原因尚未确定，不能宣称已修复其根因。

同步方式：GitHub连接器修改PR说明返回403，使用本机现有GCM授权在内存请求同域API成功。随后Git push多次连接重置；39503bb通过Git data API上传相同blob/tree/commit，逐层核对本地SHA，并在远端仍为父提交时以force:false推进原分支，最终API确认SHA一致。没有改全局Git配置、强推、存储凭据或修改同事分支。

### 最后复查发现并修复的分页问题

文档收尾提交6d28a1a的[运行40648409721](https://github.com/zlingting123-svg/preclass-learning-evaluation/actions/runs/40648409721)在分页检查失败：页面已显示“第2页”，列表仍有20条。新增诊断保留了完整断言与JSON，表明这是实际显示时序问题，不能仅靠延长测试等待掩盖。

原因：useAsync在依赖变化后的effect才设置loading，cursor状态先更新的一次渲染仍持有旧响应。TeacherSubmissionsPage现在让响应携带assignmentId/cursor，只有响应归属与当前查询一致才展示列表和页码，否则显示加载状态。未修改全局hook、接口或数据库。

原分页检查增加受控延迟响应，在等待期间核对加载与旧列表隐藏；MutationObserver记录整个切页期间页码与列表的一致性，再验证第二页1条答卷。没有删除分页断言或增加自动重试。本机check/build、配置3项、CI=true完整HTTP21项通过。修复提交的远端结果需按当前Actions核对；39503bb的成功和6d28a1a的失败均为历史事实，不用前一次绿灯替代后续结果。最早d24aa96第8项附近的无诊断失败仍无法认定与本分页问题同因。

## 未完成

名单网页及操作者权限、首次/主动改密和受控重置、4次作业业务规则、问卷未定题型/锚点/必填、正式评分与匿名样本、云适配/备份、真机、300独立账号压测仍待完成。500人是批次计划量。未采购、部署、合并main或上传真实学生资料。
