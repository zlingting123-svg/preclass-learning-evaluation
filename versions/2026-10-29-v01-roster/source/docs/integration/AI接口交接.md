# AI 同学接入说明（核心问卷 v0.4.0）

业务端不实现模型服务。当前接口位于 backend/src/questionnaire-routes.ts，三个请求均返回标准错误信封，HTTP503/code=AI_NOT_CONNECTED。界面显示未接入，不制造AI回答。

所有接口 /api/v1/core/ai 下，Bearer认证、classId权限检查；generate和insights额外要求teacher。后续接入仍需保留权限、限流、超时、请求取消与错误信封；密钥仅服务端环境变量，不进入前端或GitHub。

| POST路径 | 请求JSON | 成功data |
|---|---|---|
| /chat | {classId,messages:[{role:"user"或"assistant",text}]} | {reply:string} |
| /generate | {classId,text:文件识别/教师修正后的纯文本} | {questions:SurveyQuestion[]} |
| /insights | {classId,surveyId} | {text:string} |

成功必须标准信封 {ok:true,data,requestId}；失败 {ok:false,error:{code,message},requestId}。SurveyQuestion定义在shared/questionnaires.ts：id/title/type(text,single,multiple)/required/options。结果先展示编辑，教师保存时再由后端严格校验，禁止AI直接发布。不要让客户端指定他班统计；insights应由后台再核对surveyId属于classId，读取聚合数据后调用模型，避免发送姓名、学号或个人答卷。chat当前页面内存保存，尚无历史消息库。

图表当前由业务端基于真实统计渲染，AI只提供文字建议。若未来扩展图表配置，采用受限结构白名单，不能把模型返回的任意JS、HTML、ECharts函数直接执行。禁止自动拿原固定画像推断能力分数。
