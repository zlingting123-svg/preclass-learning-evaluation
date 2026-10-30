## 0.3.0 增量（2026-10-28 集成分支）

兼容0.2.0作业、名单与认证API。新增类型见learning.ts；固定原问卷见profile-schema.ts（source-draft-1，18题原文，7题允许部分草稿，11题不采集；无必填与评分）。所有新增接口位于原Bearer认证之后，复用班级成员/教师及批次授权判断。

| 方法路径（/api/v1下） | 行为 |
|---|---|
| GET /profile-schema | 已认证用户读取原问卷，不包含答案 |
| GET/PUT /classes/:id/my-profile | 学生自己的班级画像，未保存返回null；PUT完整替换answers/other，含schemaVersion与expectedVersion，版本冲突409且不写入 |
| GET /teacher/classes/:id/profiles | 本班画像摘要分页，不含答案全文；含字符串studentNumber或null |
| GET /teacher/classes/:id/profiles/:studentId | 本班单份完整草稿 |
| GET /teacher/classes/:id/profiles/export | 本班全部已保存画像CSV，复用safeCsv；学号导入表格时指定文本 |
| GET /classes/:id/materials | 班级材料分页，学生仅见已发布，教师可见自己班的草稿 |
| GET /materials/:id | 单篇纯文本材料，按所属班级权限判断 |
| POST /teacher/classes/:id/materials | 新建材料草稿（title/content/expectedVersion=0） |
| PUT /teacher/materials/:id | 修改草稿，版本校验；发布后拒绝原地改写 |
| POST /teacher/materials/:id/publish | expectedVersion校验并发布 |

原学生GET /assignments列表增量返回可选mySubmissionState（not_started/draft/submitted），仅由当前认证学生的持久答卷推导，不向其他角色泄露个人状态。旧客户端可忽略。画像独立于作业，不加入评分任务。课程正文纯文本，React不解释HTML。

新增功能在HTTP模式使用；旧mock仍单独明确标识演示，画像/课程材料不伪造持久化成功。首次强制改密、受控重置、正式评分、云部署、并发与真机仍未完成。

---

# 共享数据与接口约定

契约版本：`0.2.0`（任务分支，兼容0.1.1旧客户端）；状态：新增受控批次/名单基础，前端新界面待同事适配；正式规则、云端和300人验收未完成；更新时间：2026-10-27。

本文件及 `contracts.ts` 是两边共同依据。Codex统一维护；DSH只提出变更建议。首次完成云能力样例后可以修订，但必须递增版本、列出差异并通知另一方，不能一边改字段一边期待另一边自行适配。

## 一、统一规则

- 基础路径：`/api/v1`。本地前端通过开发代理指向后台，生产域名和网关映射由Codex实际验证。
- 请求和普通响应为UTF-8 JSON。所有ID是不透明字符串，不能依靠ID推断权限。
- 时间为UTC ISO 8601字符串；界面按Asia/Shanghai展示，不能把本地字符串冒充UTC。无截止时间用null。
- 列表返回 `{items, nextCursor}`，支持 `limit` 与 `cursor`；默认20、最大100。不能为了列表一次拉出全班完整答卷。
- 普通成功：`{ok:true,data:...,requestId:"..."}`。
- 失败：`{ok:false,error:{code:"...",message:"...",details?:...},requestId:"..."}`，同时返回正确HTTP状态；前端不只检查HTTP200。
- 登录成功返回访问令牌；后续 `Authorization: Bearer <accessToken>`。先保存在前端运行内存，刷新后允许重新登录；更改令牌持久化方式需双方同步。真实HTTPS、过期和注销验证由后台落实。
- 密码只发送给认证入口，不记录日志，不放URL，不写共享文件；采用成熟认证能力，具体供应商由Codex验证。
- 前端所有数据请求经过统一service。`mock`模式有持续演示标识；`http`模式失败时绝不回退模拟成功。生产环境禁用模拟登录和演示数据。

## 二、身份与权限

- `student`：加入班级、查看所属班级已发布作业、保存自己的草稿、提交和查看自己的报告。
- `teacher`：管理自己负责的班级与作业，查看其答卷、复核评分和导出。
- `admin`：受控初始化与必要管理；首版不强制完整管理员网页。
- 页面隐藏按钮不算权限校验。所有接口服务端核对用户、角色、班级成员或教师归属。
- 账号由受控初始化/导入创建，首版不开放任意注册；班级加入码不能授予教师身份。

## 三、核心状态与行为

### 作业

`draft → published → closed`。草稿允许编辑。发布后的正文不原地改写，复杂修订后续再设计。到截止时间由服务端禁止新提交，界面相应显示截止；没有截止时间仍可由教师关闭。

作业允许暂时 `rubricId=null`，用于先收集答案；此时界面注明评价体系待配置，答卷评分状态为 `awaiting_rubric`。配置规则后用专用绑定接口处理，不能通过修改已发布题目规避限制。

### 答卷与草稿

答卷提交状态只有 `draft | submitted`，与评分状态分开。首次草稿 `version=1`，客户端创建时 `expectedVersion=0`。每次保存成功版本递增，版本不符返回409及最新版本号，避免多设备互相覆盖。

正式提交请求携带完整答案和 `expectedVersion`，不能依赖尚未成功的自动保存。使用请求头 `Idempotency-Key`，由前端为同一次提交生成一次并在失败重试时复用。

服务端对用户与作业组合保证仅一份正式答卷。成功保存提交及持久评分任务后才能返回成功；同一幂等键的重放返回原结果。已提交的不同内容尝试返回409，不覆盖原答案。同键用于不同内容应拒绝。初版不做撤回和多次尝试。

### 评分

`not_requested`：草稿；`awaiting_rubric`：已交卷但未配置规则；`queued`：持久任务已排队；`processing`：任务处理；`scored`：系统初评完成；`needs_review`：结果需要教师检查；`failed`：重试后仍失败。

这些状态由后台返回，不允许前端用定时器将“评分中”自动改成“完成”。失败可由教师显式重试，重试仍需防重和预算控制。

图表读取 `dimensions[].score/maxScore`，归一化为 `score/maxScore*100` 前校验范围和满分。维度顺序按规则；总分/总满分由后台按已确定规则返回，可为null，前端不自行推断权重或求平均冒充总分。规则如何加权由用户后续确定。

报告包含原系统评分与可选教师复核，显示时优先展示已保存的教师复核并标注。系统初评、复核记录、规则和模型版本需保留。学生只能看到本人的报告；模型密钥和私有参考答案不随题目下发。

## 四、接口清单

下列响应data对应 `contracts.ts`；CSV导出除外。冒号路径参数表示ID。

| 方法与路径 | 请求/响应data | 用途与限制 |
|---|---|---|
| POST `/auth/login` | `LoginRequest → AuthSession` | 真实认证；禁止生产默认演示账号 |
| GET `/auth/me` | `User` | 验证当前身份 |
| POST `/auth/logout` | `{success:true}` | 注销当前会话 |
| GET `/classes` | `Page<ClassInfo>` | 只返回有权访问班级 |
| POST `/classes/join` | `{joinCode} → ClassInfo` | 学生加入班级 |
| POST `/teacher/classes` | `{name} → ClassInfo` | 教师创建自己的班级 |
| GET `/assignments?classId=` | `Page<Assignment>` | 学生仅见已发布且所属班级的作业；教师仅负责范围 |
| GET `/assignments/:id` | `Assignment` | 不返回私有参考答案 |
| GET `/teacher/rubrics` | `Page<RubricInfo>` | 已由后台配置的评价规则，不先发明正式体系 |
| POST `/teacher/assignments` | `AssignmentInput → Assignment` | 创建草稿 |
| PUT `/teacher/assignments/:id` | `AssignmentInput → Assignment` | 仅草稿可编辑，包含版本校验 |
| POST `/teacher/assignments/:id/publish` | `{expectedVersion} → Assignment` | 发布校验题目、班级及版本；规则可暂未配置 |
| POST `/teacher/assignments/:id/close` | `{expectedVersion} → Assignment` | 教师关闭提交 |
| PUT `/teacher/assignments/:id/rubric` | `{rubricId,expectedVersion} → Assignment` | 绑定已配置规则，为等待规则的答卷建任务；不自动覆盖历史评分 |
| GET `/assignments/:id/my-submission` | `SubmissionDetail` | 未建草稿返回 `{submission:null,report:null}`，不当成报错 |
| PUT `/assignments/:id/my-draft` | `SaveDraftRequest → Submission` | 草稿版本校验，已提交不可覆盖 |
| POST `/assignments/:id/submit` | `SubmitRequest → Submission` | 携带Idempotency-Key，原子保存与建任务 |
| GET `/submissions/:id/report` | `ReportView` | 自己或授权教师可读；未评分时report=null |
| GET `/teacher/assignments/:id/submissions` | `Page<SubmissionOverview>` | 有权教师的答卷概览，不在列表下发答案全文 |
| GET `/teacher/submissions/:id` | `SubmissionDetail` | 授权教师查看答案及报告 |
| GET `/teacher/assignments/:id/summary` | `AssignmentSummary` | 完成情况和评分状态计数 |
| POST `/teacher/submissions/:id/retry` | `{expectedVersion} → Submission` | 失败任务受控重试，防重复和无效重试 |
| PUT `/teacher/submissions/:id/review` | `ReviewRequest → ScoreReport` | 人工复核，校验报告版本，保留历史 |
| GET `/teacher/assignments/:id/export` | UTF-8 CSV | 授权后导出；正确转义并处理公式注入 |

接口数量不代表已经实现。若Codex需按云平台合并入口，仍应保持前端service语义兼容；将映射写清，不让组件直接依赖平台内部函数名。

## 五、常见错误

| HTTP | code示例 | 前端行为 |
|---|---|---|
| 400 | VALIDATION_ERROR / RUBRIC_UNCONFIGURED | 显示字段或配置问题 |
| 401 | UNAUTHENTICATED / SESSION_EXPIRED | 提示重新登录，尽力保留未提交输入 |
| 403 | FORBIDDEN | 明确无权限，不展示缓存的他人数据 |
| 404 | NOT_FOUND | 显示不存在或不可访问 |
| 409 | VERSION_CONFLICT / ALREADY_SUBMITTED / IDEMPOTENCY_CONFLICT | 不静默覆盖，查询最新状态并提示 |
| 429 | RATE_LIMITED | 说明稍后重试，避免无间隔反复请求 |
| 500/503 | INTERNAL_ERROR / SERVICE_UNAVAILABLE | 提供请求标识和重试入口，不展示内部密钥/堆栈 |

## 六、交接和版本变更

### 0.1.1 → 0.2.0（backend/oss-foundations任务分支）

- `ClassInfo.cohortId?: ID|null`可选新增。旧班级不自动绑定或迁移，旧客户端仍可只发送`{name}`创建旧式班级。
- `POST /teacher/classes`兼容新增可选`cohortId`，绑定时要求教师已由受控管理员加入该批次teacherIds，不允许教师凭任意批次ID自授权限。
- `GET /cohorts → Page<CohortInfo>`：教师只见获授权批次，学生只见已加入班级对应批次；普通教师不能因同课获取别人的班级、答卷或统计。
- `GET /cohorts/:id → CohortInfo`：不可访问返回404；公开DTO只含teacherCount，不下发teacherIds或学生名单。
- `GET /classes?cohortId=`按已有授权班级再筛批次，不扩大权限。旧classId/作业/提交路径不变。
- 批次明确保存startsOn/endsOn日历日期；允许跨年但不倒序，不根据11月自动猜测具体开课日。plannedStudentCount/plannedTeacherCount/assignmentsPerStudent只是显式计划配置，尚未自动生成500账号、7班或强制4次作业配额。
- 批次创建、为既有教师建班、名单预览/确认仅作为受控本机CLI，不开放任意教师/公共HTTP导入接口。导入操作者Web权限未确认前保持收紧。
- 名单以csv-parse按字符串解析；预览不创建账号，30分钟有效，确认需计划ID与SHA256指纹；身份冲突、重复、科学计数疑虑及预览后变化拒绝，不部分导入。
- 同学号跨期复用既有身份/口令并追加选课，不移动原班；新账号各自随机口令仅写backend/private-data私密新文件；确认重放不重复创建。账号/身份/选课/回执同SQLite事务，写入失败回滚并清理本次新建凭据文件。
- 旧客户端回归18项HTTP测试通过。新批次选择、导入预览/结果UI尚未实现，不把CLI能力写为完整网页管理。运行带批次数据的库应使用v0.2实现，不降级到忽略批次授权的旧后台。

### 0.1.0 → 0.1.1（2026-10-27）

- `ClassInfo.joinCode?: string` 为兼容性新增字段，仅所属教师收到；学生响应省略。原契约缺少教师获取加入码的途径，导致加入流程无法闭合。
- 没有删除或改名现有路径/字段。DSH尚未开发；后续交接请读取此版本，不再按0.1.0占位记录。
- 当前后台仅支持 loopback 本地 SQLite + bcrypt 会话适配。云端存储/认证、生产HTTPS与来源策略尚未验证。未配置模型适配时评分任务显式失败并有限重试，不生成假分数。
- 管理员暂无专用网页/业务旁路；账号初始化通过本机受控命令，不开放注册或默认账号。
- 题目ID不允许重复；正式提交必须完整覆盖题目且每题非空。草稿可只含部分题。所有答题长度由服务端按题目限制。
- 发布截止时间必须在未来；幂等重放在原请求已成功后允许跨截止时间返回原结果。幂等键按用户+作业隔离，同键不同请求内容（含expectedVersion）返回409。
- 绑定规则暂限首次绑定或同版本幂等调用，不替换已有规则、历史评价。规则配置与正式评分适配仍待教学材料和后续受控配置实现。

DSH的模拟service要覆盖成功、空数据、无权限、过期、版本冲突、待配置规则、排队和失败。Codex按相同契约实现真实service。

变更时记录：旧/新版本、变动字段、受影响接口与页面、是否兼容、迁移和验证方式。`contracts.ts` 是编译期结构，不替代服务端运行时校验。
