# 源文件交互图谱补丁

基于服务器knowledge-map-v060实际代码追加；module-patch是变更子集，不是完整上游模块。atlas.js/css与锁定的npm依赖构建atlas.bundle.js，build.mjs的esbuild路径需按工作环境调整。许可证在module-patch/public/THIRD_PARTY_NOTICES.txt。禁止包含用户XMind、data.json、数据库、登录凭据。部署脚本以服务器实际基线校验，stage/activate/rollback依赖私有状态文件，不可盲目在新服务器执行。原数据保留，不自动发布草稿。
