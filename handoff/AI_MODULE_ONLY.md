# AI独立交付接续

更新：2026-10-29。当前工作区preclass-ai-module-delivery，分支feature/ai-module-only，基线design/commercial-preview@61751cc。从完整PR #6提取AI引擎及宿主适配，未继承PR #6提交祖先，未复制frontend改动、admin功能或auth实现变更。主系统仍保留基线前端，仅为仓库背景。

已完成：ai-module源码、检索/身份/选课/用量/调度边界，backend/ai.ts与私有conversations及routes，共享会话DTO，两份HTTP回归，最小app/server/file依赖及CI构建顺序。ai.ts已去掉ApiSettings/ManagedApi/管理设置依赖；会话隐私测试调用AI专属元数据接口，不依赖/admin/usage。公开交付不含任何UI组件、样式或截图。

验证：新工作区从lockfile npm ci，AI check/build+18/18；后台check/build+53/53与smoke通过。证据ai-module/verification/2026-10-29-ai-only-tests.txt、2026-10-29-host-tests.txt、2026-10-29-host-smoke.txt。未重测前端，因为交付未改它；不把旧PR #6的浏览器截图当成本分支验收。未测真实供应商、整站300/500、云、多副本或真机。

最新接口/启动命令：docs/integration/AI模块独立交付.md。原宿主鉴权、本班已发布资料和SQLite使用保持；课程规则当前环境学科词项基线。真实API关闭，host仅mock；独立引擎DeepSeek适配并不等于已在宿主启用。独立引擎8891与主系统/api/v1/core/ai的Bearer和路径不可混用。

学生最新策略是私有保存/删除/续聊；账本仍不留正文，教师及AI管理元数据不暴露正文。最多100线程/课/学生、100轮/线程，最近3成功轮次/3500字节上下文。删除不清计费或保证清备份/WAL。线程/单实例调度不是共享存储多副本方案。

发布状态：正在上传独立分支并创建单独草稿PR，地址随后补记。整包PR #6保留对照，不重复合并两个PR。原preclass-ai-integration工作区和私有数据库保留，不改原运行进程或主分支。

下一步：先读本文件、交付指南和工作日志，核对实际分支及远端头；其他创作者只对接API并自行实现界面。要真接模型需先补齐预算、价格、Key环境、来源白名单、阈值和对账，不自动开启付费。不要按旧CODEX_CONTINUE.md的界面交付记录覆盖当前范围。
