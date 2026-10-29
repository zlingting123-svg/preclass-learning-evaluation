# 批次和名单：受控本机管理

版本v0.2.0任务分支，2026-10-27。此功能没有公开HTTP写入口；只供拥有后台机器文件权限的管理员操作。ACTOR_ID用于核对既有admin角色并记审计，不是可替代网页登录的密钥。管理员/教师账号先按README用user:create受控创建。没有真实名单或正式分班表，不自动生成500学生/7班。

## 1. 显式配置批次和班级

在backend/执行，DB_PATH与服务一致；不要对真实数据首次试验：

```powershell
$env:ACTOR_ID = '<既有管理员用户ID>'
# cohort.json保留在private-data中，先由教师确认具体日期和教师ID。
Get-Content -LiteralPath private-data/cohort.json -Raw -Encoding utf8 | npm run cohort:create
```

cohort.json字段：name、courseName、startsOn、endsOn（YYYY-MM-DD）、teacherIds（既有teacher账号ID数组），可选plannedStudentCount、plannedTeacherCount、assignmentsPerStudent。计划人数可记录500/7/4，但不会据此创建账号/班级或推定每位教师带1班；具体开结课日未提供，不给生产默认日期。

为指定已授权教师建班：

```powershell
# class.json包含teacherId、cohortId、name；teacherId须在批次授权列表。
Get-Content -LiteralPath private-data/class.json -Raw -Encoding utf8 | npm run class:create
```

教师原有POST /teacher/classes也兼容可选cohortId，但服务端验证批次授权。旧无批次班级继续工作，不自动搬移历史作业或选课；当前导入只接受已明确绑定批次的班级。

## 2. 预览名单

开发模板仅两列：`学号,姓名`，或`studentNumber,displayName`；UTF-8，可带BOM。列名不能重复，不接受role/teacherId等自授权限列。学号按字符串保留前导零，不做数值转换。当前受控用户名格式为3–64位字母/数字/_.-、首位字母或数字；真实名单若超出格式先确认，不能截断/改写。疑似科学计数会报错，要求核对文本来源。

```powershell
$env:CLASS_ID = '<目标班级ID>'
$env:ROSTER_FILE = 'private-data/真实名单.csv'
npm run roster:preview
```

一次1–1000行、最大2MB。stdout仅计划ID、hash、分类计数及私密报告路径，不列学生姓名或口令。完整预览写private-data/roster-preview-*.json，状态分新增/已有/已加入/错误/冲突。预览只保存计划，尚不创建账户或选课。

必须人工核对报告。重复学号、同学号不同姓名、已有未核实同名账号/角色不一致均拒绝，不静默覆盖；有任一错误/冲突，整批不执行。报告含身份信息，不上传GitHub或聊天。

## 3. 明确确认

```powershell
$env:IMPORT_PLAN_ID = '<已核对计划ID>'
$env:IMPORT_PLAN_HASH = '<预览返回的64位指纹>'
npm run roster:commit
```

计划30分钟有效；账号/班级在预览后变动须重新预览。新账号以学号登录，角色固定student；各自随机初始口令由bcrypt库hash，明文仅写private-data/credentials-*.json，不输出终端、不入数据库/日志。按对应学生受控分发，不能把整份文件发全班。当前尚无首次登录强制改密/网页找回流程，正式认证部署前需补齐，不把随机初始口令当作完整账号生命周期。

同一学号跨期复用账号、原口令不变，只新增目标班选课，不清除原班关系。重复确认返回原回执，不生成第二批账号/口令。数据持久化失败整批回滚并删除本次新建口令文件；现有私密文件永不覆盖。输出路径仅允许private-data内，拒绝路径越界和目录联接点跳转。Windows的0o600不是完整ACL保障，机器和目录访问权限仍由账号持有人保管。

私密报告/口令文件、本地数据库和work均被.gitignore排除。不要把数据库直接推GitHub；数据库在线备份说明沿用README，首次真实导入前先备份并在隔离副本验证。

## 验证和未完成

22项后台测试通过，包括导入事务故障、指纹/过期/预览后变化、跨期复用、500行仅预览、路径越界/联接点、完整构建CLI。500行预览不是500账号创建或300人压测。新导入网页、真实名单格式/分班表、课程4次作业配额、正式画像和云认证/存储尚未完成。
