import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
const base='http://127.0.0.1:8891';const tokens=JSON.parse(readFileSync('work/sample/tokens.json','utf8'));
const results=[];
async function check(name,fn){await fn();results.push({name,result:'pass'});console.log('PASS '+name)}
const request=(role,path,body)=>fetch(base+'/api/ai/v1'+path,{method:body?'POST':'GET',headers:{...(role?{Authorization:'Bearer '+tokens[role]}:{}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
const ask=(question,role='student',courseId='environment',clientRequestId=randomUUID())=>request(role,'/questions',{question,courseId,clientRequestId});
try{
 await check('API健康状态可读且未宣称真实模型就绪',async()=>{const r=await fetch(base+'/health');assert.equal(r.status,200);assert.equal((await r.json()).liveReady,false)});
 await check('无凭据访问被拒绝',async()=>assert.equal((await request(null,'/usage/me')).status,401));
 const before=(await (await request('student','/usage/me')).json()).data;
 await check('教师不能冒充学生提问',async()=>assert.equal((await ask('环境评价的作用是什么？','teacher')).status,403));
 await check('未选课程被拒绝',async()=>assert.equal((await ask('环境评价的作用是什么？','student','other-course')).status,403));
 const id=randomUUID();
 await check('问答SSE包含来源、输出和done结束标记',async()=>{const r=await ask('环境评价的作用是什么？','student','environment',id);assert.equal(r.status,200);assert.ok(r.headers.get('content-type').includes('text/event-stream'));const text=await r.text();for(const event of ['sources','delta','done'])assert.ok(text.includes('event: '+event));assert.ok(text.includes('[example-environment]'));assert.ok(!text.includes('event: error'))});
 await check('完成后重放同一请求不会再次生成',async()=>assert.equal((await ask('环境评价的作用是什么？','student','environment',id)).status,409));
 await check('课程无关问题固定拒答',async()=>assert.ok((await (await ask('请推荐游戏装备')).text()).includes('event: refusal')));
 await check('课程相关但无证据时返回资料不足',async()=>assert.ok((await (await ask('环评中未收录的新制度内容')).text()).includes('event: insufficient_evidence')));
 await check('拒答不增加模型调用，用量统计只增加一次完成',async()=>{const after=(await (await request('student','/usage/me')).json()).data;assert.equal(after.modelCalls-before.modelCalls,1);assert.equal(after.completed-before.completed,1)});
 await check('学生无管理员用量权限',async()=>assert.equal((await request('student','/admin/usage')).status,403));
 await check('管理员可查看350并发配置及余额未配置状态',async()=>{const r=await request('admin','/admin/provider-accounts');assert.equal(r.status,200);const d=(await r.json()).data;assert.equal(d.accounts[0].capacity,350);assert.equal(d.balances[0].state,'not_configured');assert.ok(!JSON.stringify(d).includes(tokens.admin))});
 const evidence={date:'2026-10-28',scope:'running local mock API; no paid calls; no transcript stored',passed:results.length,results};mkdirSync('verification',{recursive:true});writeFileSync('verification/debug-latest.json',JSON.stringify(evidence,null,2));
 mkdirSync('work/debug',{recursive:true});writeFileSync('work/debug/调试结果.md','# AI/API模块运行调试\n\n入口：http://127.0.0.1:8891/health\n\n当前为mock替身模式，不产生DeepSeek费用。已实际验证'+results.length+'项接口行为：\n\n'+results.map(r=>'- 通过：'+r.name).join('\n')+'\n\n运行测试命令：`node scripts/debug.mjs`。源码与合并接口见README.md和MERGE_CONTRACT.md。\n\n这里只记录调试结论，不保存提问或回答正文。此轮未重跑容量压测，也不是实网模型或整站容量验证。\n');
}catch(error){console.error('FAIL API debugging assertion: '+error.message);process.exitCode=1}
