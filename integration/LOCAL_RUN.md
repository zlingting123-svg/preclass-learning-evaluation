# 本地集成版启动说明

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
