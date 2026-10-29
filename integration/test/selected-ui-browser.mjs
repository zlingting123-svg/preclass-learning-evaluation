import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {once} from 'node:events';
import {randomUUID} from 'node:crypto';
import {mkdirSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const require=createRequire(root+'/frontend/package.json'),{chromium}=require('playwright-core'),{createServer}=await import(pathToFileURL(require.resolve('vite')));
const mod=n=>import(pathToFileURL(root+'/backend/dist/backend/src/'+n+'.js'));
const [{SqliteStore},{Service},{LocalAuth},{createApp}]=await Promise.all(['store','service','auth','app'].map(mod));
const store=new SqliteStore(':memory:'),core=new Service(store),auth=new LocalAuth(store),password=randomUUID();
await auth.createUser('unified_admin',password,'模拟管理员','admin');const teacher=await auth.createUser('unified_teacher',password,'模拟教师','teacher'),student=await auth.createUser('unified_student',password,'模拟学生','student');const c=core.createClass(teacher,'模拟统一入口班');core.join(student,c.joinCode);
const out=root+'/integration/verification/selected-ui';mkdirSync(out,{recursive:true});let server,vite,browser;const results=[];
try{
 process.env.DEV_FRONTEND_ORIGIN='http://127.0.0.1:5187';process.env.VITE_API_MODE='http';process.env.VITE_LEGACY_UI='false';server=createApp(core,auth).listen(3007,'127.0.0.1');await once(server,'listening');
 vite=await createServer({root:root+'/frontend',configFile:root+'/frontend/vite.config.ts',logLevel:'error',server:{port:5187,strictPort:true,proxy:{'/api':'http://127.0.0.1:3007'}}});await vite.listen();browser=await chromium.launch({executablePath:process.env.BROWSER_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 let loginCalls=0,legacyCalls=0;
 async function login(username){const page=await(await browser.newContext({viewport:{width:1280,height:900}})).newPage();page.on('request',r=>{if(r.url().endsWith('/auth/login'))loginCalls++;if(r.url().endsWith('/auth/admin-login'))legacyCalls++});await page.goto('http://127.0.0.1:5187/design-preview.html');await page.getByLabel('账号',{exact:true}).waitFor();assert.equal(await page.getByRole('link',{name:/返回当前版本|当前版本/}).count(),0);assert.equal(await page.getByText('专用账号入口',{exact:true}).count(),0);await page.getByLabel('账号',{exact:true}).fill(username);await page.getByLabel('密码',{exact:true}).fill(password);const response=page.waitForResponse(r=>r.url().endsWith('/auth/login'));await page.getByRole('button',{name:'进入学习空间',exact:true}).click();return {page,session:(await(await response).json()).data};}
 const admin=await login('unified_admin');await admin.page.getByRole('link',{name:'账户管理',exact:true}).waitFor();assert.equal(admin.session.user.role,'admin');
 const loggedOut=admin.page.waitForResponse(r=>r.url().endsWith('/auth/logout'));await admin.page.getByRole('link',{name:'切换账号 ↗',exact:true}).click();await loggedOut;await admin.page.getByLabel('账号',{exact:true}).waitFor();assert.throws(()=>auth.authenticate(admin.session.accessToken));results.push('管理员共用账号入口进入管理空间，切换账号撤销原登录');
 await admin.page.screenshot({path:out+'/统一登录页.png',fullPage:true});
 const tp=(await login('unified_teacher')).page;await tp.getByRole('link',{name:'班级工作台',exact:true}).waitFor();assert.equal(await tp.getByText('专用账号入口',{exact:true}).count(),0);assert.equal(await tp.getByRole('link',{name:'API 管理',exact:true}).count(),0);results.push('教师共用入口进入教师工作空间，无专用管理入口');
 const sp=(await login('unified_student')).page;await sp.getByRole('link',{name:'我的班级',exact:true}).waitFor();assert.equal(await sp.getByRole('link',{name:'API 管理',exact:true}).count(),0);results.push('学生共用入口进入学生空间');
 for(const [name,status] of [['unified_admin',200],['unified_teacher',403],['unified_student',403]]){const s=await auth.login({username:name,password});const r=await fetch('http://127.0.0.1:3007/api/v1/admin/users',{headers:{Authorization:'Bearer '+s.accessToken}});assert.equal(r.status,status);}results.push('后台管理接口只允许管理员，师生返回403');
 const forged=await fetch('http://127.0.0.1:3007/api/v1/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'unified_student',password,role:'admin'})});assert.equal(forged.status,400);results.push('登录请求不能声明管理员角色提权');
 const legacy=await browser.newPage();await legacy.goto('http://127.0.0.1:5187/login');await legacy.getByLabel('账号',{exact:true}).waitFor();assert.equal(await legacy.getByRole('heading',{name:'欢迎回到学习空间',exact:true}).count(),1);assert.equal(await legacy.getByRole('link',{name:/返回当前版本|当前版本/}).count(),0);results.push('旧版登录页字段也统一为账号');
 assert.equal(loginCalls,3);assert.equal(legacyCalls,0);writeFileSync(out+'/浏览器与权限验证.json',JSON.stringify({passed:true,results,commonLoginCalls:loginCalls,legacyAdminLoginCalls:legacyCalls,productionWrites:false},null,2));console.log(JSON.stringify({passed:true,results}));
}finally{await browser?.close();await vite?.close();server?.close();server?.closeAllConnections();store.close();}
