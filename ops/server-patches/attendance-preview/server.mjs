import http from 'node:http';
import {readFileSync} from 'node:fs';
import {randomUUID,randomBytes,createHmac,randomInt,timingSafeEqual} from 'node:crypto';
import QRCode from 'qrcode';
const root=new URL('./',import.meta.url),key=randomBytes(32),initial=readFileSync(new URL('mountain.jpg',root));
let nextPhoto={bytes:initial,mime:'image/jpeg'},photo=nextPhoto,session=randomUUID(),signed=new Set(),called=new Set(),history=[];
let roster=Array.from({length:36},(_,i)=>({id:'demo-'+i,name:'模拟同学'+String(i+1).padStart(2,'0'),number:'DEMO'+String(i+1).padStart(3,'0')}));
roster.slice(0,18).forEach(s=>signed.add(s.id));
const sign=x=>createHmac('sha256',key).update(x).digest('base64url');
function ticket(){let body=session+'.'+Math.floor(Date.now()/30000);return body+'.'+sign(body)}
function valid(t){if(typeof t!=='string')return false;let [s,w,sig]=t.split('.');if(s!==session||w!==String(Math.floor(Date.now()/30000))||!sig)return false;let expected=sign(s+'.'+w);return sig.length===expected.length&&timingSafeEqual(Buffer.from(sig),Buffer.from(expected))}
function state(){return {session,roster,signed:[...signed],called:[...called],history,photo:'/photo?session='+session,nextPhoto:'/next-photo',expiresAt:(Math.floor(Date.now()/30000)+1)*30000,ticket:ticket(),demo:true}}
const server=http.createServer(async(req,res)=>{try{
 const u=new URL(req.url,'http://127.0.0.1:5197');res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
 const json=(data,status=200)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(data))};
 if(req.method==='GET'&&u.pathname==='/api/state')return json(state());
 if(req.method==='GET'&&u.pathname==='/qr'){res.writeHead(200,{'Content-Type':'image/svg+xml'});return res.end(await QRCode.toString('http://127.0.0.1:5197/student?ticket='+encodeURIComponent(ticket()),{type:'svg',margin:2,errorCorrectionLevel:'M',color:{dark:'#071a2b',light:'#ffffff'}}))}
 if(req.method==='GET'&&['/photo','/next-photo'].includes(u.pathname)){const p=u.pathname==='/photo'?photo:nextPhoto;res.writeHead(200,{'Content-Type':p.mime});return res.end(p.bytes)}
 if(req.method==='POST'){
  if(req.headers.origin&&req.headers.origin!=='http://127.0.0.1:5197')return json({error:'来源不允许'},403);
  let data='';for await(const c of req){data+=c;if(data.length>4000000)return json({error:'图片不超过2MB'},413)}let body=JSON.parse(data||'{}');
  if(u.pathname==='/api/checkin'){if(!valid(body.ticket))return json({error:'二维码已更新，请重新扫码'},409);if(!roster.some(s=>s.id===body.studentId))return json({error:'不在模拟名单中'},403);signed.add(body.studentId);return json(state())}
  if(u.pathname==='/api/simulate'){const absent=roster.filter(s=>!signed.has(s.id));if(absent.length)signed.add(absent[randomInt(absent.length)].id);return json(state())}
  if(u.pathname==='/api/reset'){
   const n=Number(body.count??roster.length);if(!Number.isInteger(n)||n<1||n>500)return json({error:'人数范围1–500'},400);
   roster=Array.from({length:n},(_,i)=>({id:'demo-'+i,name:'模拟同学'+String(i+1).padStart(2,'0'),number:'DEMO'+String(i+1).padStart(3,'0')}));
   session=randomUUID();signed.clear();called.clear();history=[];photo=nextPhoto;return json(state());
  }
  if(u.pathname==='/api/image'){
   const match=/^data:image\/(jpeg|png);base64,([a-zA-Z0-9+/=]+)$/.exec(body.image||'');if(!match)return json({error:'请选择JPG或PNG'},400);
   const bytes=Buffer.from(match[2],'base64');if(bytes.length>2097152||!(bytes.subarray(0,3).equals(Buffer.from([255,216,255]))||bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))))return json({error:'图片格式或大小无效'},400);
   nextPhoto={bytes,mime:'image/'+match[1]};return json({ok:true});
  }
  if(u.pathname==='/api/draw'){
   const count=Number(body.count),scope=body.scope;if(![1,3,5].includes(count)||!['all','signed','absent'].includes(scope))return json({error:'点名设置无效'},400);
   let pool=roster.filter(s=>(scope==='all'||(scope==='signed'?signed.has(s.id):!signed.has(s.id)))&&(body.repeat||!called.has(s.id)));
   if(pool.length<count)return json({error:'可点名人数不足，请更换范围或开始新一轮'},409);
   const result=[];for(let i=0;i<count;i++){const chosen=pool.splice(randomInt(pool.length),1)[0];result.push(chosen);called.add(chosen.id)}
   history.unshift({id:randomUUID(),students:result,time:new Date().toISOString(),scope});history=history.slice(0,20);return json({result,state:state()});
  }
  if(u.pathname==='/api/reset-draw'){called.clear();return json(state())}
 }
 const file=u.pathname==='/'?'index.html':u.pathname==='/student'?'student.html':u.pathname.slice(1);
 if(!['index.html','student.html','app.js','layout.js','style.css','theme.css'].includes(file))return json({error:'未找到'},404);
 res.writeHead(200,{'Content-Type':file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html; charset=utf-8'});res.end(readFileSync(new URL(file,root)));
 }catch{res.writeHead(500,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'预览请求失败，请刷新重试'}))}});
server.listen(5197,'127.0.0.1',()=>console.log('Isolated synthetic attendance preview: http://127.0.0.1:5197'));
