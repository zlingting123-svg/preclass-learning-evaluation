import { resolve,isAbsolute,relative,sep } from 'node:path';
import { ensure } from './errors.js';

export function config() {
  const production=process.env.NODE_ENV==='production';
  ensure(!production||process.env.DEPLOYMENT_MODE==='single-host',503,'PRODUCTION_UNCONFIGURED','生产模式需显式配置single-host部署');
  let appOrigin:string|null=null,staticDir:string|null=null;
  if(production){
    try{const url=new URL(process.env.APP_ORIGIN??'');ensure(url.protocol==='https:'&&!url.username&&!url.password&&url.origin===(process.env.APP_ORIGIN??'')&&!['localhost','127.0.0.1','0.0.0.0'].includes(url.hostname),503,'PRODUCTION_UNCONFIGURED','需配置规范HTTPS域名APP_ORIGIN');appOrigin=url.origin}catch{ensure(false,503,'PRODUCTION_UNCONFIGURED','需配置规范HTTPS域名APP_ORIGIN')}
    ensure(process.env.DB_PATH&&isAbsolute(process.env.DB_PATH)&&process.env.STATIC_DIR&&isAbsolute(process.env.STATIC_DIR),503,'PRODUCTION_UNCONFIGURED','需指定独立的绝对数据库和静态目录');
    staticDir=resolve(process.env.STATIC_DIR);const rel=relative(staticDir,resolve(process.env.DB_PATH));
    ensure(rel!==''&&(rel==='..'||rel.startsWith('..'+sep)||isAbsolute(rel)),503,'PRODUCTION_UNCONFIGURED','数据库不能放在公开静态目录内');
  }
  ensure(!process.env.STORAGE_MODE || process.env.STORAGE_MODE === 'local-sqlite', 503, 'STORAGE_UNCONFIGURED', '尚未配置云存储适配器');
  ensure(!process.env.AUTH_MODE || process.env.AUTH_MODE === 'local-bcrypt', 503, 'AUTH_UNCONFIGURED', '尚未配置云认证适配器');
  const host = process.env.HOST ?? '127.0.0.1';
  ensure(['127.0.0.1', 'localhost', '::1'].includes(host), 503, 'LOCAL_ONLY', '当前适配器仅允许本机访问');
  const port = Number(process.env.PORT ?? '3001');
  ensure(Number.isInteger(port) && port >= 1 && port <= 65535, 400, 'VALIDATION_ERROR', '端口配置无效');
  return { host, port, dbPath: resolve(process.env.DB_PATH ?? 'work/local.sqlite'),production,appOrigin,staticDir };
}
