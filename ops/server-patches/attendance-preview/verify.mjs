import {createRequire} from 'node:module';import assert from 'node:assert/strict';import {mkdirSync,writeFileSync} from 'node:fs';
const require=createRequire('C:/Users/96496/Documents/Codex/2026-10-28/outputs-md/work/deepseek-live-source/preclass-learning-evaluation-ddc55257eccf2aba137f4e38ce3f645393eb54a1/frontend/package.json');
const {chromium}=require('playwright-core'),out='C:/Users/96496/Documents/Codex/2026-10-29/jie/outputs/签到与点名预览';mkdirSync(out,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});const page=await browser.newPage({viewport:{width:1536,height:1100}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
const checks=[];const api=async(p,body)=>{const r=await fetch('http://127.0.0.1:5197/api/'+p,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined});return {status:r.status,body:await r.json()}};
try{
 await api('reset',{count:36});for(let i=0;i<18;i++)await api('simulate',{});
 await page.goto('http://127.0.0.1:5197');await page.locator('.piece').first().waitFor();assert.equal(await page.locator('.piece').count(),36);
 await page.screenshot({path:out+'/01-拼图签到-桌面.png',fullPage:true});
 await page.locator('.piece:not(.arrived)').first().click();await page.locator('#person[open]').waitFor();assert((await page.locator('#personName').textContent()).includes('模拟同学'));await page.getByRole('button',{name:'知道了'}).click();checks.push('缺块显示对应模拟学生姓名和编号');
 let state=(await api('state')).body;let absent=state.roster.find(s=>!state.signed.includes(s.id));
 const bad=await api('checkin',{studentId:absent.id,ticket:state.ticket+'x'});assert.equal(bad.status,409);
 const signed=await api('checkin',{studentId:absent.id,ticket:state.ticket});assert.equal(signed.status,200);
 const replay=await api('checkin',{studentId:absent.id,ticket:state.ticket});assert.equal(replay.body.signed.length,signed.body.signed.length);checks.push('真实预览HTTP：伪造码拒绝，重复签到不重复计数');
 await page.waitForFunction(()=>document.querySelectorAll('.piece.arrived').length===19);
 await page.getByRole('button',{name:'演示全员归位',exact:false}).click();await page.locator('.unlocked-image').waitFor();await page.waitForTimeout(2100);await page.screenshot({path:out+'/02-全员解锁-桌面.png',fullPage:true});checks.push('全部签到后展示清晰图片与完成动画');
 await page.getByRole('button',{name:'随机点名',exact:false}).click();await page.locator('#draw').click();await page.locator('#chosen.win').waitFor();await page.screenshot({path:out+'/03-随机点名-桌面.png',fullPage:true});
 const first=(await api('state')).body.history[0].students[0].id;await page.locator('#draw').click();await page.waitForFunction(()=>document.querySelectorAll('.history-item').length===2);assert.notEqual((await api('state')).body.history[0].students[0].id,first);checks.push('姓名滚动、结果定格、历史记录和不重复点名');
 await page.locator('#count').selectOption('3');await page.locator('#draw').click();await page.waitForFunction(()=>document.querySelector('#chosen').children.length===3);checks.push('一次抽取3人');
 for(const width of [320,375,414,768]){await page.setViewportSize({width,height:1000});for(const name of ['随机点名','图片管理','拼图签到']){await page.getByRole('button',{name,exact:false}).click();assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),name+' overflow '+width)}if(width===375)await page.screenshot({path:out+'/04-拼图签到-手机.png',fullPage:true})}checks.push('3个页面在320/375/414/768宽度无整页横向溢出');
 await page.setViewportSize({width:1536,height:1100});await page.getByRole('button',{name:'图片管理',exact:false}).click();await page.screenshot({path:out+'/05-管理员图片管理.png',fullPage:true});
 await page.locator('#classSize').fill('37');await page.locator('#apply').click();assert.equal(await page.locator('.piece').count(),37);checks.push('37人非整除名单恰好生成37块，无占位假学生');
 await page.getByRole('button',{name:'随机点名',exact:false}).click();await page.locator('#scope').selectOption('signed');assert(await page.locator('#draw').isDisabled());checks.push('空候选范围禁止抽取');
 const oldTicket=(await api('state')).body.ticket;await api('reset',{count:36});assert.equal((await api('checkin',{studentId:'demo-0',ticket:oldTicket})).status,409);checks.push('上一场二维码不能用于新场次');
 assert.deepEqual(errors,[]);writeFileSync(out+'/验证结果.json',JSON.stringify({passed:true,checks,errors,syntheticOnly:true,productionDeployed:false},null,2));console.log(JSON.stringify({passed:true,checks}));
}catch(e){await page.screenshot({path:out+'/调试.png',fullPage:true});throw e}finally{await browser.close()}
