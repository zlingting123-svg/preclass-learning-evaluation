// Explicit local-sample read-only verification. Never prints or writes credentials.
import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';
import assert from 'node:assert/strict';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..'),base='http://127.0.0.1:3002/api/v1';
const privateText=readFileSync(resolve(root,'backend/work/platform-sample/服务管理员账号.txt'),'utf8'),password=privateText.match(/^密码：(.+)$/m)?.[1];
assert.ok(password);
const login=await fetch(base+'/admin/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'service_admin',password})});assert.equal(login.status,200);
const session=(await login.json()).data;
async function get(path){const r=await fetch(base+path,{headers:{Authorization:'Bearer '+session.accessToken}});assert.equal(r.status,200);return(await r.json()).data;}
try{
 const settings=await get('/admin/api'),server=await get('/admin/server'),overview=await get('/admin/overview'),audit=await get('/admin/audit'),usage=await get('/admin/usage');
 assert.equal(settings.mode,'mock');assert.equal(settings.liveReady,false);assert.equal(settings.settings.dailyRequests,20);assert.ok(settings.settings.version>=2);
 assert.equal(server.maintenance,false);assert.equal(server.sessionHours,8);assert.ok(server.version>=1);assert.ok(overview.counts.admins>=1);
 assert.ok(audit.items.some(x=>x.action==='api.configure'));assert.ok(audit.items.some(x=>x.action==='server.configure'));
 const data=JSON.stringify({settings,server,overview,audit,usage});assert.ok(!data.includes(password));assert.ok(!data.includes(session.accessToken));assert.ok(!data.includes('passwordHash'));assert.ok(!data.includes('"question"'));
 const result={date:'2026-10-28',afterProcessRestart:true,mode:settings.mode,apiConfigVersion:settings.settings.version,serverConfigVersion:server.version,dailyRequests:settings.settings.dailyRequests,maintenance:server.maintenance,sessionHours:server.sessionHours,checks:['admin login','persisted API configuration restored','server settings restored','audit metadata retained','no credential or transcript in response'],paidCalls:0};
 writeFileSync(resolve(root,'integration/verification/2026-10-28-admin-runtime.json'),JSON.stringify(result,null,2)+'\n');console.log('PASS administrator runtime, configuration recovery and metadata after process restart');
}finally{await fetch(base+'/auth/logout',{method:'POST',headers:{Authorization:'Bearer '+session.accessToken}});}
