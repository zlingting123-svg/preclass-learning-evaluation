# 第三方开源组件

本项目通过包管理器复用开源组件，不抹去原作者信息。npm包仍带各自许可证；本轮直接核对并额外保留的文本在docs/licenses/，版本和来源在packages.json。

| 组件 | 核对版本 | 许可证 | 用途 |
|---|---|---|---|
| bcryptjs | 3.0.3 | BSD-3-Clause | 口令hash/校验（既有） |
| helmet | 8.3.0 | MIT | HTTP安全响应头 |
| express-rate-limit | 8.7.1 | MIT | 登录整体/账号失败限流 |
| csv-parse | 7.0.3 | MIT | 保留字符串的名单CSV解析 |
| csv-stringify | 6.9.0 | MIT | CSV编码/转义/公式防护 |

既有React、Express、Zod、ECharts、路由等依赖仍按对应包许可证使用，完整版本以两个package-lock为准。本表不是所有传递依赖的完整法律清单；不代表本项目已选择整体分发许可证。没有将Moodle/Canvas源文件复制进本项目。调研候选和采用边界见docs/research/开源复用决策.md。

本轮问卷文件解析新增 SheetJS CE 0.20.3（Apache-2.0，官方CDN固定版本）与 word-extractor 1.0.4（MIT），原许可证保留在 docs/licenses/xlsx-LICENSE.txt、word-extractor-LICENSE.txt；未执行文件中的宏。
