import {createRequire} from 'node:module';
import {writeFileSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import assert from 'node:assert/strict';
const require=createRequire('C:/Users/96496/Documents/Codex/2026-10-28/outputs-md/work/deepseek-live-source/preclass-learning-evaluation-ddc55257eccf2aba137f4e38ce3f645393eb54a1/frontend/package.json');
const {chromium}=require('playwright-core');
const b=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const liveAssets=process.env.LIVE_ASSETS==='1';
const output={productionWrites:false,paidModelCalls:0,productionAssets:liveAssets,checks:[]},errors=[];
const p=await b.newPage();p.on('pageerror',e=>errors.push(e.message));
let role='student',delay=0,qrMode=false;const calls=[],drawRequests=[],mockHistory=[],drawResults=new Map();
let draft={answers:{},draftVersion:0,submittedAt:null};
const survey={id:'mock-survey',classId:'class-a',title:'合成问卷',state:'published',version:1,deadlineAt:null,durationMinutes:null,questions:[{id:'q',title:'合成开放题',type:'text',required:false,options:[]}]};
if(!liveAssets)await p.route('**/assets/**',async route=>{const name=new URL(route.request().url()).pathname.split('/').at(-1);const file=join('work/project-audit/fixes/frontend/dist/assets',name==='main-rollcall-stage.js'?'main-audit-fix.js':name);if(existsSync(file))await route.fulfill({path:file,contentType:name.endsWith('.css')?'text/css':'application/javascript'});else await route.continue()});
await p.route('**/api/v1/**',async route=>{
 const path=new URL(route.request().url()).pathname.replace('/api/v1','');calls.push({method:route.request().method(),path,body:route.request().postDataJSON?.()});
 const user={id:'mock-'+role,displayName:'合成用户',role,mustChangePassword:false};let data=[];
 if(path==='/auth/login')data={user,accessToken:'synthetic-only-not-real'};
 else if(path==='/auth/me')data=user;
 else if(path==='/account/profile')data={...user,nickname:'',version:0};
 else if(path==='/classes')data={items:[{id:'class-a',name:'合成班级'}],nextCursor:null};
 else if(path==='/core/classes/class-a/surveys')data=[survey];
 else if(path==='/core/surveys/mock-survey/start')data={survey,response:draft,serverNow:new Date().toISOString(),expiresAt:null};
 else if(path==='/core/surveys/mock-survey/draft'){const body=route.request().postDataJSON();assert.equal(body.expectedVersion,draft.draftVersion);draft={...draft,answers:body.answers,draftVersion:draft.draftVersion+1};data={version:draft.draftVersion,savedAt:new Date().toISOString()}}
 else if(path==='/core/ai/status')data={mode:'deepseek'};
 else if(path==='/core/ai/threads')data={items:[],activeId:null};
 else if(path==='/core/ai/last-context')data={classId:null,threadId:null};
 else if(path==='/core/ai/usage')data={};
 else if(path==='/attendance/scan')data={sessionId:'mock-session',scanProof:'synthetic-proof-only',expiresAt:Date.now()+180000};
 else if(path==='/core/attendance-checkin')data={checkedIn:true};
 else if(path==='/core/rollcall'){
  const body=route.request().postDataJSON();drawRequests.push(body.clientRequestId);
  if(drawResults.has(body.clientRequestId))data=drawResults.get(body.clientRequestId);
  else {data={id:'draw-'+(mockHistory.length+1),classId:'class-a',scope:'all',students:[{studentId:'s1',studentName:'合成学生1',studentNumber:'MOCK001'}],createdAt:new Date().toISOString()};drawResults.set(body.clientRequestId,data);mockHistory.push(data);await route.abort('failed');return}
 }
 else if(path.endsWith('/rollcall'))data=mockHistory;
 else if(path.endsWith('/members'))data=[{studentId:'mock-student',studentName:'合成学生',studentNumber:'MOCK001'}];
 else if(qrMode&&path.endsWith('/attendance'))data=[{id:'mock-session',status:'open',createdAt:new Date().toISOString()}];
 else if(qrMode&&path==='/core/attendance/mock-session'){
  const now=Date.now(),start=Math.floor(now/2000)*2000;
  data={id:'mock-session',status:'open',roster:[{studentId:'mock-student',studentName:'合成学生',studentNumber:'MOCK001'}],signed:[],serverNow:now,ticket:'mock',expiresAt:start+2000,qrTickets:Array.from({length:16},(_,i)=>({ticket:'synthetic-ticket-'+(start/2000+i),from:start+i*2000,until:start+(i+1)*2000}))};
 }
 if(delay&&(path.endsWith('/members')||path.endsWith('/attendance')||path.endsWith('/rollcall')||path==='/core/attendance-images'))await new Promise(r=>setTimeout(r,delay));
 await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,data})}).catch(()=>{});
});
async function login(){await p.goto('http://127.0.0.1:5173');await enterLogin()}
async function enterLogin(){await p.getByLabel('账号',{exact:true}).fill('synthetic');await p.getByLabel('密码',{exact:true}).fill('synthetic');await p.getByRole('button',{name:'进入环境评价与管理',exact:true}).click()}
try{
 await login();await p.getByRole('link',{name:'问卷与统计',exact:true}).click();
 await p.locator('a[href="/core/surveys/mock-survey/answer"]').click();await p.getByRole('textbox',{name:'合成开放题',exact:true}).fill('这是一段尚未提交的合成回答');
 await p.getByRole('link',{name:'返回班级',exact:true}).click();await p.locator('a[href="/core/surveys/mock-survey/answer"]').click();
 assert.equal(await p.getByRole('textbox',{name:'合成开放题',exact:true}).inputValue(),'这是一段尚未提交的合成回答');await p.waitForTimeout(1000);assert.equal(draft.answers.q,'这是一段尚未提交的合成回答');
 output.checks.push({name:'survey_draft_navigation_recovery',passed:true,serverSaved:true,version:draft.draftVersion});
 await p.getByRole('link',{name:'AI 问答助手',exact:true}).click();await p.waitForTimeout(700);const copy=await p.locator('.pv-chat-disclaimer').innerText();assert(copy.includes('仅依据')&&!copy.includes('一般知识解释'));output.checks.push({name:'strict_source_ui_copy',passed:true,text:copy});
 await p.getByRole('button',{name:'退出登录',exact:true}).click();assert.equal(await p.evaluate(()=>Object.keys(sessionStorage).filter(k=>k.startsWith('preclass.survey.draft.')).length),0);
 role='teacher';await login();delay=2200;await p.getByRole('link',{name:'随机点名',exact:true}).click();await p.locator('[data-phase="loading"]').waitFor();await p.locator('[data-phase="ready"]').waitFor({timeout:10000});assert.equal(await p.locator('.rl-orbit-card').count(),1);output.checks.push({name:'slow_network_serial_refresh',passed:true,latencyMs:2200,loadedMembers:1});delay=0;
 await p.getByRole('button',{name:'开始随机点名',exact:true}).click();await p.locator('[data-phase="error"]').waitFor();await p.getByRole('button',{name:'开始随机点名',exact:true}).click();await p.locator('[data-phase="result"]').waitFor();assert.equal(drawRequests[0],drawRequests[1]);assert.equal(mockHistory.length,1);output.checks.push({name:'rollcall_response_lost_retry',passed:true,committedDraws:1,sameIdempotencyKey:true});
 qrMode=true;await p.getByRole('link',{name:'拼图签到',exact:true}).click();await p.getByAltText('动态签到二维码').waitFor();const qrImages=new Set();for(let i=0;i<24;i++){qrImages.add(await p.getByAltText('动态签到二维码').getAttribute('src'));await p.waitForTimeout(250)}assert(qrImages.size>=3);output.checks.push({name:'fast_qr_browser_rotation',passed:true,distinctQrFrames:qrImages.size,observedMs:6000});
 for(const width of [320,375,414,768,1024]){await p.setViewportSize({width,height:1000});assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1))}await p.setViewportSize({width:1400,height:1000});output.checks.push({name:'responsive_checkin',passed:true,widths:[320,375,414,768,1024]});
 await p.getByRole('button',{name:'退出登录',exact:true}).click();role='student';const from=calls.length;await p.goto('http://127.0.0.1:5173/checkin?sessionId=mock-session&ticket=synthetic-qr');await p.waitForFunction(()=>JSON.parse(sessionStorage.getItem('attendance.pending')||'null')?.scanProof);await enterLogin();await p.getByRole('button',{name:'确认签到',exact:true}).click();await p.getByText('签到成功，你的拼图已归位。',{exact:true}).waitFor();const recent=calls.slice(from);assert(recent.findIndex(c=>c.path==='/attendance/scan')<recent.findIndex(c=>c.path==='/auth/login'));const checkin=recent.find(c=>c.path==='/core/attendance-checkin');assert.equal(checkin.body.scanProof,'synthetic-proof-only');assert(!checkin.body.ticket);output.checks.push({name:'scan_before_login_then_confirm',passed:true,proofExchangedBeforeLogin:true});
 assert.deepEqual(errors,[]);output.pageErrors=errors;output.passed=true;
}catch(e){output.testError=e.message;output.pageText=(await p.locator('body').innerText()).slice(0,2000);output.calls=calls.slice(-20);process.exitCode=1}finally{writeFileSync('work/project-audit/'+(liveAssets?'browser-live-result.json':'browser-fixed-result.json'),JSON.stringify(output,null,2));console.log(JSON.stringify(output));await b.close()}
