import {test} from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {randomUUID} from 'node:crypto';
import {resolve} from 'node:path';
import {safeDomain,readPublicPage,searchOfficial} from '../src/web-knowledge.js';
import {SqliteStore} from '../src/store.js';
import {Service} from '../src/service.js';
import {LocalAuth} from '../src/auth.js';
import {createCourseAi} from '../src/ai.js';
import {createApp} from '../src/app.js';

test('域名匹配和服务器防护拒绝伪造域名、内网、非 HTTPS、非允许站点',async()=>{
 assert.equal(safeDomain('https://www.example.gov.cn/a',['example.gov.cn']),true);
 for(const u of ['http://example.gov.cn','https://example.gov.cn.evil.test','https://example.gov.cn@evil.test','https://127.0.0.1/','https://example.gov.cn:444/'])assert.equal(safeDomain(u,['example.gov.cn']),false);
 await assert.rejects(()=>readPublicPage('https://127.0.0.1/',['127.0.0.1']));
 await assert.rejects(()=>readPublicPage('https://localhost/',['localhost']));
});
test('搜索按域名过滤并保留链接，失败不伪造证据',async()=>{
 let requested='';const fake:typeof fetch=async(input)=>{requested=String(input);return new Response(JSON.stringify({web:{results:[{title:'官方网页',url:'https://www.example.gov.cn/page',description:'可引用的网页摘要'},{title:'伪造',url:'https://example.gov.cn.evil.test/page',description:'不应出现'},{title:'缺内容',url:'https://example.gov.cn/empty'}]}}),{status:200})};
 const r=await searchOfficial('环境知识','class-a',['example.gov.cn'],'test-key',new AbortController().signal,fake);
 assert.equal(r.length,1);assert.equal(r[0].url,'https://www.example.gov.cn/page');assert.equal(r[0].scopeId,'class-a');assert.ok(decodeURIComponent(requested).includes('site:example.gov.cn'));
 await assert.rejects(()=>searchOfficial('问题','class-a',['example.gov.cn'],'test-key',new AbortController().signal,async()=>new Response('',{status:503})));
});
test('管理员配置网站及学生搜索回退，教师不能配置，来源限定所选域名',async()=>{
 const store=new SqliteStore(':memory:'),core=new Service(store),auth=new LocalAuth(store),password=randomUUID();
 const teacher=await auth.createUser('web_teacher',password,'教师','teacher'),student=await auth.createUser('web_student',password,'学生','student');await auth.createUser('web_admin',password,'管理员','admin');const cls=core.createClass(teacher,'班级');core.join(student,cls.joinCode!);
 const ai=createCourseAi(core,auth,{ledgerPath:':memory:',fingerprintKey:'a'.repeat(64),configPath:resolve('../ai-module/config/mock.example.json'),delayMs:1});const server=createApp(core,auth,ai).listen(0,'127.0.0.1');await once(server,'listening');const base=`http://127.0.0.1:${(server.address() as {port:number}).port}/api/v1`;
 const admin=(await auth.login({username:'web_admin',password})).accessToken,st=(await auth.login({username:'web_student',password})).accessToken,tt=(await auth.login({username:'web_teacher',password})).accessToken;
 const realFetch=globalThis.fetch,oldKey=process.env.BRAVE_SEARCH_API_KEY;const request=(path:string,method:string,token:string,body?:unknown)=>realFetch(base+path,{method,headers:{Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
 try {const policy={classId:cls.id,domains:['example.gov.cn'],enabled:true};assert.equal((await request('/admin/knowledge/web/'+cls.id,'PUT',tt,policy)).status,403);assert.equal((await request('/admin/knowledge/web/'+cls.id,'PUT',admin,policy)).status,200);
 process.env.BRAVE_SEARCH_API_KEY='mock-key';globalThis.fetch=async(input,init)=>String(input).startsWith('https://api.search.brave.com/')?new Response(JSON.stringify({web:{results:[{title:'官方资料',url:'https://example.gov.cn/reference',description:'生态修复可促进生态系统恢复。'},{title:'无关',url:'https://untrusted.test/a',description:'无关内容'}]}}),{status:200}):realFetch(input,init);
 const r=await request('/core/ai/chat/stream','POST',st,{classId:cls.id,question:'生态修复如何进行',clientRequestId:randomUUID()});const text=await r.text();assert.match(text,/event: sources/);assert.match(text,/https:\/\/example.gov.cn\/reference/);assert.doesNotMatch(text,/untrusted/);assert.match(text,/event: done/);
 }finally{globalThis.fetch=realFetch;if(oldKey===undefined)delete process.env.BRAVE_SEARCH_API_KEY;else process.env.BRAVE_SEARCH_API_KEY=oldKey;server.close();server.closeAllConnections();await once(server,'close');ai.close();store.close()}
});

test('优先指定网站；无结果时依次查政府和其他公共机构网站',async()=>{
 const queries:string[]=[];
 const fake:typeof fetch=async(input)=>{const q=new URL(String(input)).searchParams.get('q')??'';queries.push(q);const results=q.includes('site:example.org')?[]:q.includes('site:gov.cn')?[{title:'政府网页',url:'https://www.gov.cn/page',description:'政府资料'},{title:'仿冒',url:'https://gov.cn.evil.test/page',description:'无效'}]:[];return new Response(JSON.stringify({web:{results}}))};
 const result=await searchOfficial('环境问题','c',['example.org'],'key',new AbortController().signal,fake);
 assert.equal(queries.length,2);assert.match(queries[0],/site:example.org/);assert.match(queries[1],/site:gov.cn/);assert.equal(result.length,1);assert.equal(result[0].url,'https://www.gov.cn/page');
 let count=0;const institutional:typeof fetch=async()=>new Response(JSON.stringify({web:{results:++count===2?[{title:'机构',url:'https://www.university.edu.cn/a',description:'资料'}]:[]}}));
 const other=await searchOfficial('问题','c',[],'key',new AbortController().signal,institutional);assert.equal(count,2);assert.equal(other[0].url,'https://www.university.edu.cn/a');
 let calls=0;const preferred:typeof fetch=async()=>{calls++;return new Response(JSON.stringify({web:{results:[{title:'指定',url:'https://example.org/a',description:'资料'}]}}))};
 assert.equal((await searchOfficial('问题','c',['example.org'],'key',new AbortController().signal,preferred)).length,1);assert.equal(calls,1);
});

test('政府及公共机构无结果时可引用其他网页，明确标注身份待核实',async()=>{
 let calls=0;const fake:typeof fetch=async()=>{calls++;return new Response(JSON.stringify({web:{results:calls<3?[]:[{title:'其他参考',url:'https://example.org/reference',description:'待核实摘要'},{title:'内网',url:'https://127.0.0.1/a',description:'不得使用'}]}}))};
 const result=await searchOfficial('问题','c',[],'key',new AbortController().signal,fake);
 assert.equal(calls,3);assert.equal(result.length,1);assert.match(result[0].title,/身份待核实/);assert.equal(result[0].url,'https://example.org/reference');
});

test('未指定的地方政府和仪器厂商网页分别可从政府及其他范围找到',async()=>{
 const local:typeof fetch=async()=>new Response(JSON.stringify({web:{results:[{title:'地方政府',url:'https://www.example.gov.cn/policy',description:'地方政策'}]}}));
 const government=await searchOfficial('政策','c',[],'key',new AbortController().signal,local);assert.equal(government[0].url,'https://www.example.gov.cn/policy');assert.match(government[0].title,/政府网站/);
 let calls=0;const manufacturer:typeof fetch=async()=>new Response(JSON.stringify({web:{results:++calls===3?[{title:'仪器方法',url:'https://manufacturer.example.com/method',description:'仪器使用说明'}]:[]}}));
 const company=await searchOfficial('仪器方法','c',[],'key',new AbortController().signal,manufacturer);assert.equal(company[0].url,'https://manufacturer.example.com/method');assert.match(company[0].title,/身份待核实/);
});
