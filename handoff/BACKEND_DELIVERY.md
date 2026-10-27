# 本机后台任务分支交付（持续更新）

2026-10-27；分支backend/oss-foundations，草稿PR：[PR #1](https://github.com/zlingting123-svg/preclass-learning-evaluation/pull/1)。main未自动合并。同事不要同时修改该分支，前端在独立frontend任务分支适配。

本轮已收尾上传：开源复用与批次/名单代码分别为d01415d、a939ac9，最终接续文档另提交。未完成的改密草稿已撤回；没有改密/找回/强制首改API或CI工作流，不能按计划文字当作已实现。下一次先核对远程任务分支与当前契约，再继续新功能。

## 当前新增

开源模块核对20个仓库；已直接接入Helmet、express-rate-limit、csv-parse、csv-stringify，保留LICENSE。契约v0.2.0兼容旧客户端，新增CohortInfo、ClassInfo.cohortId?、GET /cohorts及/:id、GET /classes?cohortId；教师建班兼容可选cohortId并验证授权。

受控CLI完成批次/既有教师班级配置、学号CSV预览/冲突、指纹确认导入、随机私密口令、跨期复用、事务回滚和审计回执。见backend/ROSTER.md。没有Web导入写接口，不为普通教师自动开放管理员权限。

## 同事下一步

1. 先拉取/审阅PR和shared/API_CONTRACT.md v0.2.0；旧UI仍能工作，不复制第二套契约。
2. 新增授权批次筛选和建班可选cohortId。Teacher列表由GET /cohorts返回，学生只见已选课批次。
3. 导入预览/执行UI待操作者Web权限确定及受控HTTP写接口后再接，不伪造网页导入成功。目前仅本机CLI。
4. 画像可评估SurveyJS Form Library或JSON Forms；不要购买其商业Creator/Dashboard，不猜题型、量表锚点/必填，不将画像计入4次作业或能力成绩。

本轮没有改frontend业务源码。backend check/build、22项测试和smoke通过；现有frontend check/build、18项HTTP联调、3项生产配置限制回归通过。均为本地模拟材料，非云端/正式模型/真机/300人结果。
