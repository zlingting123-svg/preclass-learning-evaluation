# 课前问答与学习评价系统 · 开发任务框架

更新时间：2026-10-27（Asia/Shanghai）

已完成本地前后端HTTP集成：后台10项业务测试、18项真实HTTP浏览器联调、生产构建限制和显式mock冒烟通过。契约v0.1.1；DSH前端已交付，Codex完成集成与必要修复。**尚未云部署、正式评分或执行300独立账号压测，不是正式上线。**

本地启动先读 `integration/LOCAL_RUN.md`；最终证据见 `integration/verification/2026-10-27-integration.md`；继续开发先读 `handoff/CODEX_CONTINUE.md`。无需重建项目或重新开发已验证页面。

## 使用顺序

1. 在 Codex 新对话中打开本项目目录，发送下方的 Codex 启动语。
2. 在 DSH（DeepSeek Harness）新对话中打开同一个项目目录，发送 DSH 启动语。共享契约已经提供，可同时开展界面工作，无需等待后台完成。
3. 你分别提供题目、评分标准和真实设备试用反馈；两边的变更由文件交接，不依赖对话记忆互通。
4. DSH 完成后更新 `handoff/DSH_DELIVERY.md`；将其路径交给 Codex，由 Codex 按 `handoff/INTEGRATION.md` 集成和验证。
5. 任一工具需要换新对话，先更新自己的接续文件，再按接续文件中的启动语继续。

## Codex 新对话启动语

```text
请把“课前问答项目”作为项目根目录，先读取 AGENTS.md、01_Codex任务书.md、shared/API_CONTRACT.md、shared/contracts.ts，以及 handoff/CODEX_CONTINUE.md，然后按照 Codex 任务书执行。只负责约定范围；先检查实际文件状态，再继续未完成任务。DSH 在另一对话负责前端，请不要覆盖其未交接的修改。按要求及时更新接续 MD，供我新开对话继续。
```

## DSH 新对话启动语

```text
请把“课前问答项目”作为项目根目录，先读取 AGENTS.md、02_DSH任务书.md、shared/API_CONTRACT.md、shared/contracts.ts，以及 handoff/DSH_CONTINUE.md，然后按照 DSH 任务书执行。主要负责 frontend/，通过模拟数据和接口适配层开发，不修改后台与共享契约。按要求及时更新接续 MD，完成后交付给 Codex 统一集成。
```

## 最终对接启动语

```text
请读取 01_Codex任务书.md、handoff/CODEX_CONTINUE.md、handoff/DSH_DELIVERY.md 和 handoff/INTEGRATION.md，检查双方实际交付，先列出兼容性差异，再完成前后端集成及必要修复。不得把模拟数据、页面截图或测试入口当成正式上线和 300 人压测结果。
```

## 换新对话的启动语

```text
请读取本项目 AGENTS.md、你的任务书、对应的 handoff/CODEX_CONTINUE.md 或 handoff/DSH_CONTINUE.md，再核对实际文件、共享契约和验证记录，接着“下一步”继续。已经验证完成的内容不要重复开发；未确认的结果保持待验证。
```

## 文件与维护责任

| 路径 | 内容 | 维护方 |
|---|---|---|
| `01_Codex任务书.md` | 后台、集成、部署与验收任务 | 你确认范围；Codex记录必要变更 |
| `02_DSH任务书.md` | 前端、图表与状态展示任务 | 你确认范围；DSH记录必要变更 |
| `shared/API_CONTRACT.md` | 双方接口、状态、错误及交接规则 | Codex统一维护；DSH提出变更建议 |
| `shared/contracts.ts` | 共享的数据类型 | Codex统一维护 |
| `frontend/` | 教师、学生与报告页面 | DSH；交接后由Codex集成 |
| `backend/` | 业务、数据、权限、评分与云适配 | Codex |
| `handoff/CODEX_CONTINUE.md` | Codex接续记录 | Codex |
| `handoff/DSH_CONTINUE.md` | DSH接续记录 | DSH |
| `handoff/DSH_DELIVERY.md` | 前端最终交付与已知差异 | DSH |
| `handoff/INTEGRATION.md` | 对接、验证与完成标准 | Codex |
| `handoff/CONTINUATION_TEMPLATE.md` | 换对话时复制使用的结构 | 双方各用自己的文件 |

双方共用本地项目时，不要同时运行整个目录的格式化、清理、重置或依赖升级。最好在独立 Git 分支/工作目录开发后交接；如果暂不使用 Git，严格按上述目录划分操作，修改前确认已有文件。DSH 不执行根目录或后台的安装命令。

初版估计 60–90 个有效项目工时，每天投入 4 小时约 3–5 周；上线手续等待、全年维护另计，第一条联网流程完成后重估。两套工具的订阅与正式评分 API 不是同一项支出。
