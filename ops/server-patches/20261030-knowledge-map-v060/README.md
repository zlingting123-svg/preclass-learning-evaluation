# 已部署知识图谱0.6集成源码

module/为实际扩展后的模块运行源码与上游测试；INTEGRATION.md解释与上游包差异，SHA256SUMS对应本目录提交的源码子集。不是可以不经核对的一键整站安装包。主站导航和同源框架的新增组件与插入点见patch-host.py；必须先以实际服务器基线提取main.before.js/entry.before.js/index.before.html，再审查构建差异，不能盲目覆盖其他电脑的新版本。

本次已部署current=20261030-knowledge-map-v060，详见docs/2026-10-30-知识图谱0.6教师学生接入.md。模块数据、虚拟环境、凭据、原始用户文件、测试访问令牌及截图不在此目录。依赖与原0.5完全相同；从module/运行时设置KM_DATA、KM_HOST_API，现有venv可复用。上游格式回归需相应test/requirements及LibreOffice/Tesseract等既有组件。

回退依赖服务器私有install-state.json和服务配置备份，只回退代码/入口，不整库恢复。源工程的TypeScript迁移仍待对齐，独立运行补丁不能冒充全站源码迁移完成。
