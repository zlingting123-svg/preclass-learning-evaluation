# 签到图片模糊调节

按当前服务器已部署AttendancePanel源码更新，保留原管理端图片上传。教师在当前页调节未签到区域0–32，默认14，按班级保存到本浏览器。签到区域不加模糊、全员恢复完整图。只替换前端模块入口，无后台数据变更或服务重启。puzzle.js依赖既有attendance-preview/layout.js，构建依赖既有qrcode；build.mjs的工作路径需按环境调整。浏览器验证使用隔离模拟37人，未写生产测试数据。正式current=20261031-attendance-blur，前版20261031-knowledge-atlas。回退只切current到前版，不能恢复数据库覆盖之后操作。
