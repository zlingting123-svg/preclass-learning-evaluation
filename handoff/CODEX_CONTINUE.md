> **2026-10-30补充最终访问交付：** 域名/HTTPS上线后提供固定静态二维码，扫码与浏览器输入域名均进入统一登录页面。最终码指向正式HTTPS入口，不使用临时隧道或登录凭据；交付高清PNG/SVG并做真机扫码验证。此项纳入最后阶段，不改变原三阶段顺序，不提前采购或生成占位码。

## 2026-10-31 随机点名交互舞台已上线

参考Joe Ben Taylor抽签动效的节奏与Ice Lam随机点名项目的滚动交互，独立实现左侧3D名单卡阵→滚动减速→翻牌揭晓。跟随主站绿色/其他主题，支持1/3/5人、全屏、减少动态效果、加载/失败/空名单。抽取仍由原服务端决定；前端只展示接口返回，不上传名单到第三方，无新增依赖。右侧设置与历史逻辑保留，切班清理旧结果且抽取中禁用切班，原拼图/模糊滑杆保留。

current=`20261031-rollcall-stage`，前版`20261031-course-review`，只改index并新增4资源，其余3688文件不变；后端/数据库不改、不重启。隔离37人模拟单人/3/5人、错误/空班、全屏、减少动画、320–1024响应式通过，正式主站资源模拟登录/导航/主题验证通过，无正式点名测试记录。产品仍0.3。

## 2026-10-31 章节复习检索与登录布局修复已部署

针对已上传课件总结框架只返回目录信息的问题，新增按课程标题定位、整章章节结构及本章学习要点的提取式复习证据；仍限本班/全班已发布资料，未知章节不猜，生态环境部来源与冲突规则保留。模型按4–6分支归纳改写，禁止文件名、页码、逐页内容；课程来源元数据匿名化，普通问答输出在发送前隐藏文件名/页码并检查长段照抄，教师问卷分析流式输出保持。复习不再仅拿关键词前三片段。

登录页收紧标题、说明间距，功能改为签到点名/知识图谱/学生画像/知识库问答四模块2列排列，表单加宽；高清校徽保留。current=`20261031-course-review`，前版`20261031-cau-identity-hd`。只改4个既有文件、加4文件，其余3681保持；主站后端已安全重启，数据库和课件不迁移，知识图谱服务不重启。真实课件只读检索、隔离HTTP模拟模型和隐私分片测试、现有来源规则回归、浏览器响应式通过。真实付费模型调用0，未验证实际模型最终措辞；普通课程输出改为校验后发送，首段显示可能比原流式稍晚。产品仍0.3。

## 2026-10-31 校徽高清矢量升级

登录页校徽下方的课程名已删除，桌面组合校徽放大到430px。以学校官网视觉识别系统AI素材中121条矢量路径替换原242x74位图；SVG不含嵌入图像，不用AI生成图案。登录页及工作台完整校徽校名在深绿背景反白，无白底；手机仅徽，侧栏绿色徽保持。current=`20261031-cau-identity-hd`，前版`20261031-cau-identity-1`，只更新前端入口和4个新资源，后端数据库不改、不重启。正式资源哈希、健康、模拟登录和320–1024响应式通过。来源 https://www2023.cau.edu.cn/col/col10258/index.html ，原始3AI.rar内A1-1.01.ai页眉组合标志，来源SHA与提取方法见补丁source.json。产品仍0.3。

## 2026-10-31 校徽与登录页视觉优化已部署

工作台欢迎横幅和桌面登录页使用中国农业大学完整校徽/中英文校名，窄屏和侧栏仅校徽。按用户要求去除白底托盘，深色背景通过CSS改为浅色融入，浅色侧栏保留绿色；原PNG字节不变、不拉伸。登录页预览字样已清理。current=`20261031-cau-identity-1`，前版`20261031-attendance-blur`，知识图谱、签到等保留。正式资源哈希及健康通过，正式前端资源的隔离模拟登录与320–1024响应式检查通过，无正式业务写入、后端改动或重启。产品仍0.3。

## 2026-10-31 签到图片模糊调节已上线

知识图谱交互升级已完成后，新增教师签到页未签到区域模糊预览与0–32滑杆，默认14，按班级保存在当前浏览器；签到块清晰，全员解锁保留。图片由管理端「签到图片」上传，教师在签到页选用，已补充入口说明。37人模拟状态、刷新保留、缺块姓名、全员解锁及320/375/414/768布局验证通过。current=`20261031-attendance-blur`，保留3D知识图谱，后端/数据库不改、服务不重启。产品仍0.3。

## 2026-10-31 源文件交互知识图谱已部署

读取实际XMind的362主题、361原有关系，新增3D网络与大字结构图，支持搜索/聚焦/旋转/缩放/详情/全屏，移动端默认结构图。教师编辑发布和学生本班只读保留，原稿下载不变，无AI补写。current=`20261031-knowledge-atlas`，模块`knowledge-map-atlas1`，产品仍0.3、模块0.6.0扩展。16项Linux回归和主站隔离教师/学生/权限/编辑/原件/主题/响应式验证通过；正式资源哈希、健康及原始数据不变验证通过。仅主站入口和2个新增资源，主站后端、Caddy及其他功能未改。详情`docs/2026-10-31-知识图谱交互升级.md`。

## 2026-10-30 知识图谱0.6主站接入与教师编辑已上线

教师端/学生端左侧“知识图谱”入口已加入，复用主站登录并跟随主题。教师可编辑本人图谱的节点/层级、增删/撤销、保存草稿及按班级发布/撤回；学生仅查看有班级权限的发布版。XMind本地提取为独立编辑版，原件/原稿/PDF保留，不冒充完整XMind原位高级编辑器。学生写入、跨班和旧版本覆盖由服务端拒绝。

产品仍0.3，模块0.6.0+本项目接入扩展，current=`20261030-knowledge-map-v060`，上一`20261030-qa-readable`；代码`/opt/preclass/modules/knowledge-map-v060`，原3216/data沿用，主站后端及Caddy不改/不重启。仅主网页入口和2个新增JS资源，3668个既有文件保持；AI来源限制/中文回答、签到/问卷保留。16组Linux回归、真实主系统隔离31班权限/原件/编辑、多画布11页PDF及浏览器主站入口/免二次登录/主题/390宽度通过；无真实模型调用、无正式测试数据或新增公网端口。详情`docs/2026-10-30-知识图谱0.6教师学生接入.md`。临时测试服务与5200隧道已关闭，正式5173连接保留。源码移回维护中的TypeScript工程仍待专门对齐，不能以旧工程整站覆盖服务器。

## 2026-10-30 AI回答内部状态字段修复已上线

当前current=`20261030-qa-readable`，上一`20261030-retrieval-recall`。专业问答不再把documentStatus/unverified等内部状态枚举放入提示和证据元数据；中文说明区分官网来源确认与文件时效核验，省略空日期，必要提醒保持简短，不把未核实状态改成已核实。只改deepseek.js，其他3668文件保持，数据库/历史会话/前端不改写，作用于新生成回答；问卷分析消息保持原样。隔离HTTP/SSE、原问题检索上下文及来源门禁回归通过，正式服务健康，无真实模型调用。详情`docs/2026-10-30-AI回答内部字段修复.md`。

## 2026-10-30 官网资料漏召回与个案澄清修复已上线

“广西溶洞属于什么生态管控类型”原被检索阶段直接挡下；现已修正问句/简称、重叠分块、排序与具体实体语境补充，命中已缓存总纲HJ1430—2025分类条款及官网9月发布会广西溶洞整治正文。总纲是空间分区通用标准，不冒充溶洞专项标准；贵阳地方三分类为用户口述未核实，不能直接套广西。回答规则要求区分分类体系，有部分依据则解释可确定内容、补问洞名/位置/文件，不整体拒答也不猜归类。

当前current=`20261030-retrieval-recall`（上一`20261030-course-brand`），3个AI运行文件修改，其他3666文件保留，前端品牌不变；仅MEE白名单/上传资料与未知编号阻断保持。官网缓存40份、6h刷新/24h过期，新增两篇已核实溶洞整治正文，总纲固定预取并分别解析发布/实施日期。多证据保持原输入预算并去除重复来源，引用只列实际送入模型的片段。真实资料只读及隔离HTTP/SSE/mock回归通过；真实模型调用0次，不能冒称实际答案质量、全站实时检索或广西个案分类已验收。详情`docs/2026-10-30-官网检索漏召回修复.md`。

## 2026-10-30 课程名称统一已上线

登录页与登录后的“学习空间”品牌、欢迎语、进入按钮、页脚及浏览器标题已统一为“环境评价与管理”，学生角色描述改为“学生课程空间”。当前服务器current=`20261030-course-brand`，上一版`20261030-strict-evidence`；仅静态网页入口和新资源文件变化，AI严格来源及原功能保留。真实浏览器登录前后、320/390宽度检查通过。详见`docs/2026-10-30-课程名称统一.md`。

## 2026-10-30 AI问答严格来源限制已上线

专业问答仅使用已发布上传课件/资料及生态环境部官网 https://www.mee.gov.cn/ 的正文；固定mee.gov.cn白名单，其他政府网站/普通网站/第三方搜索摘要均不得作为依据。专业general_knowledge补答关闭；常见模糊学习问题给简短非专业建议，无证据明确不足。冲突优先已核实适用、生效且较新的MEE文件，草案、未来生效、未知有效状态不能冒充现行。官网已有限预缓存38份（含3份草案标记），6h刷新，24h过期排除，问答不临时等待官网抓取；不代表全站覆盖或全部法规现行状态已核实。

当前服务器current=`20261030-strict-evidence`；4个AI文件修改、1个检索文件新增，其他3662个应用文件保持哈希；原签到/图谱/问卷/资料库保留。隔离HTTP/SSE、无模型短回应/缺证据阻断、跨班/外站/伪造来源、缓存故障保留、问卷匿名分析分支通过；正式管理员读配置与健康检查通过。无真实收费模型调用，真实答案语义质量仍待教师案例验收；productionReady=false，ICP/HTTPS/公网真机验收仍独立待办。详情见`docs/2026-10-30-AI问答严格来源.md`。只同步交付分支，不合并main。后续必须基于服务器实际文件继续，不能用本地旧网页覆盖。

## 2026-10-30 知识图谱模块安装完成

独立知识图谱v0.5.0已安装，入口`/knowledge-map/`，使用已有教师或学生账号。当前服务器current为`20261030-knowledge-map`，原签到、问卷和资料库保留。已修复主系统班级分页兼容；Linux13组回归、真实主系统身份/31班分页、服务沙箱Office转换和浏览器原件/PDF下载通过。无正式测试图谱、无真实模型调用；不把安装完成冒充真实AI生成或公网真机验收。详细安装和回退见`docs/2026-10-30-知识图谱模块安装.md`。本次只同步状态，不合并main。

## 2026-10-30 签到与点名源码补全

已补齐ops/server-patches/attendance-preview内的独立合成预览、qrcode依赖与锁文件、用户指定雪山图片及依赖许可。真实模块源码、主题适配、人数自动布局和精简文案与已部署版本保持一致。可移植构建说明见ops/server-patches/20261030-attendance/README.md；build-portable.mjs构建产物SHA256与服务器部署组件一致。此同步不重新部署服务器、不合并main。其他电脑接续应读取此README及实际服务器current，仍需将限定运行补丁迁回维护中的TypeScript工程，不能以旧工程全量覆盖。

## 2026-10-30 当前执行状态：备案初审与统计优化

产品版本仍为 **0.3**，共享契约版本仍为0.5.0。更新日期2026-10-30（Asia/Shanghai）。

### 最新：模块1签到与点名已部署

# 模块1：拼图签到与随机点名（2026-10-30，产品0.3）

已发布服务器current：/opt/preclass/releases/20261030-attendance。上一版本/opt/preclass/releases/20261030-course-library，知识库、问卷分析与追问、统计优化均保留。只替换后台app.js以注册鉴权后的新路由、前端index.html以加载新入口；新增attendance.js及4个独立前端构建文件，其余3658项既有发布文件或链接逐项一致。没有上传本地旧整站页面，没有改动原AI配置或调用付费模型。

后续文案更新：用户要求删除宣传句，现current为/opt/preclass/releases/20261030-attendance-copy。仅更换签到组件JS，3664项其他发布文件或链接一致，无后台重启、无数据变更；已删除“每一位到来，都让风景更完整”“属于全班的共同风景”等文案，改用“拼图签到”“班级签到拼图”“扫码签到”“随机点名”。本机5197预览同步修改。下文记录首版模块发布基线。

## 当前整体四模块

1. 动态二维码拼图签到与随机点名：本次实现并部署；公网真机扫码仍待备案/HTTPS。
2. 知识图谱：独立模块v0.5.0已安装，入口/knowledge-map/；真实模型自动生成及手机真机仍待验证。
3. 学生画像（问卷及分析）：已有问卷、图表、匿名AI解读与追问；不因此声称画像体系完整校准。
4. 知识库（AI问答）：已有12份、1596页资料原文检索，原教材AI记忆保留；新增11份课件的付费全文摘要未启动。

## 使用与界面

- 刷新教师端，侧栏“拼图签到”进入/attendance，“随机点名”进入/rollcall；选择当前有权限的班级。管理员端“签到图片”进入/attendance-images，可上传、预览、启停JPG/PNG（不超过1MB），图片变更不改变已开始的场次。
- 已加入用户提供的雪山与花海试用图，原件SHA256为17828ccbba8b96cc323547427097ee4ce4fecb4acaa7218cdd9e9a8aa98ef240。未导入任何模拟学生、教师或签到场次到正式库。
- 用户明确要求“界面颜色要和网页主题适配”。正式React组件复用现有React并继承--pv-bg/panel/ink/muted/line/accent/soft；系统浅色、绿色强调及深色变体沿用原有主题，不强制独立冰蓝暗色。
- 教师创建签到时快照真实名单，一人一块，缺块可键盘/鼠标打开姓名和学号。按人数自动计算行列，必要时合并相邻双格，1–500人逐一验证恰好N块、无洞无重叠。无虚构占位学生，不固定为36或37人。
- 逐块飞入动画；未全员时图片模糊，全员到齐后清晰揭晓、轻微放大、粒子庆祝，支持reduced-motion。SVG完整雪山图保持原件，显示区域按布局裁切。
- 动态码每30秒更换，旧码/伪造码/旧场次拒绝。扫码访问/checkin?sessionId=...&ticket=...，未登录先进入已有登录页，登录后按实际学生身份确认；不能通过提交其他学生ID代签。二维码本身不保证本人到场，不包含定位或人脸验证。
- 当前仍为SSH隧道私有入口，组件会提示手机公网扫码需等待域名备案及HTTPS。未冒称真实手机扫码已验收。
- 点名由服务端crypto.randomInt抽取，可选全班/本场已签到/未签到，1/3/5人。默认本轮不重复，候选不足显式提示；可重置候选池且保留教师自己的历史。结果在服务端产生后播放姓名滚动和定格动画。

## 权限、持久化及接口

- 复用现有会话认证、教师班级授权、SqliteStore；AttendanceService保存attendance_session、attendance_image、attendance_create、rollcall_round、rollcall_result。秘密签名字段不返回页面，签到及点名请求幂等；新字段不需要SQL结构迁移。
- 教师只能查看/创建/结束自己获授权班级；学生只可按本人身份签到，不可读取名单/缺席情况/管理图片；管理员管理图片。当前已移出班级的学生拒绝签到，新增学生不加入旧快照，下一场按新名单重建。
- 管理图片：GET/POST /api/v1/admin/attendance/images；POST /:id/state。
- 教师图片：GET /api/v1/core/attendance-images；GET /api/v1/core/attendance-image-data/:id。均需管理员/教师权限，学生不开放。
- 场次：GET /api/v1/core/classes/:id/attendance；POST /api/v1/core/attendance；GET /api/v1/core/attendance/:id；POST /:id/close。
- 学生签到：POST /api/v1/core/attendance-checkin，body仅sessionId/ticket，身份由会话决定。
- 点名：POST /api/v1/core/rollcall；GET /api/v1/core/classes/:id/rollcall；POST /:id/rollcall/reset。

## 实际验证和边界

真实后台隔离验证.json包含12项授权、37人名单、二维码、幂等、移出/新增、SQLite重开后持久化、关闭和点名验证。真实页面浏览器验证.json包含服务器当前页面的真实导航、37块拼图、缺块姓名、未登录扫码→登录→本人签到→教师页实时归位、点名、320/375/414/768布局、37人全部HTTP签到后的揭晓和管理员真实图片上传。全部使用独立SQLite及明确模拟账号，AI为mock，未向正式库写入测试学生或答卷。

首轮浏览器仅因移动版侧栏隐藏而无法点击，改用真实“打开菜单”动作后通过；未删减移动断言。后台core测试先完成，真实页面补测管理员图片缩略图和完成动画后再发布。UI图片、二维码、名册无模拟结果冒充真实班级数据。

发布前主库在线备份/var/backups/preclass/before-attendance.sqlite并完整性ok，等待在途AI请求结束。正式后台及网关健康，管理员图片列表已鉴权核对，6个前端文件HTTP逐项SHA256匹配。productionReady仍false，备案/HTTPS、公网真机扫码尚未完成。

## 维护与回退

源码在work/attendance-module/AttendancePanel.tsx、attendance.css、attendance.js、puzzle.js，人数布局复用work/attendance-preview/layout.js。build.mjs和patch-main.py只针对本次实际服务器主包，不得盲套另一个构建；正式TS工程仍需从限定源码迁回其他电脑的实际工作分支，不能用旧工程全量回推服务器。

回退可将current切回course-library版并重启preclass-test.service，不整库还原、不删除已开始的真实签到/点名记录。完整证据见正式部署验证.json。隔离服务preclass-attendance-stage.service与本机5198专用隧道在验收后已停止；独立模拟预览127.0.0.1:5197仍可用于看动画，与正式系统数据隔离。


### 前期部署记录


### 域名与备案：已提交，等待腾讯云初审

- preclass-test.cn 已注册，根域名A记录此前已验证指向现有服务器。
- 用户2026-10-30提供的最新截图显示：首次备案已提交，当前处于“腾讯云审核中”，尚未进入管局审核。页面显示订单创建时间为当日12:50:59。不公开订单号、负责人身份或联系方式。
- 此状态取代此前“等待经费续费后继续备案”的阻塞描述；截图未提供续费订单信息，不据此推断实际购买时长或付款情况。
- 按页面提示等待腾讯云审核电话并按实际用途回答；后续关注提交管局、工信部短信核验及管局审核。当前未获得ICP备案号，正式域名HTTPS入口、公网与真机验收、固定二维码最终交付仍未完成。
- 本次仅同步备案进度，不修改服务器、不开放公网、不产生采购或新增付费AI调用。

### 已接入：GitHub课程资料库

资料库已于2026-10-30部署到服务器，产品版本保持 **0.3**，共享接口契约0.5.0。

- 来源：另一位开发者sufencyshao的course-materials-20261030分支，固定提交62aaaab45fdf064b308c32ce9bc53e1dc2586e55，仅新增资料，不包含现有服务器功能。仅接入其资料，不以旧分支程序覆盖服务器。
- 内容：11份课件和1份教材，共169249462字节、1596页；12份原件SHA256、大小及页数均核对GitHub manifest。原件保留原文件名，按页提取文字，48页经过OCR补充。抽查封面、图片页和课件正文渲染；原文、OCR与页码一并保留。OCR不等于完整理解图表、照片或公式。
- 去重：440页《环境评价教程》与服务器已有教材哈希一致，保留其原ID、737个检索片段、74段已完成的AI解读及发布状态，没有重复导入或计费。
- 新增11份课件已发布原文检索，管理员资料库可以查看和下载。其状态仍为waiting_ai，未自动生成付费全文摘要，不冒称ai_read_complete；“待AI解读”与“已可检索原文”是不同状态。已有教材的AI解读继续可用。
- 当前发布：`/opt/preclass/releases/20261030-course-library`，基线`/opt/preclass/releases/20261030-survey-stats-performance`。只修改knowledge-import.js，明确只取当前班级或__all_classes__共享且已发布的来源；新增后台资料发布清单，其余3658项发布文件或链接校验一致。既有问卷UI、追问、统计性能优化、账号和页面均保留，未上传本地旧网页。
- 访问范围：沿用服务器原有课程共享资料库。学员问答仍受真实账号和班级权限控制，管理员原件管理及下载接口对师生返回403。
- 隔离验收：12份资料列表、11组真实课程问题的非空检索、私有班级及撤回资料排除、师生管理权限拒绝、原件下载哈希、模拟问答确实收到这些资料片段均通过。显式模拟上游，不新增真实模型调用。此验收不代表教学结论正确率或完整检索质量校准。
- 线上验收：正式管理员登录后，12份资料列表和发布状态正确；逐份经鉴权HTTP下载核对12个原件SHA256；核验会话已退出。正式后台和网关健康，未生成正式测试学生或答卷，未开放公网端口。
- 发布前主库在线备份`/var/backups/preclass/before-course-library.sqlite`，完整性ok。回退可将current切回上一发布并重启preclass-test.service；如需撤回资料，仅撤回此次新增11个来源，不删除原教材、不整库覆盖用户业务记录。deployment.json保留新增ID和审计记录ID。

管理员登录现有服务器学习空间后进入资料库，应看到12份资料。课程问答会从已发布的原文片段检索，页面对来源名称的展示继续沿用服务器现有规则。

接下来应使用教师实际问题继续校准检索与回答质量，并由用户决定是否启动新增课件的付费AI全文解读。retrievalCalibrated与productionReady仍为false；ICP备案仍等待审核，域名HTTPS、公网/真机验收及固定二维码最终交付未完成。

GitHub此次在release/v0.3接入源资料的14个已有Git对象（12份PDF、README、manifest），同步任务书、验证和限定补丁，不合并main，不覆盖另一位开发者的原分支。服务器运行补丁仍需迁回其他电脑实际维护的TypeScript源码，再构建验证；旧PR或旧源码不能直接全量回推服务器。


### 已完成：服务器问卷解读、追问与统计性能优化

- 问卷AI解读及追问UI此前已基于服务器实际版本部署：Markdown排版、匿名汇总解读、多轮追问、教师/班级/快照隔离、过期快照拒绝和重复请求处理。此前用模拟问卷执行过1次真实分析及2轮真实追问；本轮不追加真实模型调用。
- 统计优化当时发布为 `/opt/preclass/releases/20261030-survey-stats-performance`（现已在其基础上发布课程资料库），基线为 `/opt/preclass/releases/20261030-survey-insights-followup`。本轮仅改变 `backend/dist/backend/src/questionnaires.js`，其余3658个文件或链接逐项校验一致。未覆盖其他电脑的页面修改，未上传本地旧网页。
- 将班级名单中的身份/账号重复全表读取改为每次请求内的一次索引，并按学生索引答卷。未改权限、统计口径、密码校验参数及数据库结构；不使用可能产生过期结果的跨请求缓存。
- 同一服务器、同一500人合成数据、7名教师并发、每版本21次真实Express HTTP请求：优化前P95为3607.24毫秒，优化后115.41毫秒；失败0，返回统计与AI解读快照完全一致。此比较使用内存SQLite和回环HTTP，不包括Caddy、真实公网或生产答卷。
- 补充验证身份表优先、账号回退、空/缺失值、重复记录首条语义、未开始/作答中/已提交、选填文本、空班、学生/无关教师权限拒绝，以及姓名和成员变动实时可见。
- 发布前主库在线备份并通过完整性检查；发布后正式后台与网页均健康。回退只需切回基线并重启后台，不还原数据库。详细结果见本次validation文件。

### 已完成：第一轮隔离整站压测

- 500个独立学生账号实际登录、开始与提交10题问卷，最高300个客户端并发提交，最终500份已提交；300次重复提交未生成重复答卷。
- 7个教师账号读取500人统计；300个学生AI请求通过显式模拟上游、上游并发池12。8阶段HTTP请求全部成功，真实模型调用0次，未向正式业务库写入测试数据。临时压测应用及网关已停止。
- 登录并发25时P95约7.96秒，完整统计优化前较慢。统计优化已完成；登录性能仍需后续独立分析，不通过降低密码安全参数追求表面速度。
- 这是同服务器经独立Caddy和独立SQLite的HTTP验证，不能据此声称公网HTTPS、真实设备或真实提供商容量验收通过。

### 接下来的顺序

1. 不依赖经费的工作：后续可分析登录高峰耗时、完善整套备份/恢复演练，以及将服务器限定补丁迁回实际维护的TypeScript工程。
2. 正式资料已由另一位开发者上传，12份已接入服务器；继续按实际课程问题完善检索质量和来源核对。导入完成不等于全部教学检索校准，productionReady和retrievalCalibrated仍保留false。
3. 等待腾讯云初审，按通知完成后续短信核验和管局审核；取得ICP备案后完成域名HTTPS和精确Origin配置，再做公网/真机与受预算约束的真实模型验收。
4. HTTPS登录入口可用后交付指向 `https://preclass-test.cn/` 的固定PNG/SVG二维码，并实测扫码与浏览器输入域名进入登录页。

### GitHub与服务器的边界

本次GitHub同步的是任务书、进度、验证证据及限定服务器运行产物补丁，未把服务器整站或本地网页上传。PR #12和原本地TypeScript工程仍不能冒充包含服务器最新UI及追问；下一位开发者应先读取current及其他电脑的实际源码，再迁回源码并构建验证。补丁位于 `ops/server-patches/20261030-survey-stats-performance/`，仅适用于验证结果中的固定基线和SHA256，不能直接套用于不同版本。

release/v0.3为既有交付分支，本轮不合并main，不保证历史PR自动无冲突。旧任务书中“AI解读尚为预留”“域名尚未购买”等文字是历史状态，以本次更新为准。AI自动出题与系统AI管理不因解读功能完成而自动标记完成。


## 历史任务与验收记录

以下保留此前安排和验收范围；当前状态以上述更新为准。

> **2026-10-30 用户明确下一步顺序：先开发AI问卷解读；完成后等待用户上传资料库，再进行资料接入/校准；最后购买域名、配置访问入口并进行整站压力测试。** 本次仅更新计划，不启动资料收集、采购、公网开放或压测。详见两份当前任务书与[0.3进度](../docs/项目进度-0.3.md)。产品版本仍0.3；共享契约0.5.0。

> **当前产品版本0.3（2026-10-29，用户指定）。** 共享接口契约0.5.0。真实DeepSeek、加密Key用途路由、统一登录、账号删除、个人中心和问卷数据舱已完成并在私有服务器部署；旧“尚未购买/AI未接入/个人中心未同步”等记录是历史阶段。先读[0.3进度](../docs/项目进度-0.3.md)和[0.3发布交接](RELEASE_0.3.md)。后台本轮94/94，AI20/20；公网HTTPS、检索校准、真机、整站负载仍未验收。

---

> **最新0.5.0管理员集中名单/首次改密/多教师班级已本地验证。** 当前feature/admin-roster-onboarding，入口仍5175/design-preview.html。先读[SERVICE_PREVIEW.md](SERVICE_PREVIEW.md)和本轮管理员名单说明；下文旧“教师导入/默认12345/单教师”不再适用于当前网页。后台70项和前端检查通过，本地未上传。

> **2026-10-29按用户截图纠正UI，本地完成。** 当前feature/service-admin-preview基于3ffef2e；正确入口5175/design-preview.html。原preclass-ai-integration的ef9adb6已被4b7af6d撤回；本轮直接保留其他工作者学习空间，管理功能嵌入同一pv布局，不用旧管理外壳。最新状态见[SERVICE_PREVIEW.md](SERVICE_PREVIEW.md)，不要依照下文历史独立管理端重新制作。

> **2026-10-29 独立管理员端。** 用户明确选择管理员而非教师工作台，并在手机微信无法访问后要求暂停二维码/局域网调试，等买服务器再做。已撤销临时0.0.0.0前端监听、恢复127.0.0.1，未关闭防火墙；二维码/生成器只留本地outputs和integration/work/paused-lan，不作课堂可用结果，不继续询问手机测试。
>
> 任务分支feature/admin-console基于design/commercial-preview@61751cc。新增backend/src/admin.ts、管理员API、前端AdminPage与样式；原登录页/admin和商业预览均支持管理员分流。账号创建/搜索/角色筛选分页、姓名/启停、重置/撤销会话、全局概览、班级/教师/批次资格明确授权、成员调整、审计同事务已实现。管理员网页不可提权/维护管理员账号；私密模拟管理员demo_admin凭据只在本机work和用户outputs，不上传。
>
> 本机后台check/build、40/40测试、smoke；前端check/build、生产限制3项；管理员真实隔离Express/SQLite浏览器5项、320/375/768布局通过，无pageErrors。已加入CI步骤，远端结果需另查，不把本地通过当Actions结果。更新日志/2026-10-29-独立管理员端.md有总结、截图和证据，docs/integration/管理员接口交接.md有接口/权限说明。未部署、未真实AI/真机/300人压测。核心0.4.0兼容保留，管理员API为增量路径。
>
> 同事另有origin/feature/student-conversations（5775779）未合并，本轮不覆盖其会话工作；后续合并应核对auth.ts会话epoch、预览入口及管理员分流。下一步先审PR和测试，服务器确定后再处理正式HTTPS网址/二维码，不自动购买或部署。
> **2026-10-28 更新日志归档。** 用户要求上传GitHub并将本轮总结放入更新日志文件夹。仓库新增“更新日志/README.md”索引、“更新日志/2026-10-28-商业界面与AI对话预览.md”，及日期子目录内的本项目三种配色、桌面/手机对话截图与真实HTTP/UI模拟两类验证记录。无口令、令牌、真实学生数据或数据库。继续使用design/commercial-preview和草稿PR #5，未合并main、未替换主界面、未部署；后续先看本轮日志再等用户确定外观。
> **2026-10-28 外观试版，待用户选择。** 用户认可基本框架，要求商业化视觉、参考截图和主流AI对话布局。新任务分支design/commercial-preview基于feature/core-questionnaires@2f493d6；新增frontend/design-preview.html、frontend/src/preview/和预览验证文档，原App/Core/后台/共享契约未改变。入口http://127.0.0.1:5173/design-preview.html，现有模拟账号登录，内存路由复用原业务。三种可切外观：紫蓝商业/深绿专业/石墨科技。对话有窄导航、会话列表、欢迎/建议问题、底部输入、失败重试/复制/停止。AI真实接口仍503，不制造回答。
>
> 当前已通过frontend check/build、实际HTTP班级/问卷读取、未接入/重试无重复、会话切换、320/375/414/768工作台及对话检查，另用明确UI模拟验证换行/复制/停止/成功消息；pageErrors为空，不是AI/生产/真机/并发验收。截图和对照HTML在本次聊天outputs，说明见frontend/verification/2026-10-28-ui-preview.md。Disco/Chatbase公开参考截图已取得，DeepSeek仅登录、Qwen无完整稳定截图，未伪称抓到聊天界面。
>
> 下一步等用户选择外观再接入原主页面，不自动覆盖index/App或合并main。预览会话仅当前页面/模块内存，刷新/离开不保留。此为独立设计预览，生产构建仍原核心版本，AI接入仍按既有交接。
> **已核实远端验证：** a138f3ba01ed89e15701363fdecf72c26d4a70c9 的GitHub Actions运行40691567935最终success，包含后台35项、smoke、前端构建、生产限制和新HTTP浏览器8项。首次40691167645的smoke无日志失败原因仍未确定；补充安全阶段日志后本机和此轮CI通过，不声称已证明消除了首次根因。本次收尾另加“先清除历史browser JSON”的CI证据保护，避免后端失败时回显旧成功。后续若重现smoke失败，按阶段日志查证，不删断言或加盲目重试。
> **本轮GitHub：** 草稿PR #4 https://github.com/zlingting123-svg/preclass-learning-evaluation/pull/4 ，feature/core-questionnaires → integration/learning-platform，未合并main。功能提交b2b52d0、CI安全诊断提交a138f3b均已通过GitHub API核实上传（Git传输不通时，Git Data API验证tree/commit SHA后force:false更新）。首轮40691167645后台35项通过，smoke步骤失败且无诊断，不能报远端成功；当前进一步核查新提交，最终状态以Actions实际结果为准。不要将被跳过的浏览器步骤或仓库历史JSON当成本轮远端通过。
> **2026-10-28 最新：核心问卷 v0.4.0。** 用户提供《更新要求.md》并要求按 GitHub 最新项目修改。本轮基于 origin/integration/learning-platform@3d48082 新建 feature/core-questionnaires，正确本机目录为本聊天 work/core-questionnaires；不要回到旧 oss-foundations 或覆盖同事工作区。实现问卷编辑/发布、教师网页名单预览/确认、doc/docx/xls/xlsx/csv识别、服务端截止与时长、全班完成情况/只读答卷/逐题统计及AI助手。旧评分/复核/画像/课程导读等不再进入当前路由，历史代码与数据保留供追溯。
>
> 新导入学生按新需求默认12345，旧账号不重置；原CLI随机口令策略未改。AI由另一位同学实现，本轮chat/generate/insights均明确503未接入，不伪造结果。共享契约0.4.0；需求差异见docs/需求/2026-10-28-核心问卷改版.md，接口交接见docs/integration/AI接口交接.md。
>
> 已验证：后台check/build、35/35测试、smoke；前端check/build、生产限制3/3、新HTTP浏览器8/8、320/375/414/768无页面横向溢出；DOCX自建表格、XLS/XLSX/CSV自动测试，DOC上游本地样例188字符/3行。Word空单元格保护修复后再次check/build及8项新后台测试通过。旧24项HTTP与旧mock未作为新路由验收，不要相加。证据integration/verification/2026-10-28-core.md与core-browser.json。
>
> 后续先核对本任务分支及GitHub PR；AI同学接三处预留接口，教师使用真实脱敏文件试用导入；复杂排版/图片/加密不保证自动恢复，须预览确认。尚无首次改密/找回、真实AI、云部署、真机或300人压测；不要自动合并main/采购/上线。原资料、数据库与Moodle未删除。

---
> **GitHub同步完成**：实现提交c60cc6a已推送origin/integration/learning-platform；草稿PR #3 https://github.com/zlingting123-svg/preclass-learning-evaluation/pull/3，目标backend/oss-foundations，包含原PR2样板成果并迁入React。PR1/PR2保留，main未合并。提交后46个文件范围与本机私密口令扫描通过，无work/node_modules/dist/数据库。远端CI需按PR当前head查验；下方24/27是本机证据，不能替代远端结果。

> **最新接续：2026-10-28 React/Node学习平台集成已实现并本机验证。** 用户明确确认React/Node为集成目标，保留Moodle对照。任务分支integration/learning-platform合入原backend/oss-foundations@22be3d4与prototype/moodle-minimal@b7047a6，仅接续文档冲突已保留双方记录。新增shared/learning.ts/profile-schema.ts、后台learning.ts及权限路由、React画像/教师阅读/课程材料、深绿布局、显式sample-seed。契约0.3.0兼容旧作业/名单API，未将两个数据库合并。
>
> 实际验证：前后端build、后台27/27、smoke、生产配置3/3、显式mock、真实HTTP浏览器24/24通过；最终pageErrors/unexpectedHttp为空。CUA1280/375真实查看；001001保存3题、teacher_a读取相同3题；375画像/教师无溢出，控制台无warn/error。完整证据integration/verification/2026-10-28-learning-platform.md与当日HTTP JSON和screenshots/2026-10-28-platform。新增回归覆盖冲突保留/载入、未保存链接离开提醒、返回页面不被已保存内存缓存遮蔽别处更新、材料发布与HTML文本渲染。未做正式评分、真机/并发/云部署。
>
> 启动：根目录python3 integration/sample.py start（或integration/打开学习平台.command）；停止同脚本stop。127.0.0.1:5173/3001；已实际stop/start保留数据。账号仅在backend/work/platform-sample/测试账号.txt（学生001001/教师teacher_a等，随机私密口令）。原独立下载预览进程已停止以释放同端口，文件和数据库保留；Moodle8873仍可对照。无生产账号，不能共享work。
>
> 下一步：先核对本分支/远程PR与集成证据；不要用旧下载源码或0.2.0覆盖。继续完善经过授权的React主系统，Moodle仅参考。教师画像摘要分页、详情按需读、搜索只当前页；CSV全班。课程材料新建/发布，发布后只读；尚无材料草稿编辑页面（API支持更新）。画像仅部分草稿不评分，11题待确认。原账号生命周期/正式规则/云运维事项仍按下文，不自动合并main或上线。
>
> 新对话：请读AGENTS.md、handoff/CODEX_CONTINUE.md顶部、docs/integration/2026-10-28-learning-platform.md与集成验证，核对integration/learning-platform及PR。保留三份本机数据库（React主样板、旧下载、Moodle），从已验证24项HTTP与27项后台继续，不重建框架、不宣称生产验收。

---

> **2026-10-28 集成进行中。** 用户已确认以React/Node为主，将本轮布局、画像、导读和测试练习移植，Moodle样板保留对照。任务分支integration/learning-platform基于prototype/moodle-minimal合入backend/oss-foundations@22be3d4；仅接续文档冲突，双方记录均保留如下。当前尚未完成迁移和验证，不将旧验证当成新集成验收。下一步：新增受权限保护的画像/课程材料接口、React页面与课程导读例题的显式模拟发布，复用原作业和名单权限。前后端各自npm工程，运行数据库仍不进仓库。

## React/Node此前接续记录

> **2026-10-28 接续进行中：用户已确认继续 React/Node，Moodle 只作参考样板。** 已通过 GitHub 实时核对 PR #1（head 4e15d02）与同事草稿 PR #2（head 1422d90，base backend/oss-foundations）。PR #2 新增独立 Moodle/PHP 目录，没有改 frontend/backend/shared；没有 Node API 适配或双库同步，便携启动器只验证 macOS arm64。本机没有安装或运行它，也没有合并任何 PR。
>
> 本轮已完成：v0.2.0 前端 API、教师批次筛选/按授权批次建班、学生按批次选班与任务隔离、保留旧无批次班级；创建/加入后自动定位对应班级，空筛选不查全部作业。Windows GitHub Actions 检查已加入，使用固定官方Action提交、只读权限与runner现有浏览器，没有秘密或部署步骤。后台 check/build/22 tests/smoke、前端 check/build/21 HTTP/3 config/mock 冒烟本机通过；已查看教师320px、学生375px批次截图。远端CI状态待推送后核对。差异与完整证据见integration/verification/2026-10-28-cohorts-ci.md与2026-10-28-http-browser.json。正式评分/云/真机/300人/名单Web管理权限仍未解决。当前工作区沿用下方 oss-foundations；同事分支只在独立只读审查 worktree 中查看。
>
> 下一步：先读取本轮验证记录和最新GitHub状态，再审查账号生命周期方案，补首次/主动改密、管理员受控重置及会话失效；不要恢复旧撤回草稿。名单网页操作者范围、问卷11道未定题型/必填/量表锚点、正式评分规则仍需用户提供；按教学条件逐步推进，不自动迁移Moodle或合并main。本机集成修改说明已写在本机维护文档，未代写同事FRONTEND交付单。
>
> CI最终修复补充：39503bb运行40648068561曾完整success，但6d28a1a运行40648409721又暴露分页时序问题（第2页标签短暂配旧页20条）。现已修改TeacherSubmissionsPage，让响应assignmentId/cursor匹配当前查询才展示；补受控延迟与MutationObserver验证整段切页不混用旧列表，本机check/build、配置3项、CI=true HTTP21通过。未删断言、未加自动重试，最终远端结果查当前Actions；最早d24aa96第8项附近的无诊断失败原因仍未定。Git传输失败时以同域Git data API逐层验证SHA、force:false推进，未强推或记录凭据。

> **2026-10-27 22:56本轮收尾：用户明确要求最后5%额度先上传收尾，停止新增功能。** 代码提交d01415d、a939ac9已推送origin/backend/oss-foundations，草稿PR #1：https://github.com/zlingting123-svg/preclass-learning-evaluation/pull/1；main未合并。当前正确工作tree为本聊天work/oss-foundations，原项目工作区backend/cohorts-roster保持不动。新对话继续必须先核对这个任务分支，不把旧目录v0.1.1覆盖回来。
>
> 已核对20个上游仓库，接入Helmet/express-rate-limit/csv-parse/csv-stringify并保留实际许可证；新增批次/教师班级授权、字符串学号CSV预览/冲突/指纹确认、私密随机初始口令、跨期账号复用和事务回滚CLI。契约v0.2.0兼容旧客户端。backend check/build、22项测试和smoke通过；现有frontend check/build、18项HTTP、3项构建限制回归通过。
>
> **未完成的改密草稿已按本轮收尾撤回，恢复已验证提交；撤回后backend check再次通过。** 尚无首次强制改密、找回或改密API，不要误接不存在接口。CI工作流也未添加或运行。新批次/导入前端UI未实现，4次作业仍只是计划字段；画像题型/锚点/必填、正式评分、云部署/真机/300人仍待后续。500行只做名单解析预览，非500账号创建或压测。无真实学生名单、口令、数据库上传。
>
> 实际交接看BACKEND_DELIVERY.md、backend/ROSTER.md、backend/verification/2026-10-27-oss-foundations.md、docs/research/开源复用决策.md。下一阶段：先审阅PR并和同事对齐v0.2.0，再定点实现前端批次/导入权限流程、成熟账号生命周期、问卷组件；不能从旧框架重建。不要自动合并main或对外部署。GitHub连接器PR写入403已通过本机现有GCM凭据在内存请求同域API解决，没有记录或输出凭据。

> 最新教学需求补充（2026-10-27）：已加入docs/需求和docs/资料，课程“环境评价与管理”，每期500人、7位教师、每人4次作业，按学号导入并按教师班级隔离；原Word18题画像已留存和提取。读最新需求与待开发清单再继续。运行契约仍v0.1.1，未做新的课程评分、导入或并发验证。

> 当前协作方式更新（2026-10-27）：由本机Codex和同事Codex通过GitHub任务分支/PR协作，DSH不再承担新任务。同事当前入口为02_Codex同事任务书.md、FRONTEND_CONTINUE.md和FRONTEND_DELIVERY.md。以下保留真实的上一轮集成记录；其中“未使用Git/本机绝对路径”是历史信息，当前分支和同步状态以git status、git log及远程实际状态为准。

# Codex接续任务记录

更新时间：2026-10-27 19:08（Asia/Shanghai）。角色Codex。契约v0.1.1，本地集成版0.1.0；未使用Git、无分支/提交。
项目：C:\Users\96496\Documents\Codex\2026-10-27\wo-2\outputs\课前问答项目。

## 当前结论

DSH已正式交付并冻结前端，用户授权Codex继续集成。本地前后端HTTP集成及必要修复已完成；后台10项业务测试、18项真实HTTP浏览器测试、3项生产构建限制及显式mock冒烟通过。**不是正式云部署、真实模型评分、两个真实设备或300人压测通过。**

保留：用户一人管理，Windows/Android/MagicOS/iOS，最多300人集中提交，一年约5000元；教学题目、正式评分规则/聚合与全年用量由用户提供。不采购/对外发布，不发明教学标准，不将测试Scorer和截图当正式结果。源码仍在原项目，当前聊天outputs仅交付快照与说明。

## 已完成（不要重建）

- backend独立npm工程：bcrypt认证/SQLite持久会话/注销、服务端角色与班级权限、班级/加入、作业草稿/发布/关闭/首次规则绑定、草稿版本检查、完整答案幂等提交及原子建任务、报告/汇总/CSV。
- 持久任务租约/旧worker防覆盖/3次尝试退避/人工重试/结构校验、复核系统原分和审阅历史、本地在线备份与独立恢复副本。正式Scorer仍未配置，无规则awaiting_rubric且报告null。
- shared v0.1.1：新增仅教师可见joinCode?；shared/package.json ESM标记解决包外NodeNext发射问题，不可遗漏。
- DSH前端已交接，Codex完成必要修复：教师加入码显示/复制；3001代理/5173严格端口；默认http、生产禁止mock/非法模式、构建无模拟登录数据；favicon。
- 完整请求/幂等键在失败重试期间冻结；提交等待在途保存、保存期间新输入不假称已保存；冲突保留本页输入并显式加载服务器草稿；401重登恢复同用户/作业内存输入，CSV401统一注销。
- 答卷概览上一页/下一页，元数据游标完整读取；发布后规则选择和首次绑定；复核理由必填；刷新任务/作业/提交列表/报告；图表范围校验。
- Vite文件范围只允许frontend/shared，拒绝backend/work/环境/凭证文件，避免开发服务器暴露数据库。
- 前端旧依赖审计报告5项，升级ECharts6.1.0、router7.18.4、Vite7.3.7、React插件5.1.1；React18.3.1保留，最新审计0已知漏洞。没有使用audit fix --force。
- 未改DSH_CONTINUE/DSH_DELIVERY，它们保留集成前记录。当前结果以本文件与integration/verification为准。

## 文件与证据

- integration/LOCAL_RUN.md：本地启动和重现命令。
- integration/COMPATIBILITY.md：差异和修复历史，顶部是最新状态。
- integration/verification/2026-10-27-integration.md：最终本地验证及限制。
- integration/verification/2026-10-27-http-browser.json：最终18/18；其他JSON分别记录生产配置、依赖审计和mock冒烟。
- integration/test/http-browser.mjs、build-config.mjs、mock-smoke.mjs：可重现脚本，无固定真实口令。
- integration/verification/screenshots：两张代表性本地HTTP截图；已查看教师320和学生报告375，无主要控件重叠，但窄屏表格会折行，不代表真机可用性结论。
- backend/verification/2026-10-27-local.md：后台基础和本地恢复证据。
- frontend/verification：DSH历史mock证据，32项不能合并当HTTP/上线结果。

## 实际命令与环境

Windows PowerShell，Node24.15.0、npm11.12.1，本机Chrome（Playwright-core1.64.1；可用BROWSER_PATH指定浏览器）。不在根目录装npm，不建workspaces。
backend：npm ci；npm run check/build/test/smoke（最后四条本轮均通过，test10/10）。npm start默认127.0.0.1:3001；npm run dev用于watch。构建入口dist/backend/src/server.js，配置不自动读.env，详见backend/README。
frontend：npm ci；npm run check/build；npm run test:config（3项通过）；npm run test:integration（18/18通过）；npm run test:mock（显式模拟冒烟通过）；npm run dev固定127.0.0.1:5173。生产构建有ECharts约503kB包体提醒，无构建错误。npm run dev:mock才显式演示。
当前测试脚本结束自动关闭临时前后端；手动启动前需确认端口空闲。生产预览只有静态文件，不自带API代理。
账号：无默认真实账号，按backend/README用user:create，USERNAME/DISPLAY_NAME/ROLE为环境变量，口令安全stdin；学生teacher各自创建。测试账号和随机口令仅在隔离backend/work数据库。
令牌与恢复输入都只在当前标签页内存，按用户/作业隔离；整页刷新会丢失未保存输入和会话，显式退出清空缓存。不要将这种恢复能力声称为跨设备持久草稿。

## 已知边界与未完成

- 真实正式规则受控导入、规则评分/总分聚合、AI适配/材料隔离/prompt/预算、真实模型限流超时和教师样本均未完成。测试Scorer的5/10和复核8/10仅验证软件结构。
- CloudBase/云身份认证/数据库/索引分页/共享限流/HTTPS/域名/费用提醒/运维诊断均待实施。本地SQLite分页前读取集合不证明云端性能，production后台明确拒绝启动。
- 300独立账号集中提交未执行；21份模拟答卷只验证列表分页，小规模同账号请求只验证幂等。无300人成功率/速率/延迟结果。
- 独立浏览器上下文在同一电脑，非两个真实设备。Android/MagicOS/iOS和真实Windows用户试用、移动网络性能待验证。
- 本地备份恢复通过，云端备份/恢复/一年后数据安排未完成；取消信号不保证第三方模型不计费。
- 无正式访问网址、云资源采购或发布操作，整体项目仍部分完成。

## 下一步

1. 先核对本文件、INTEGRATION及实际源码，沿用已验证接口/页面，不再重复从框架开发。DSH如需继续，先读本轮差异与证据再定点修改，避免双方同时改frontend。
2. 用户提供真实题目/参考答案/维度分值/2–3匿名评分样本与全年规模后，实现受控规则配置和正式Scorer/聚合；保留无规则awaiting_rubric行为。
3. 根据账号主体和约5000元预算评估CloudBase最小认证/数据库/HTTP/权限样例，确认平台条件与计费，不直接购买或发布。
4. 获授权配置真实测试云环境后验证存储/权限/恢复、两个真实设备，再制定300独立账号并发窗口和模型消耗方案；本机测试结果不能代替。
5. 用户参与代表性设备试用，修复相关缺陷后只重测相关项，最终更新云部署、备份和一年运维说明。

## 新对话启动语

请读取本项目AGENTS.md、01_Codex任务书.md、这份CODEX_CONTINUE、当前shared和integration/verification/2026-10-27-integration.md，核对实际源码再继续。本地前后端HTTP集成已通过18项浏览器测试、后台10项测试和构建检查，不要从头重写；正式规则/云端/300人/真机仍待完成。保留用户和DSH已交付修改，不把模拟评分或截图当上线验收。


## Moodle对照样板此前接续记录

> **最新接续：2026-10-28 发布测试内容。** 用户要求发布例题供测试；本机A/B班各新增导读+校园环境观察/证据与观点两道虚构练习。脚本moodle-sample/scripts/publish_test_content.php可重复运行，按cmidnumber去重、无覆盖；不计分、无截止日期、不占正式4次计划。任务中心增加page材料入口。学生001002已验证阅读和进入编辑器，未代提交，浏览器留在导读。原11/25/数据库回归通过。证据verification/2026-10-28-content.md。启动后可手动运行发布脚本，新机器不会自动发布。其余分支、权限、真实数据及上线边界仍见下文。

---

> **最新接续：2026-10-28 前端第二轮细化。** 用户同意继续学习平台设计。plugin/index.php、profile.php、reports.php、ui.js、styles.css增加可填写题筛选、未填题定位、矩阵分项进度、教师已有答案筛选，压缩课程与手机首屏。实际verify：11/11、25/25与数据库断言通过；浏览器7/18题切换、未填题聚焦、答案筛选恢复和375无横向溢出通过，证据moodle-sample/verification/2026-10-28-focus.md。缓存须运行work/runtime/php work/moodle/admin/cli/purge_caches.php（相对moodle-sample）。保持原React/Node与共享契约不变，任务分支prototype/moodle-minimal/草稿PR2，未上线、未合并。启动及未测边界见下文。新对话先读本段和UI_DESIGN.md，从已有插件继续。

---

> **最新接续：2026-10-28 学习平台界面交互与布局。** 用户要求去掉面向使用者的Moodle名称，统一叫“学习平台”；核心技术与第三方许可在技术资料中保留。任务分支`prototype/moodle-minimal`，草稿PR #2仍依赖`backend/oss-foundations`。原React/Node、共享契约v0.2.0不变。
>
> `moodle-sample/plugin`完善任务中心真实作业/画像状态、课程搜索与批次筛选，画像7题填写进度/题目导航/未保存提醒/冲突提示，教师画像搜索、展开和手机布局。校验失败保留其他有效输入。登录页及学生/教师主要流程采用“学习平台”品牌：`scripts/branding.php`以站点设置与语言覆盖，不改核心，`plugin/branding.css`负责登录样式，`scripts/sample.py start`同步配置。仍只接受模拟数据，正式规则和11题题型未定。
>
> 本轮 `sample.py verify` 实际题型11/11、HTTP25/25及数据库断言通过；真实浏览器验证学生进度/保存、课程筛选、教师搜索与展开，1280/375视口检查；375画像、报告、任务及原生作业无横向溢出。教师打开原生作业后会出现另一条新建记录，旧数据库断言按assignment索引覆盖已提交记录导致误报，现用唯一id索引并重跑通过，未改写/删除数据。详情和截图`moodle-sample/verification/2026-10-28-ui.md`。
>
> 原生作业/登录等主要页面已检查可见文案无Moodle字样，未审计所有后台页面及其他语言。未测试真实手机、所有浏览器离开提醒、300/500人并发或生产环境；无正式评分、真实数据、云部署。教师搜索仅筛选本页加载的数据。继续前核对实际分支、PR远程和文件；不要自动合并main或上线。
>
> 启动、停止及随机模拟账号见`moodle-sample/README.md`；不得上传work数据库、日志、密码。新对话：请先读本文件顶部、AGENTS.md、moodle-sample/UI_DESIGN.md和2026-10-28-ui验证，核对任务分支和PR，保持原系统并接续样板，不将模拟、浏览器视口或历史结果写成正式验收。

---

> **最新接续：2026-10-27 Moodle最小样板**。用户要求按Moodle及仓库最新内容制作样板，并已邀请GitHub账号sufencyshao；邀请已接受，实查push=true、admin=false。
>
> 已上传实现提交`fd2d6d0`，草稿PR #2：https://github.com/zlingting123-svg/preclass-learning-evaluation/pull/2，目标分支`backend/oss-foundations`（依赖PR #1），未合并main。Git首次推送缺少凭据助手，后用已登录gh的临时credential helper完成，未修改全局Git配置或输出凭据。
>
> 当前任务分支`prototype/moodle-minimal`，从最新`origin/backend/oss-foundations@4e15d02`（契约0.2.0、草稿PR #1尚未合并）创建。原frontend/backend/shared业务源码保持不变；本轮新增`moodle-sample/`及文档入口。原React/Node历史验证不是本轮重跑结果。
>
> 已安装实际Moodle **5.3+ (Build: 20261021)**、官方简体中文包；新增local_preclass_sample插件。仅本机macOS arm64，便携PHP8.4.1、PostgreSQL18.4，127.0.0.1:8873/55439。两教师、两班、四模拟学生，跨期同账号，两班各一份第1次原生文字作业；其余三次仅计划。18题保留原文、7题开放草稿、11题题型待确认，不猜必填/量表锚点、不生成画像分或作业数字成绩。学之思仅作交互参考，未复制或双系统对接。
>
> 验证：题型11/11、真实Moodle HTTP21/21，独立数据库确认submitted>=1、数字成绩0、画像草稿>=2、001001单账号跨期选课2。浏览器375与1280宽度已查看且无横向溢出，非真机。启动/停止/重启保留数据。证据`moodle-sample/verification/2026-10-27-local.md`和同目录JSON/截图。未执行云部署、并发、真实评分、真实学生导入或生产备份验收。
>
> 启动：仓库根运行`python3 moodle-sample/scripts/sample.py start`，或双击`moodle-sample/打开样板.command`；访问http://127.0.0.1:8873/local/preclass_sample/index.php。模拟账号随机口令仅在本机`moodle-sample/work/private/演示账号.txt`；不要上传work、口令、日志、数据库。停止`python3 moodle-sample/scripts/sample.py stop`，验证`python3 moodle-sample/scripts/sample.py verify`。启动器目前仅测试macOS arm64，需要Python3.12+和Node；未用Docker、未改系统配置。
>
> 继续先读`moodle-sample/README.md`、`MAPPING.md`、`NOTICE.md`及`source.lock.json`，核对实际分支和远程。PHP是旧补丁、Postgres分发包装有beta标记、PHP开发服务器仅实验；插件缺少privacy provider和课程备份恢复API，不可填真实学生数据。下一步先确认Moodle主系统和每班一课程，再补11题设置、生产账号/名单导入/隐私备份及正式评价规则。不要自动合并依赖PR、main或对外部署。
>
> 新对话启动语：请读取AGENTS.md、handoff/CODEX_CONTINUE.md顶部与moodle-sample/README.md，核对prototype/moodle-minimal及依赖backend/oss-foundations@4e15d02。保留原React/Node和已有模拟数据库，从实际Moodle样板继续；先核对11/21/数据库证据及最新PR状态，不重建框架，不把样板当上线验收。

---

> **2026-10-27 22:56本轮收尾：用户明确要求最后5%额度先上传收尾，停止新增功能。** 代码提交d01415d、a939ac9已推送origin/backend/oss-foundations，草稿PR #1：https://github.com/zlingting123-svg/preclass-learning-evaluation/pull/1；main未合并。当前正确工作tree为本聊天work/oss-foundations，原项目工作区backend/cohorts-roster保持不动。新对话继续必须先核对这个任务分支，不把旧目录v0.1.1覆盖回来。
>
> 已核对20个上游仓库，接入Helmet/express-rate-limit/csv-parse/csv-stringify并保留实际许可证；新增批次/教师班级授权、字符串学号CSV预览/冲突/指纹确认、私密随机初始口令、跨期账号复用和事务回滚CLI。契约v0.2.0兼容旧客户端。backend check/build、22项测试和smoke通过；现有frontend check/build、18项HTTP、3项构建限制回归通过。
>
> **未完成的改密草稿已按本轮收尾撤回，恢复已验证提交；撤回后backend check再次通过。** 尚无首次强制改密、找回或改密API，不要误接不存在接口。CI工作流也未添加或运行。新批次/导入前端UI未实现，4次作业仍只是计划字段；画像题型/锚点/必填、正式评分、云部署/真机/300人仍待后续。500行只做名单解析预览，非500账号创建或压测。无真实学生名单、口令、数据库上传。
>
> 实际交接看BACKEND_DELIVERY.md、backend/ROSTER.md、backend/verification/2026-10-27-oss-foundations.md、docs/research/开源复用决策.md。下一阶段：先审阅PR并和同事对齐v0.2.0，再定点实现前端批次/导入权限流程、成熟账号生命周期、问卷组件；不能从旧框架重建。不要自动合并main或对外部署。GitHub连接器PR写入403已通过本机现有GCM凭据在内存请求同域API解决，没有记录或输出凭据。

> 最新教学需求补充（2026-10-27）：已加入docs/需求和docs/资料，课程“环境评价与管理”，每期500人、7位教师、每人4次作业，按学号导入并按教师班级隔离；原Word18题画像已留存和提取。读最新需求与待开发清单再继续。运行契约仍v0.1.1，未做新的课程评分、导入或并发验证。

> 当前协作方式更新（2026-10-27）：由本机Codex和同事Codex通过GitHub任务分支/PR协作，DSH不再承担新任务。同事当前入口为02_Codex同事任务书.md、FRONTEND_CONTINUE.md和FRONTEND_DELIVERY.md。以下保留真实的上一轮集成记录；其中“未使用Git/本机绝对路径”是历史信息，当前分支和同步状态以git status、git log及远程实际状态为准。

# Codex接续任务记录

更新时间：2026-10-27 19:08（Asia/Shanghai）。角色Codex。契约v0.1.1，本地集成版0.1.0；未使用Git、无分支/提交。
项目：C:\Users\96496\Documents\Codex\2026-10-27\wo-2\outputs\课前问答项目。

## 当前结论

DSH已正式交付并冻结前端，用户授权Codex继续集成。本地前后端HTTP集成及必要修复已完成；后台10项业务测试、18项真实HTTP浏览器测试、3项生产构建限制及显式mock冒烟通过。**不是正式云部署、真实模型评分、两个真实设备或300人压测通过。**

保留：用户一人管理，Windows/Android/MagicOS/iOS，最多300人集中提交，一年约5000元；教学题目、正式评分规则/聚合与全年用量由用户提供。不采购/对外发布，不发明教学标准，不将测试Scorer和截图当正式结果。源码仍在原项目，当前聊天outputs仅交付快照与说明。

## 已完成（不要重建）

- backend独立npm工程：bcrypt认证/SQLite持久会话/注销、服务端角色与班级权限、班级/加入、作业草稿/发布/关闭/首次规则绑定、草稿版本检查、完整答案幂等提交及原子建任务、报告/汇总/CSV。
- 持久任务租约/旧worker防覆盖/3次尝试退避/人工重试/结构校验、复核系统原分和审阅历史、本地在线备份与独立恢复副本。正式Scorer仍未配置，无规则awaiting_rubric且报告null。
- shared v0.1.1：新增仅教师可见joinCode?；shared/package.json ESM标记解决包外NodeNext发射问题，不可遗漏。
- DSH前端已交接，Codex完成必要修复：教师加入码显示/复制；3001代理/5173严格端口；默认http、生产禁止mock/非法模式、构建无模拟登录数据；favicon。
- 完整请求/幂等键在失败重试期间冻结；提交等待在途保存、保存期间新输入不假称已保存；冲突保留本页输入并显式加载服务器草稿；401重登恢复同用户/作业内存输入，CSV401统一注销。
- 答卷概览上一页/下一页，元数据游标完整读取；发布后规则选择和首次绑定；复核理由必填；刷新任务/作业/提交列表/报告；图表范围校验。
- Vite文件范围只允许frontend/shared，拒绝backend/work/环境/凭证文件，避免开发服务器暴露数据库。
- 前端旧依赖审计报告5项，升级ECharts6.1.0、router7.18.4、Vite7.3.7、React插件5.1.1；React18.3.1保留，最新审计0已知漏洞。没有使用audit fix --force。
- 未改DSH_CONTINUE/DSH_DELIVERY，它们保留集成前记录。当前结果以本文件与integration/verification为准。

## 文件与证据

- integration/LOCAL_RUN.md：本地启动和重现命令。
- integration/COMPATIBILITY.md：差异和修复历史，顶部是最新状态。
- integration/verification/2026-10-27-integration.md：最终本地验证及限制。
- integration/verification/2026-10-27-http-browser.json：最终18/18；其他JSON分别记录生产配置、依赖审计和mock冒烟。
- integration/test/http-browser.mjs、build-config.mjs、mock-smoke.mjs：可重现脚本，无固定真实口令。
- integration/verification/screenshots：两张代表性本地HTTP截图；已查看教师320和学生报告375，无主要控件重叠，但窄屏表格会折行，不代表真机可用性结论。
- backend/verification/2026-10-27-local.md：后台基础和本地恢复证据。
- frontend/verification：DSH历史mock证据，32项不能合并当HTTP/上线结果。

## 实际命令与环境

Windows PowerShell，Node24.15.0、npm11.12.1，本机Chrome（Playwright-core1.64.1；可用BROWSER_PATH指定浏览器）。不在根目录装npm，不建workspaces。
backend：npm ci；npm run check/build/test/smoke（最后四条本轮均通过，test10/10）。npm start默认127.0.0.1:3001；npm run dev用于watch。构建入口dist/backend/src/server.js，配置不自动读.env，详见backend/README。
frontend：npm ci；npm run check/build；npm run test:config（3项通过）；npm run test:integration（18/18通过）；npm run test:mock（显式模拟冒烟通过）；npm run dev固定127.0.0.1:5173。生产构建有ECharts约503kB包体提醒，无构建错误。npm run dev:mock才显式演示。
当前测试脚本结束自动关闭临时前后端；手动启动前需确认端口空闲。生产预览只有静态文件，不自带API代理。
账号：无默认真实账号，按backend/README用user:create，USERNAME/DISPLAY_NAME/ROLE为环境变量，口令安全stdin；学生teacher各自创建。测试账号和随机口令仅在隔离backend/work数据库。
令牌与恢复输入都只在当前标签页内存，按用户/作业隔离；整页刷新会丢失未保存输入和会话，显式退出清空缓存。不要将这种恢复能力声称为跨设备持久草稿。

## 已知边界与未完成

- 真实正式规则受控导入、规则评分/总分聚合、AI适配/材料隔离/prompt/预算、真实模型限流超时和教师样本均未完成。测试Scorer的5/10和复核8/10仅验证软件结构。
- CloudBase/云身份认证/数据库/索引分页/共享限流/HTTPS/域名/费用提醒/运维诊断均待实施。本地SQLite分页前读取集合不证明云端性能，production后台明确拒绝启动。
- 300独立账号集中提交未执行；21份模拟答卷只验证列表分页，小规模同账号请求只验证幂等。无300人成功率/速率/延迟结果。
- 独立浏览器上下文在同一电脑，非两个真实设备。Android/MagicOS/iOS和真实Windows用户试用、移动网络性能待验证。
- 本地备份恢复通过，云端备份/恢复/一年后数据安排未完成；取消信号不保证第三方模型不计费。
- 无正式访问网址、云资源采购或发布操作，整体项目仍部分完成。

## 下一步

1. 先核对本文件、INTEGRATION及实际源码，沿用已验证接口/页面，不再重复从框架开发。DSH如需继续，先读本轮差异与证据再定点修改，避免双方同时改frontend。
2. 用户提供真实题目/参考答案/维度分值/2–3匿名评分样本与全年规模后，实现受控规则配置和正式Scorer/聚合；保留无规则awaiting_rubric行为。
3. 根据账号主体和约5000元预算评估CloudBase最小认证/数据库/HTTP/权限样例，确认平台条件与计费，不直接购买或发布。
4. 获授权配置真实测试云环境后验证存储/权限/恢复、两个真实设备，再制定300独立账号并发窗口和模型消耗方案；本机测试结果不能代替。
5. 用户参与代表性设备试用，修复相关缺陷后只重测相关项，最终更新云部署、备份和一年运维说明。

## 新对话启动语

请读取本项目AGENTS.md、01_Codex任务书.md、这份CODEX_CONTINUE、当前shared和integration/verification/2026-10-27-integration.md，核对实际源码再继续。本地前后端HTTP集成已通过18项浏览器测试、后台10项测试和构建检查，不要从头重写；正式规则/云端/300人/真机仍待完成。保留用户和DSH已交付修改，不把模拟评分或截图当上线验收。

## 2026-10-29 课程资料导入接续（未完成）

继续使用 `preclass-admin-preview`。新增本机未提交的课程资料导入、管理员审核发布/撤回、按班级词项检索和管理页面；后台 71 项、AI 模块 18 项、前端构建及配置检查通过。尚未浏览器验证新页面。PDF/网页导入、Web 搜索回退、参考问答审核缓存、持久化索引、真实模型和生产验证均未完成；不要描述为完整交付。详情、测试边界和后续工作见 `更新日志/2026-10-29-课程资料导入接续.md`。保留现有工作树与数据。

用户补充：课程还有指定参考网站，资料不足时还需通过 Web 查找互联网上的官方网站辅助回答。指定网站预读/索引与实时官方来源搜索都须实现；不能把上传资料当作唯一知识边界。实际网站、搜索服务及联网实现尚未配置或验证。

## 2026-10-29 参考网站与官方搜索（本地实现，真实联调未完成）

实现了班级可信域名管理、指定网页预读并审核发布、资料不足时的 Brave 搜索回退及学生来源链接。功能默认不启用搜索；需要服务端 `BRAVE_SEARCH_API_KEY`、管理员设置域名并启用。后台 74 项、前端检查和模拟浏览器流程通过。实际 `www.gov.cn` 解析为 198.18.0.153 被内网检查拒绝，真实网页抓取未通过；无真实搜索凭据及真实模型验证。功能边界、隐私及剩余事项详见 `更新日志/2026-10-29-参考网站与官方搜索.md`。现有预览后台仍运行旧进程，变更未上传/部署。


## 用户修正：联网范围

指定网站为优先来源，并不禁止未指定的网站。现按指定网站、政府网站、公共机构网站、其他网页（身份待核实）顺序回退。域名不是权威性的证明，真实搜索和真实模型尚未验收；详情见 `更新日志/2026-10-29-参考网站与官方搜索.md` 最后补记。

用户进一步补充：政府来源包含地方政府，之后需覆盖相关领域企业及其他网站，例如仪器厂商的官方方法网页。当前 `gov.cn` 包含地方子域名，未指定厂商可在其他网页回退中出现，但不能自动验证官网身份，仍显示“身份待核实”；真实服务和方法匹配未验收。详见参考网站与官方搜索日志末节。

## 2026-10-29 双方管理端择优比较

对方 PR #7 头 3ffef2e 是本机当前分支的祖先，本机沿用其账户/审计后扩展了集中名单、多教师、首次改密与服务配置。对方班级/成员界面值得吸收，但当前嵌入界面未开放；旧单教师 `saveClass` 与 `class_teacher` 并存存在权限语义风险，须先设计并测试。PR #8 只是部署准备，尚未纳入本机且生产入口与设计预览不同。保留未提交资料/Web 工作，详细取舍和验证边界见 `更新日志/2026-10-29-双方管理端对比与择优.md`。

## 2026-10-29 管理端本地择优合并

已接入班级与成员、多教师编辑、关系级撤权及重新认领拦截、手工托管班级；合并PR #8单机部署守卫与模板，并补双前端构建入口及AI模块打包白名单。后台80/80、smoke、前端构建/配置、AI18项及隔离浏览器5项通过。预览已重启，数据库和账号保留。详见 `更新日志/2026-10-29-管理端择优合并与回归.md`；未上传、未真实部署，Linux新组合/发布包/AI备份/真实联网等限制务必保留。

## 2026-10-29 后续三项交互调整

正在收尾：账户区加入“从已导入学生名单批量建号”，读取本管理员待确认名单并重新校验，不重置已有密码；课程资料支持所有班级多选/全选，4MiB分块上传、服务器保存原件、后台串行解析，AI明确等待服务器配置（用户已要求推迟AI调用）；前三项请求次数/预算支持0=不限制，其他技术/隐私约束保留。新增 reference-files.ts 与 scripts/extract-reference.py（pypdf==6.17.0），状态与页文本/manifest保留在数据库旁 reference-files/。AI记忆文档尚未生成，不应把提取文本当AI完成；大Office解析仍继承旧限制，OCR未实现。101MB原文件分块和105906859字节有效合成PDF提取已测，复杂真实PDF未测。最终测试与入口见最新更改日志，旧功能必须继续回归。

上述三项调整已完成本地验证：后台81项、AI19项、前端构建/配置、HTTP101MiB上传下载、有效合成大PDF文本提取及浏览器全选/不限额通过。真实AI预读按用户要求等待服务器配置；OCR、大Office解析、续传UI、文件目录正式备份等未完成。完整说明见 `更新日志/2026-10-29-批量建号大文件与不限额.md`。

## 2026-10-29 学生端反馈修正

学生隐藏管理入口和人数；design-preview聊天已接服务端threads，支持删除确认、刷新重登恢复、续问，当前以请求完成后加载回答。三条推荐问题不再因关键词缺失误判范围外，无证据仍提示不足。后台81项与smoke、前端构建/配置、真实隔离API浏览器删除与恢复/375布局通过；详见 `更新日志/2026-10-29-学生界面会话与推荐问题修正.md`。未真实联网，保留原数据。

## 2026-10-29 永久会话

服务器设置增加sessionHours=0永久有效，新会话expiresAt=null（共享AuthSession类型已扩展）；退出/停用/改密与epoch撤销保留。仅后续登录生效，令牌仍只存页面内存，刷新仍需登录。后台82项与smoke、前端构建/配置及模拟浏览器通过，详见永久会话选项日志。

## 2026-10-29 上传及版本隔离

当前功能已上传 `integration/admin-versioned-20261029`，功能提交afe69cb。versions/下按版本独立子文件夹保存源码与哈希清单：v01-roster基线b24357d、v02-admin-integrated当前afe69cb。根工作区继续开发；版本文件夹不覆盖，运行时分开DB_PATH/端口，不归档数据库或口令。主分支未合并、未部署；最新同步记录见 `更新日志/2026-10-29-上传与版本隔离.md`。旧日志“未上传”为当时状态。

上传已创建草稿PR #10：https://github.com/zlingting123-svg/preclass-learning-evaluation/pull/10 ，目标feature/admin-console。版本目录提交bb11e96已核验远端一致；CI在运行，不能写远端通过。最终分支头以PR为准，所有快照保留来源提交原文。

## 2026-10-29 云服务器适配

正在收尾服务器方案：Caddy8MB/4MiB分块、默认学习空间、生产HTTP120秒、Python虚拟环境预检、资料目录权限、停服完整备份与校验工具，以及Ubuntu CI。原版本快照不改，后续新建v03。完整备份需要root受控脚本短暂停服，代码/current必须root管理。真实云资源未连接，详见云服务器版本适配日志和deployment/README末节。

服务器适配功能已提交c499bc2，容量夹具跨平台同步修正提交e0836bf。干净提交发布包178文件哈希核验通过；v03-server-adapted快照406文件对应e0836bf（排除versions/），旧v01/v02不改。上次23b3b3f远端Windows容量测试实际失败，本轮已修复固定延迟假设并本地AI19通过；新头CI结果另查，不能沿用旧通过结论。

服务器适配已同步PR #10，0f3ba94头的Ubuntu和Windows检查全部SUCCESS（运行40841274654）；Ubuntu验证Python/非root预检、完整备份与发布包、真实Caddy本地代理上传。独立解包npm安装构建通过。原云主机/TLS/systemd真实生命周期及负载仍未验收；详见最新云服务器适配日志。随后只补交验证文档与CI证据，v03源码仍固定e0836bf。

## 2026-10-29 一键安装包

正在制作Ubuntu24.04 x86_64首次安装器（deployment/installer/）、Linux打包脚本build-installer.mjs和ubuntu-installer CI；打包前端/后台生产产物、私有Node/Caddy与PDF wheel，基础OS缺项才apt，已有系统/数据拒绝覆盖。密码终端/标准输入，不保存明文；AI关闭。CI一次性VM验证真实systemd启动、登录、备份重启与独立恢复后才上传安装包artifact。当前只本地语法/完整性与备份回归通过，最终Linux结果另查。

一键安装包已完成：ddc5525源码的push CI40844018830中Windows/Ubuntu/ubuntu-installer全部成功，真实一次性VM完成systemd安装、登录、拒绝覆盖、备份重启和恢复验证。约66MiB tar.gz已下载到../outputs/ubuntu-installer-20261029，3329个记录全量校验通过，附SHA256和安装步骤。v04-installer保留源码与CI/校验记录；CI artifact保留30天，本机文件另存。用户云端域名TLS/备案/防火墙和真实负载仍未验收，详见一键安装包日志完成补记。

## 2026-10-29 安装包发行移交

用户要求安装包本体、日志和说明上传项目库。采用同项目Releases标签installer-v04-20261029固定ddc5525，上传已验收tar.gz、SHA、metadata、安装步骤和README；源码分支增加installers/2026-10-29-v04/按版本索引。源快照不改，CI30天附件转为发行区长期下载。上传摘要和附件状态见最新安装包发行区上传日志。

