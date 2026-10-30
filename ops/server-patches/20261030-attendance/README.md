# 签到与随机点名：限定服务器模块

产品0.3，当前服务器发布为`20261030-attendance-copy`。此目录保留针对服务器实际构建的新增模块与限定补丁；不是将仓库旧整站重新部署的授权，也不代表主维护TypeScript工程已迁回这些运行补丁。

功能、验证范围、备份和回退详见`docs/2026-10-30-签到与随机点名部署.md`。

## 当前源码

- `AttendancePanel.tsx`：真实教师/管理员页面、学生扫码登录后确认签到；主题继承现有`--pv-*`，文案已改成直接的功能名称。
- `attendance.js`：服务器身份、班级授权、名单快照、30秒动态码、持久化签到和随机点名。
- `puzzle.js`、同级上一层`attendance-preview/layout.js`：SVG拼图和人数布局，1–500人逐项验证块数相等、无重叠无空洞；不把500当作业务人数限制。
- `attendance.css`：真实页面样式与拼入、揭晓、庆祝动画。
- `patch-main.py`、`stage.py`、`deploy.py`、`deploy-copy.py`：固定基线的集成、隔离和发布脚本。只作维护参考；执行前先核对实际源码与服务器current，不能盲跑旧脚本。
- `browser-test.mjs`：真实服务器构建上的隔离端到端测试，账号从私有测试文件读取，不在GitHub保存凭据。

## 可移植构建

在仓库根目录执行：

```sh
npm ci --prefix frontend
npm ci --prefix ops/server-patches/attendance-preview
node ops/server-patches/20261030-attendance/build-portable.mjs
```

产物仅写入本目录`work/build`，不会修改服务器。可通过`ATTENDANCE_FRONTEND_PACKAGE`指定其他实际前端工程的package.json。构建依赖该前端工程已有esbuild，并复用服务器`react-DFdtPfhg.js`，不要据此把旧主包覆盖到其他版本。

`build.mjs`保留当时本机路径以便审计；新机器优先使用`build-portable.mjs`。

## 独立模拟预览

```sh
npm ci --prefix ops/server-patches/attendance-preview
node ops/server-patches/attendance-preview/server.mjs
```

打开`http://127.0.0.1:5197/`。所有账号、姓名和签到均为合成演示；演示学生页允许选择模拟身份，不可部署为正式认证。仅监听本机，不写正式数据库。二维码依赖qrcode，依赖及锁文件一并提供。

预览目录中的雪山图片是用户指定试用图，原件SHA256为`17828ccbba8b96cc323547427097ee4ce4fecb4acaa7218cdd9e9a8aa98ef240`。

真实模块的扫码按当前登录学生身份执行；公网手机扫码仍需ICP备案和HTTPS入口，尚未完成真机验收。
