# 云服务器适配版本

源码提交 `e0836bfb4b767d5754658e3190be3ff62c97a231`，独立代码在source/。旧版本v01/v02保持不变。为避免递归快照，本版不包含来源提交的versions/目录，其余源码逐文件对应Git对象与SHA-256清单。运行前为此版本单独配置DB_PATH和端口，勿复用旧库。

已在macOS验证Caddy2.11.7配置与4MiB真实代理、完整备份/损坏检测、后台82项和AI19项、前端构建。完整备份会停服，耗时取决于资料量；生产代码/root脚本须由root管理。Linux CI与公网TLS、systemd真实生命周期、云服务器和负载验收另行确认。详见source/deployment/README.md和云服务器版本适配日志。

验证补记：源码相同的整合头0f3ba94已通过GitHub Ubuntu和Windows检查。CI结果见verification/github-ci-0f3ba94.json；实际云主机、域名TLS、systemd备份停启和真实负载仍待验收。source/保留e0836bf原样，历史说明中的“待确认”为当时状态。
