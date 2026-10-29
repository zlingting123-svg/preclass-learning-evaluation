## 集成学习平台样板（0.3.0任务分支）

macOS便捷启动：根目录 `python3 integration/sample.py start`，或双击integration/打开学习平台.command。停止：`python3 integration/sample.py stop`。在5173/3001端口空闲时启动；此前独立下载版本若已启动，请先停止对应本机服务。Moodle的8873端口可继续对照。

首次按锁文件安装并构建两个模块，显式初始化到backend/work/platform-sample/sample.sqlite，包含两模拟教师/两学生、春秋批次与同账号跨期、各班导读和两份练习。不覆盖已有模拟数据库；账号和随机口令仅写本机测试账号.txt。不要分享work目录。

手工启动（跨平台源码路径相同，环境变量语法依操作系统）：backend中npm ci、npm run build、npm run sample:seed；设置DB_PATH为work/platform-sample/sample.sqlite后npm start；frontend中npm ci、npm run dev；访问127.0.0.1:5173。Node 24.15+，Python便捷启动器仅在本机macOS验证；本轮不宣称Windows便捷启动验收。

学生001001可填写画像、阅读材料、保存并提交文字作业；教师teacher_a查看A班画像及CSV和答卷。新增画像不计成绩；正式作业报告仍待配置评价体系。模拟账号属于本分支独立数据库，与旧下载和Moodle口令不同。刷新整页需要重登，已成功保存草稿仍在数据库。

---

# 本地集成版启动说明

2026-10-28 当前集成工作区：`C:\Users\96496\Documents\Codex\2026-10-27\01-codex-md-handoff-codex-continue\work\oss-foundations`，分支backend/oss-foundations，契约v0.2.0。在自己的克隆目录使用相同相对命令；下方原项目绝对路径是历史信息。新增批次用后台受控CLI显式配置，见backend/ROSTER.md，没有默认真实班级/账号。前端教师/学生页面可筛选授权/选课批次；创建与加入后自动定位对应班级。验证更新见verification/2026-10-28-cohorts-ci.md。

适用2026-10-27版本；Node v24.15.0、npm11.12.1，Windows PowerShell。项目仍在：

```text
C:\Users\96496\Documents\Codex\2026-10-27\wo-2\outputs\课前问答项目
```

这是本机试运行版，数据由本地SQLite保存，未开通云环境。不要将5173/3001网址当正式联网入口。测试脚本会自动关闭临时服务；交付时不留下测试服务运行。

## 安装与账号

两个模块分别安装，不在根目录建立workspaces：

```powershell
# 在项目根目录
Set-Location backend
npm ci
npm run build
```

没有默认教师/学生账号。按backend/README.md的受控命令各创建一个teacher和student账号：账号名、显示名、角色通过环境变量，口令安全输入后经stdin传给user:create；不要用mock的demo123登录真实后台。

## 启动

第一个终端在backend/执行：

```powershell
npm start
```

第二个终端在frontend/执行：

```powershell
npm ci
npm run dev
```

访问 **http://127.0.0.1:5173**。Vite固定5173，代理/api到127.0.0.1:3001；端口冲突会报错，不自动切换。Ctrl+C停止对应服务。无需另开worker：当前没有正式评分适配器，无规则提交后为“待配置评价体系”。

流程：教师登录→创建班级→复制加入码→进入班级新建/发布作业；学生在另一个浏览器会话登录→输入加入码→刷新任务→保存草稿/提交；教师刷新提交列表→查看答卷原文/导出CSV。任务、报告和提交列表均有刷新按钮，避免通过整页刷新丢失内存登录。

令牌只在标签页运行内存。过期后重新登录同一账号可恢复该标签页中未提交输入；整页刷新/关闭标签页会丢失尚未保存输入，显式退出会清空内存缓存。版本冲突需先处理，不静默覆盖。提交结果未确认时输入锁定，重试同一请求或查询服务器状态。

## 重现验证

先在backend运行check/build/test/smoke，再在frontend：

```powershell
npm run check
npm run build
npm run test:config
npm run test:integration
npm run test:mock
```

浏览器脚本使用本机Chrome/Edge；可用BROWSER_PATH指定浏览器可执行文件，不自动安装/下载浏览器。执行前停止手工启动的5173/3001服务；脚本独立创建backend/work下模拟数据库，随机生成口令，不修改work/local.sqlite。输出证据到integration/verification，不保存口令/令牌。

生产构建禁用mock和未知API模式，产物不含演示账号/模拟班级。`npm run dev:mock`仅用于显式演示，并有持续横幅；生产预览不包含开发代理，正式HTTPS网关和托管仍待配置。

## 未完成

正式题目/评分标准/聚合算法、受控规则配置、真实模型/预算与评分样本、云认证/数据库/HTTPS、300独立账号集中提交、真实Android/MagicOS/iOS设备、云备份恢复及一年运维尚未完成。本地测试评分仅使用显式替身，不代表教学评分效果。
