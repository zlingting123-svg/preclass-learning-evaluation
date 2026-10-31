# 随机点名交互舞台

参考：https://dribbble.com/shots/26213578-Raffle-UI-Design （Joe Ben Taylor，抽取/停顿/揭晓节奏），https://icelam.github.io/project-details/random-name-picker/ （滚动名单）。代码为本项目独立实现，没有复制设计师素材或引入外站脚本。

RollcallStage组件只展示结果，随机仍由现有POST /core/rollcall负责。1/3/5人显示使用原返回students；后台候选范围、重复规则、请求幂等与历史都保留。最多18张背景卡片是当前范围名单的可视化样本，不是候选人数限制。学生数据不发给第三方。主题继承，CSS透视和动效无新库，减少动画时缩短揭晓。加载/错误/空名单、全屏与响应式均验证。

构建复用既有React和qrcode，puzzle.js依赖原attendance-preview/layout.js；build.mjs的环境路径需调整。部署以服务器20261031-course-review为基线，新增4资源、仅改index，后端和数据保持。current=20261031-rollcall-stage；回退只切current到20261031-course-review。模拟名单用于隔离测试，不是生产人数、无生产点名记录写入。
