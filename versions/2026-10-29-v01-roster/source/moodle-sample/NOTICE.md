# 来源和许可范围

本目录新增插件及样板脚本 Copyright (C) 2026 preclass-learning-evaluation contributors，GPL-3.0-or-later；许可全文见 LICENSE。此声明仅适用于本目录新增代码，不把整个原项目重新授权。问卷和教学材料来自原仓库 docs/需求、docs/资料，继续受原来源权利约束；不得据代码许可推断其可任意再分发。

第三方代码/二进制由启动器下载至忽略上传的work目录，没有把Moodle核心、PHP或PostgreSQL二进制提交到GitHub。各自许可独立适用，不以本目录LICENSE替代。分发包含运行时的完整离线包前需另行整理全部许可和可适用源码提供义务。

| 来源 | 用途与授权 |
|---|---|
| https://github.com/moodle/moodle / https://download.moodle.org/ | Moodle 5.3+，GNU GPL v3 or later，完整许可在work/moodle/COPYING.txt；核心源码随下载包提供 |
| https://download.moodle.org/langpack/5.3/ | 官方zh_cn语言包；随Moodle生态的语言包，保留包内原始头部/版权信息 |
| https://download.herdphp.com/herd-lite/macos/arm64/8.4/php | Laravel Herd分发的便携PHP8.4.1；PHP本体为PHP License 3.01，扩展/依赖各有许可；不能将PHP本体许可视为整个Herd分发包的完整授权清单 |
| https://www.php.net/license/3_01.txt | PHP本体许可来源 |
| https://www.npmjs.com/package/@embedded-postgres/darwin-arm64 | embedded-postgres平台分发包装，包内LICENSE.md为MIT；原生PostgreSQL及依赖仍受各自许可约束 |
| https://www.postgresql.org/about/licence/ | PostgreSQL本体许可 |
| https://github.com/moodle/moodle/blob/main/COPYING.txt | Moodle许可正文核对入口；本目录LICENSE保存下载版本中的GPL正文 |

精确下载URL、实测版本与哈希见source.lock.json。没有复制学之思xzs、SurveyJS或其他调研项目的代码。当前没有产出带第三方运行时的离线发布包，也没有宣称完成第三方全部传递依赖的分发授权审计。
