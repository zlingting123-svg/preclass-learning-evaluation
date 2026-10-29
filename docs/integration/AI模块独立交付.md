# AI模块独立交付与前端接入

日期：2026-10-29。任务分支`feature/ai-module-only`，基于同事界面分支`design/commercial-preview@61751cc`。这是从整包PR #6重新提取的AI交付；PR差异不含frontend文件、不含服务管理端、不改原认证实现。接入方可以保持自己的页面布局，合并本分支的AI后端后按本文调用。不要为了使用AI而合并PR #6的全部界面。

## 接收内容

| 位置 | 职责 |
|---|---|
| `ai-module/` | 可独立构建的AI网关；供应商、授权、检索、计费账本、调度适配器与模块测试 |
| `backend/src/ai.ts` | 复用主系统认证和班级权限，读取本班已发布资料，挂载问答/统计接口；本适配器仅mock |
| `backend/src/conversations.ts`、`conversation-routes.ts` | 本人对话保存、选择、恢复、删除与有界历史续问 |
| `shared/conversations.ts` | 前端可引用的消息、线程、来源和状态类型 |
| `backend/src/app.ts`、`server.ts` | 最小挂载、启动和关闭连接；新增可选CourseAi参数，旧调用兼容 |
| `backend/package*.json`、`.github/workflows/verify.yml` | 本地file依赖及先构建AI模块的CI顺序 |
| `backend/test/ai-integration.test.ts`、`conversations.test.ts` | 脱离整包PR #6的鉴权、持久化和HTTP测试 |

不需要PR #6的admin文件或shared/admin.ts，也不依赖frontend服务、组件、Hook和样式。当前仓库分支仍保留基线自带的前端，**本次新增提交不修改它**。独立引擎在ai-module，不导入其中server.ts即可作为库使用。

## 安装、构建与无页面调试

要求Node 24.15–24.x；从仓库根目录依次执行：

```sh
cd ai-module
npm ci
npm run check
npm run build
npm test
cd ../backend
npm ci
npm run check
npm run build
npm test
npm run smoke
```

仅测试独立引擎：在ai-module执行`python3 scripts/sample.py start`，8891为API端口；`printf '环境评价的作用是什么？' | node scripts/client.mjs ask`。独立JWT仅供模拟，不可当成主系统登录凭据，不能直接调用下述主系统接口。停止用`python3 scripts/sample.py stop`。

主系统调试：在backend执行`npm run sample:seed`，只在固定work/platform-sample生成/保留模拟账号与课程，随机口令仅在该目录。再执行：

```sh
AI_MODE=mock PORT=3003 DB_PATH=work/platform-sample/sample.sqlite npm start
```

以上为macOS/Linux shell示例；Windows需用对应环境变量语法。主系统默认AI_MODE缺省/disabled时不启用模型，显式mock也不会付费。停止进程保留数据库，不删除原有work。现有主系统样板启动器未在本分支修改，不能假定其自动设置AI_MODE。首次独立调试的账号/课程与别的工作区不同。

## 前端首先调用的接口

下表统一前缀`/api/v1/core/ai`。复用主系统`POST /api/v1/auth/login`返回的Bearer，不另外注册AI账号；用户身份、选课、历史均由后端确定，不提交userId/role/history/key/model。当前以classId作为稳定课程范围ID，不按课程名称猜测。

JSON成功：`{ok:true,data,requestId}`；错误：`{ok:false,error:{code,message},requestId}`。后端AI路由挂在认证中间件之后。

| 方法/路径 | 请求 | 返回data或响应 |
|---|---|---|
| GET /status | 无 | mode、liveReady、historyStored、retrieval；这不是模型可用性承诺 |
| GET /last-context | 无 | 最近仍有权限的`{classId,threadId}`，否则两项null |
| GET /threads?classId=… | query仅classId | `ChatList`：items、activeId |
| POST /threads | `{classId}` | 新`ChatDetail` |
| GET /threads/:id | 无 | 本人线程`ChatDetail`含messages、busy |
| POST /threads/:id/select | `{}` | 选择后的`ChatDetail` |
| DELETE /threads/:id | 无 | `{deleted:true}`；正文逻辑删除，用量保留 |
| POST /threads/:id/questions | `{question,clientRequestId}` | POST fetch读取SSE；历史由服务器加载 |
| GET /usage | 无 | 本人调用尝试、tokens、费用、未知费用和预留 |
| GET /topics/:classId | 无，teacher且有班级权限 | 门槛过滤后的主题buckets和privacyThreshold，无正文 |
| GET /admin | 无，仅admin | AI用量汇总、调度/账户池及未配置余额状态，无正文/Key；不含人员管理 |

新前端使用threads接口。旧`POST /chat`（messages仅取末条用户问题）及`POST /chat/stream`（classId/question/clientRequestId）只为单次问答兼容，不能保存/恢复聊天。教师`/generate`、`/insights`仍未接入模型，不应显示已支持。

`ChatOutcome`：pending/done/refusal/insufficient_evidence/error/cancelled/interrupted。消息和来源字段以shared/conversations.ts为准。每课100线程、每线程100轮；近期最多3个完整成功轮次/3500字节传给模型，还受总输入上限裁剪。其他角色与其他学生不能读取正文。旧未保存历史不能补回。

## 建议的页面行为

1. 登录后加载last-context；仅使用仍可访问课程，加载其threads，再GET选中thread详情。无记录时展示空状态，第一次提问可先POST创建。
2. 切换会话调用select；切换账号时清空前一账号的页面状态。生成中busy禁止重复提交，可GET详情刷新；页面关闭后不自动再发请求。
3. 每次用户明确的新提问生成全新UUID作为clientRequestId。409表示已处理/冲突，先读取详情和用量，不更换ID盲目重试；重载历史不能再次触发生成。
4. 删除前由前端确认，再DELETE，刷新列表及last-context。删除会取消该线程正在运行的请求。取消生成可AbortController中止fetch，随后GET详情展示实际状态。
5. 不把页面历史当唯一数据源，也不把浏览器传入的历史当可信上下文。正文按纯文本渲染；不要使用innerHTML或执行模型返回代码。
6. 使用主系统同源代理。开发额外来源可用DEV_FRONTEND_ORIGIN指定本机localhost/127.0.0.1端口；不要为方便调试开放任意来源。

## SSE处理示例（无UI代码）

原生EventSource不能发送此POST正文，应使用fetch。事件包含accepted、queued、sources、delta、done；无需模型时refusal或insufficient_evidence也是正常终态；error为失败终态。流开始前看HTTP错误信封，开始后看事件。EOF不等于成功。下面代码用于说明读取和状态处理，页面自行绑定消息列表：

```js
async function ask({ token, threadId, question, clientRequestId, signal, onEvent }) {
  const response = await fetch(`/api/v1/core/ai/threads/${encodeURIComponent(threadId)}/questions`, {
    method: 'POST', signal,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, clientRequestId })
  });
  if (!response.ok) throw await response.json();
  if (!response.body) throw new Error('没有响应流');
  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = '', eventName = '', dataLines = [], terminal = false;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += value;
      let index;
      while ((index = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, index).replace(/\r$/, '');
        buffer = buffer.slice(index + 1);
        if (line.startsWith('event:')) eventName = line.slice(6).trim();
        else if (line.startsWith('data:')) dataLines.push(line.slice(5).trimStart());
        else if (line === '') {
          if (dataLines.length) {
            const data = JSON.parse(dataLines.join('\n'));
            onEvent(eventName, data); // delta追加data.text；sources更新来源
            terminal ||= ['done', 'refusal', 'insufficient_evidence', 'error'].includes(eventName);
          }
          eventName = ''; dataLines = [];
        }
      }
    }
    if (!terminal) throw new Error('回答中断，请读取会话详情与用量');
  } finally { reader.releaseLock(); }
  // 收到error不能展示“完成”；流结束后GET线程详情，以服务端保存结果为准。
}
```

Abort或网络失败后同样重新读取线程详情；未完成生成可能保留部分回答或interrupted/cancelled/error状态，未知费用不可显示为免费。前端不要向分析/追踪系统发送正文或Bearer。

## 引擎替换与未完成项

宿主接入路径与独立演示路径不同：本文为`/api/v1/core/ai`；ai-module/MERGE_CONTRACT.md的`/api/ai/v1`属于独立演示应用，只有单次问答/元数据接口，没有主系统私有线程存储。更换宿主时自行实现可信IdentityResolver、CourseAuthorizer和KnowledgeProvider，不复用StaticAuthorization演示授权。

主系统host目前仅mock，不能只放入Key就启用DeepSeek。引擎虽有DeepSeekProvider和余额监测适配，真实模型、价格版本、预算、余额阈值、来源白名单与语义阈值仍需配置和验收。当前仅本班教师已发布文本材料+词项检索/有限指代续问；没有生态环境部资料自动采集、参考书解析或语义RAG。

350生成/600排队是配置余量；原独立模块替身容量记录不代表当前整站300个AI/500用户访问已验收。SQLite单进程，BillingStore/AdmissionScheduler预留PG/Redis接口，多副本适配未实现。私有对话逻辑删除不保证清除备份/WAL。

真实API仍关闭；本分支不变更主系统人员管理、安全设置或网页布局。完整旧版本保留在PR #6供对照，两者不要同时重复合并。
