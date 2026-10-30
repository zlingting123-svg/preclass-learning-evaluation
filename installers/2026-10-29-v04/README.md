# v04 Ubuntu24.04首次安装包

- [发行页与全部附件](https://github.com/zlingting123-svg/preclass-learning-evaluation/releases/tag/installer-v04-20261029)
- [下载安装包（约66MiB）](https://github.com/zlingting123-svg/preclass-learning-evaluation/releases/download/installer-v04-20261029/preclass-ubuntu24-x64-ddc55257eccf.tar.gz)
- [下载SHA-256文件](https://github.com/zlingting123-svg/preclass-learning-evaluation/releases/download/installer-v04-20261029/preclass-ubuntu24-x64-ddc55257eccf.tar.gz.sha256)
- [安装步骤](安装步骤.md)（发行区附件名为 `install-guide.md`）
- [对应独立源码](../../versions/2026-10-29-v04-installer/source/)
- [原始CI证据](https://github.com/zlingting123-svg/preclass-learning-evaluation/actions/runs/40844018830)

目标：Ubuntu24.04 x86_64（amd64）首次安装。源码提交：`ddc55257eccf2aba137f4e38ce3f645393eb54a1`。压缩包69,686,955字节，3329个包内文件/链接记录；摘要：`bbd5f7eaa7fb6acd0fcd75509151a03fc69df397b1c9cd2cd81caf1d86356bea`。

安装包在同项目Releases发行区长期提供，不受CI artifact保留30天影响；请另存自己的备份。源码Git中只保存下载索引、说明和校验信息，避免每个版本复制大二进制。此发行版标为预发布：已通过一次性Ubuntu VM安装与恢复验证，但不是用户云主机、正式公网TLS或真实负载的验收。

包含网页、后台、生产Node依赖、私有Node/Caddy和PDF依赖。基础OS仍需Python3及systemd；其他基础组件缺项按安装说明联网安装，齐全时可--offline。遇到已有数据库/配置/current会拒绝覆盖；此包不提供自动升级或删除数据。密码通过安全终端/标准输入输入，不在包内。AI/搜索默认关闭。
