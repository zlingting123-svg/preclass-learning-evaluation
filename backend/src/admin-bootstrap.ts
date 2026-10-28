import { randomBytes } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { SqliteStore } from './store.js';
import { LocalAuth, type Account } from './auth.js';
import { config } from './config.js';
const settings=config(),store=new SqliteStore(settings.dbPath);
const username='service_admin',output=resolve(dirname(settings.dbPath),'服务管理员账号.txt');
try{
 const existing=store.get<Account>('account',username);
 if(existing){if(existing.user.role!=='admin'||!existsSync(output))throw new Error('管理员状态需人工核查');console.log('已有服务管理员保留；凭据文件：'+output);}
 else{
  const password='A!'+randomBytes(18).toString('base64url')+'9z',auth=new LocalAuth(store),prepared=await auth.prepareUser(username,password,'服务管理员','admin');
  mkdirSync(dirname(output),{recursive:true,mode:0o700});
  store.transaction(()=>{auth.persistPrepared(prepared);writeFileSync(output,`仅限本机测试，勿上传或打包\n管理端：http://127.0.0.1:5174/admin/login\n账号：${username}\n密码：${password}\n`,{mode:0o600,flag:'wx'});});
  console.log('已创建专用服务管理员；凭据文件：'+output);
 }
}catch{console.error('管理员初始化失败；原账号和文件保留，请核查本机配置。');process.exitCode=1;}
finally{store.close();}
