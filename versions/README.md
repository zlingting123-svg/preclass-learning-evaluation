# 隔离版本目录

| 版本 | 内容 | 源码 |
| --- | --- | --- |
| 2026-10-29-v01-roster | 名单建号、多教师、首次改密基线 | [source](2026-10-29-v01-roster/source/) |
| 2026-10-29-v02-admin-integrated | 管理端整合与永久会话选项 | [source](2026-10-29-v02-admin-integrated/source/) |
| 2026-10-29-v03-server-adapted | 云服务器适配版本 | [source](2026-10-29-v03-server-adapted/source/) |
| 2026-10-29-v04-installer | 当前Ubuntu一键安装包源码 | [source](2026-10-29-v04-installer/source/) |

| 2026-10-30-v05-companion-module | 仅伙伴模块源码子集，不含网页 | [source与说明](2026-10-30-v05-companion-module/README.md) |

每版独立子目录，内有说明和源码哈希清单。以后新增版本应新建目录，不覆盖旧目录；只归档明确的Git提交，不递归复制整个versions目录。各版本运行数据库与凭据不上传，运行时必须指定独立DB_PATH与端口。当前根目录继续作为开发工作区，快照用于查看、复核和恢复。

v05依用户要求只归档模块相关源码子集，manifest.scope=module-only-subset；不是整站快照或可直接覆盖服务器网页的源码包。
