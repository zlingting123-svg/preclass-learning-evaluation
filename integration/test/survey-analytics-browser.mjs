import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {once} from 'node:events';
import {randomUUID} from 'node:crypto';
import {mkdirSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const out=root+'/integration/verification/survey-analytics';mkdirSync(out,{recursive:true});
const require=createRequire(root+'/frontend/package.json'),{chromium}=require('playwright-core'),{createServer}=await import(pathToFileURL(require.resolve('vite')));
const mod=n=>import(pathToFileURL(root+'/backend/dist/backend/src/'+n+'.js'));
const [{SqliteStore},{Service},{LocalAuth},{createApp},{QuestionnaireService}]=await Promise.all(['store','service','auth','app','questionnaires'].map(mod));
const store=new SqliteStore(':memory:'),core=new Service(store),auth=new LocalAuth(store),qs=new QuestionnaireService(core),password=randomUUID(),teacher=await auth.createUser('analytics_teacher',password,'模拟分析教师','teacher'),c=core.createClass(teacher,'模拟班级 · 数据舱演示');
const titles=['你更习惯通过哪种方式理解课程内容？','你对环境评价与管理的兴趣程度？','哪些学习资源对你最有帮助？','面对复杂问题时，你倾向于怎样开始？','你希望课堂讨论采用什么形式？','你通常如何检查自己的学习成果？','你愿意参与哪些实践活动？','你更关注课程中的哪些内容？','你最希望提升的学习环节是什么？','你倾向于选择哪类课后练习？','选填：你对课程还有哪些建议？','选填：尚未收到回答的题目'];
const questions=titles.map((title,i)=>({id:'q'+i,title,type:i===10?'text':i===2||i===6?'multiple':'single',required:false,options:i===10?[]:i===0?['自主阅读','课堂讲解','小组讨论']:i===2||i===6?['案例研讨','实地调研','数据分析','文献阅读','模拟项目']:i===4?['结构化小组交流并整理共同的结论和依据','个人先阅读背景资料再集中讨论','与教师逐步讨论不理解的关键概念','结合真实案例做开放式辩论']:['选项一','选项二','选项三','选项四','选项五']}));
const survey=qs.save(teacher,{classId:c.id,title:'学习偏好与课程期待 · 模拟问卷',questions,expectedVersion:0,deadlineAt:null,durationMinutes:null});qs.transition(teacher,survey.id,survey.version,'publish');
for(let i=0;i<12;i++){
 const u={id:'sample-student-'+i,role:'student',displayName:'模拟学生'+i};store.put('user',u.id,u);core.join(u,c.joinCode);
 if(i>=10)continue;qs.start(u,survey.id);if(i===9)continue;
 const answers={};for(const q of questions){const n=questions.indexOf(q);if(n===11)continue;if(n===10){if(i%2===0)answers[q.id]='模拟建议：增加真实案例与课堂讨论。';continue;}if(n===5&&i>4)continue;answers[q.id]=q.type==='multiple'?[q.options[0],q.options[1],...(i%2===0?[q.options[2]]:[])]:q.options[(i+n)%q.options.length];}qs.submit(u,survey.id,answers);
}
const stats=qs.stats(teacher,survey.id);assert.equal(stats.questions[2].answered,9);assert.deepEqual(stats.questions[2].counts.map(c=>c.value),[9,9,5,0,0]);assert.equal(stats.questions[5].answered,5);assert.equal(stats.questions[11].answered,0);
let server,vite,browser;const errors=[],warnings=[],checks=[];
try{
 process.env.DEV_FRONTEND_ORIGIN='http://127.0.0.1:5188';process.env.VITE_API_MODE='http';process.env.VITE_LEGACY_UI='false';server=createApp(core,auth).listen(3008,'127.0.0.1');await once(server,'listening');vite=await createServer({root:root+'/frontend',configFile:root+'/frontend/vite.config.ts',logLevel:'error',server:{port:5188,strictPort:true,proxy:{'/api':'http://127.0.0.1:3008'}}});await vite.listen();browser=await chromium.launch({executablePath:process.env.BROWSER_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const page=await browser.newPage({viewport:{width:1440,height:1100}});page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='warning'&&m.text().includes('ECharts'))warnings.push(m.text())});
 await page.goto('http://127.0.0.1:5188/');await page.getByLabel('账号',{exact:true}).fill('analytics_teacher');await page.getByLabel('密码',{exact:true}).fill(password);await page.getByRole('button',{name:'进入学习空间',exact:true}).click();await page.getByRole('link',{name:'个人中心',exact:true}).waitFor();await page.getByRole('link',{name:'查看统计',exact:true}).first().click();await page.getByRole('heading',{name:'逐题探索',exact:true}).waitFor();
 assert.equal(await page.locator('.sa-question-grid>.sa-question').count(),12);assert.equal(await page.locator('.sa-metrics').innerText().then(s=>s.replace(/\s/g,'')),'当前名单12人已提交9人作答中1人未开始2人');assert.ok(await page.locator('#analytics-q2 > .sa-values').innerText().then(s=>s.includes('100%')&&s.includes('55.6%')));assert.equal(await page.locator('#analytics-q11 .sa-empty').count(),1);assert.ok(await page.locator('#analytics-q10').innerText().then(s=>s.includes('模拟建议')));checks.push('真实HTTP与内存数据库：12题全部显示，多选分母9人、选择率100/100/55.6%，选填题分母5人，文字与空题保留');
 const kinds=new Set(await page.locator('.sa-question-grid>.sa-question').evaluateAll(es=>es.map(e=>e.dataset.chartKind)));assert.ok(kinds.has('polar')&&kinds.has('treemap')&&kinds.has('donut')&&kinds.has('stack')&&kinds.has('lollipop'));checks.push('自动生成极坐标、树图、环形、占比分布、点线等多种图形');
 await page.screenshot({path:out+'/桌面总览.png',fullPage:true});
 const first=page.locator('#analytics-q0');for(const kind of ['treemap','polar','lollipop','bar','column','donut','stack']){const target=kind==='polar'?page.locator('#analytics-q2'):first;await target.locator('select').selectOption(kind);assert.equal(await target.getAttribute('data-chart-kind'),kind)}checks.push('7种图形切换正确；多选菜单不提供饼图、树图');
 assert.equal(await page.locator('#analytics-q2 select option[value=donut]').count(),0);
 await first.getByRole('button',{name:'⤢ 放大查看',exact:true}).click();await page.locator('dialog[open] .sa-chart canvas').waitFor();await page.screenshot({path:out+'/放大分析.png'});const dl=page.waitForEvent('download');await page.locator('dialog[open]').getByRole('button',{name:'↓ 导出图形'}).click();const file=await dl;await file.saveAs(out+'/导出图形样例.png');await page.keyboard.press('Escape');assert.equal(await page.locator('dialog[open]').count(),0);checks.push('放大、Escape关闭、PNG导出成功');
 await page.locator('.sa-heat tbody tr').nth(6).locator('th button').click();await page.waitForFunction(()=>document.activeElement?.id==='analytics-q6');checks.push('热力矩阵点击定位并聚焦对应题目');
 for(const w of [320,375,414,768]){await page.setViewportSize({width:w,height:900});await page.evaluate(()=>window.scrollTo(0,0));await page.waitForTimeout(150);const bounds=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));assert.ok(bounds.scroll<=w+1,JSON.stringify(bounds));if(w===375)await page.screenshot({path:out+'/手机总览.png',fullPage:true})}checks.push('320/375/414/768像素无整页横向溢出');
 await page.setViewportSize({width:1440,height:1100});await first.locator('select').selectOption('auto');await page.locator('#analytics-q2 select').selectOption('auto');await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:out+'/桌面首屏.png'});await page.locator('#analytics-q2').scrollIntoViewIfNeeded();await page.screenshot({path:out+'/多图分析.png'});assert.deepEqual(errors,[]);assert.deepEqual(warnings,[]);checks.push('无浏览器运行错误或ECharts容器告警');writeFileSync(out+'/浏览器验证.json',JSON.stringify({passed:true,checks,errors,warnings,syntheticData:true},null,2));console.log(JSON.stringify({passed:true,checks}));
}finally{await browser?.close();await vite?.close();server?.close();server?.closeAllConnections();store.close()}
