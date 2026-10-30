import {readFileSync} from 'node:fs';
export const MEE_WEBSITE='https://www.mee.gov.cn/';
export function isMeeUrl(value){try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&(u.hostname==='mee.gov.cn'||u.hostname.endsWith('.mee.gov.cn'))}catch{return false}}
export function allowedUploaded(source){return !source.url||isMeeUrl(source.url)}
const stop=new Set(['什么','怎么','如何','哪些','可以','请问','一下','这个','然后','是否','说明','中的','的是','有什么','为什么']);
export function terms(value){const words=value.toLowerCase().replace(/\s+/g,'').match(/[a-z][a-z0-9.-]{1,}|[\u4e00-\u9fff]+/g)||[];return [...new Set(words.flatMap(w=>/^[\u4e00-\u9fff]+$/.test(w)&&w.length>2?Array.from({length:w.length-1},(_,i)=>w.slice(i,i+2)):[w]).filter(w=>!stop.has(w)))]}
export function rank(question,sources,minimum=.35){const q=terms(question);const identifiers=(question.toLowerCase().match(/[a-z][a-z0-9.-]*[0-9][a-z0-9.-]*/g)||[]);if(!q.length)return [];return sources.map(s=>{const hay=s.content.toLowerCase().replace(/\s+/g,'');const hits=q.filter(t=>hay.includes(t));return {...s,score:identifiers.every(t=>hay.includes(t))?hits.length/q.length:0,matched:hits.length}}).filter(s=>s.score>=minimum&&s.matched>=Math.min(2,q.length)).sort((a,b)=>b.score-a.score).slice(0,4)}
export function localGuidance(question,history=[]){const q=question.trim();const professional=/标准|法规|法律|限值|浓度|排放|评价等级|计算|公式|模型|污染|环评|监测|高斯|承载力|排污许可|土壤|大气|水质|噪声|技术导则|HJ\s*\d|GB\s*\d/i.test(q);
 if(!professional&&q.length<=80&&/(学好|学习好|怎样学习|如何学习|怎么学习|课程怎么学|课程如何学|预习|复习|学习建议|学习计划|学习方法|然后学习)/.test(q))return '可以先按已上传课件的顺序阅读，记录不明白的地方，再带着具体问题提问。若想了解某个知识点，请补充课件章节或具体问题。';
 if(/^(你好|您好|谢谢|好的|明白了)[！!。\s]*$/.test(q))return /谢谢|好的|明白/.test(q)?'不客气。有具体问题时，可以注明课件章节或文件名称。':'你好，可以就已上传资料提问，也可以说明你想了解哪部分内容。';
 if(/^(然后呢|然后|接下来呢|这个呢|怎么理解|解释一下|总结一下|展开一下)[？?。\s]*$/.test(q)&&!history.some(m=>m.role==='user'&&terms(m.text||'').length>3))return '请补充具体问题或课件章节。目前还不能确定你指的是哪一部分。';
 return null;
}
let cachedPath='',cachedAt=0,cachedIndex=null;
export function officialEvidence(question,classId,{path=process.env.MEE_CACHE_FILE||'/var/lib/preclass/official-cache/index.json',now=Date.now()}={}){
 if(path!==cachedPath||now-cachedAt>30000||!cachedIndex){cachedPath=path;cachedAt=now;try{cachedIndex=JSON.parse(readFileSync(path,'utf8'))}catch{cachedIndex=null}}
 if(!cachedIndex)return [];
 const rows=[];
 for(const doc of cachedIndex.documents||[]){if(!isMeeUrl(doc.url)||typeof doc.text!=='string'||/已废止|已失效/.test(doc.documentStatus||''))continue;
  const age=now-Date.parse(doc.retrievedAt);const fresh=Number.isFinite(age)&&age>=0&&age<=24*3600*1000;
  if(!fresh)continue;
  const chunks=doc.text.match(/[\s\S]{1,850}/g)||[];
  for(let i=0;i<chunks.length;i++)rows.push({id:'web_mee_cache_'+doc.version.slice(0,16)+'_'+i,scopeId:classId,topicId:'official_web',sourceType:'mee_official',title:doc.title,url:doc.url,version:doc.version,approved:true,keywords:[],publishedAt:doc.publishedAt||null,effectiveDate:doc.effectiveDate||null,documentStatus:doc.documentStatus||'unverified',retrievedAt:doc.retrievedAt,content:chunks[i]});
 }
 const found=rank(question,rows,.4);found.sort((a,b)=>b.score-a.score||String(b.publishedAt||'').localeCompare(String(a.publishedAt||'')));
 return found.slice(0,3);
}
export function retrieveStrict(core,input){
 const guidance=localGuidance(input.question,input.history||[]);if(guidance)return {status:'local_guidance',message:guidance,evidence:[],scoreType:'non_subject_guidance'};
 let question=input.question;
 if(/^(那|那么|然后|这个|它|这一步|上述|刚才|总结|展开|解释)/.test(question)&&question.length<24){const previous=[...(input.history||[])].reverse().find(m=>m.role==='user'&&m.text&&terms(m.text).length>3);if(previous)question=previous.text+'\n'+question}
 const sources=[];
 for(const s of core.store.all('ai_imported_source')){if(s.state!=='published'||!(s.classId===input.courseId||s.classId==='__all_classes__')||!allowedUploaded(s))continue;for(let i=0;i<s.chunks.length;i++)sources.push({id:s.id+'_'+i,scopeId:input.courseId,topicId:'imported_material',title:s.title,content:s.chunks[i],version:s.version,approved:true,url:s.url,sourceType:s.url?'mee_official':'uploaded_material',keywords:[]})}
 for(const m of core.store.all('course_material')){if(m.classId!==input.courseId||m.state!=='published'||!allowedUploaded(m))continue;const chunks=m.content.match(/[\s\S]{1,700}/g)||[];chunks.forEach((content,i)=>sources.push({id:m.id+'_'+i,scopeId:input.courseId,topicId:'course_material',title:m.title,content,version:String(m.version),approved:true,sourceType:'uploaded_material',keywords:[]}))}
 const uploaded=rank(question,sources).slice(0,3),official=core.store.get('ai_web_policy','__all_classes__')?.enabled===false?[]:officialEvidence(question,input.courseId);
 const evidence=[...official,...uploaded];
 return evidence.length?{status:'supported',evidence,scoreType:'uploaded_and_mee_only'}:{status:'insufficient',evidence:[],scoreType:'no_authorized_evidence',message:'目前已上传资料和已缓存的生态环境部官网文件不足以支持这个问题，我不能自行补充专业知识。请补充相关资料、具体章节或生态环境部文件链接。'};
}
