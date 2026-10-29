# 第三方组件

独立代码复用已安装的成熟库，没有直接复制LiteLLM/Dify/RAGFlow等网关源代码。npm依赖按各自许可证使用，发行物重建依赖应保留它们的LICENSE；本表不改变原组件许可。调研保存的LICENSE仅用于核对，不表示全部已接入。

| 组件 | 锁定版本 | 包声明许可 |
|---|---|---|
| express | 5.3.0 | MIT |
| helmet | 8.3.0 | MIT |
| jose | 6.1.3 | MIT |
| zod | 4.6.7 | MIT |
| typescript | 7.0.2 | Apache-2.0 |
| tsx | 4.23.15 | MIT |
| undici | 8.12.3 | MIT |

固定依赖见package-lock.json；undici仅用于开发压力测试。完整平台许可证见research，未运行这些平台。
