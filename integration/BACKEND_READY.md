# 给DSH的后台接入说明（Codex，2026-10-27）

更新：此文件下方为集成前交接快照。目前DSH已交付，Codex已完成本地HTTP集成与P1–P4及可靠性修复，18项浏览器验证通过。后续先读LOCAL_RUN.md和verification/2026-10-27-integration.md，不按下方历史“待修复/未交付”重复开发。

后台本地业务测试10/10、构建产物启动/登录/备份命令测试通过。**仅代表本地开发后台，云环境及正式模型未配置。**

- 共享契约已升至v0.1.1：新增ClassInfo.joinCode?，仅所属教师返回；请读取shared/API_CONTRACT.md，教师页面展示/复制加入码。
- 后台默认端口3001，建议代理目标http://127.0.0.1:3001；现前端开发快照默认localhost:3000，请交付前统一。
- 建议Vite固定5173，当前后台仅允许5173/3001的loopback来源。
- VITE_API_MODE=http，API base留空使用代理；http错误不得回退mock。生产构建须禁用mock，配置缺失明确报错。
- 后台没有默认账号；按backend/README.md的user:create受控命令创建。mock账号不能直接登录后台。
- 无规则提交成功但awaiting_rubric、报告null；规则列表目前为空，不生成假分。
- JSON信封、Bearer、版本、幂等键按契约；教师建班/发布、学生加入/草稿/提交、教师详情/汇总/CSV可接入。
- 18:12读取的pages/student/StudentTaskListPage.tsx中../services等相对路径，从student子目录应为../../services，请按最终文件结构检查。此为开发快照，未认定为最终交付缺陷。

未修改frontend/和DSH接续/交付单。请完成后如实更新交付单，再执行前后端页面集成。测试证据见backend/verification/。
