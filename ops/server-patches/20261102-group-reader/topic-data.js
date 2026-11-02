export function validateTopics(values){
 const topics=values.map(v=>String(v??'').trim()).filter(Boolean);
 if(!topics.length)throw Error('没有识别到主题，请每行填写一个主题。');
 if(topics.length>100)throw Error('一次最多导入 100 个主题，请减少后重试。');
 const bad=topics.findIndex(t=>t.length>200);
 if(bad>=0)throw Error('第 '+(bad+1)+' 个主题超过 200 字，请缩短后重试。');
 return topics;
}
export function textTopics(text){return validateTopics(text.replace(/^\uFEFF/,'').split(/\r\n?|\n/));}
export function sheetTopics(rows){
 let clean=rows.map(r=>r.map(v=>String(v??'').trim())).filter(r=>r.some(Boolean));
 const headers=['主题','分组主题','小组主题'];
 const first=clean[0]??[],header=first.findIndex(v=>headers.includes(v));
 if(header>=0){
  if(first.some((v,i)=>v&&i!==header&&!['序号','题号','编号','小组'].includes(v)))throw Error('请使用“主题”单列，或“序号、主题”两列。');
  const data=clean.slice(1);
  if(data.some(r=>r.some((v,i)=>v&&i!==header&&(!['序号','编号','题号','小组'].includes(first[i])||!/^\d+$/.test(v)))))throw Error('主题表含多余内容，请只保留主题与数字序号。');
  if(data.some(r=>!r[header]))throw Error('有一行缺少主题，请补全或删除该行。');
  return validateTopics(data.map(r=>r[header]));
 }
 return validateTopics(clean.map((r,i)=>{const cells=r.filter(Boolean);if(cells.length===1)return cells[0];if(cells.length===2&&/^\d+$/.test(cells[0]))return cells[1];throw Error('第 '+(i+1)+' 行包含多个内容，请使用主题单列或“序号、主题”两列。');}));
}
export function applyBatch(draft,topics,allow){if(!Number.isInteger(Number(draft.totalGroups))||Number(draft.totalGroups)<1||Number(draft.totalGroups)>100)throw Error('请先设置 1–100 个小组。');return {...draft,totalGroups:Math.max(Number(draft.totalGroups),topics.length),topics:Array.from({length:Math.max(Number(draft.totalGroups),topics.length)},(_,i)=>i<topics.length?{topic:topics[i],allowStudentTopic:allow}:draft.topics[i]??{topic:'',allowStudentTopic:true})};}
export function applyCommon(draft,topic,allow){const values=validateTopics([topic]);if(!Number.isInteger(Number(draft.totalGroups))||Number(draft.totalGroups)<1||Number(draft.totalGroups)>100)throw Error('请先设置 1–100 个小组。');return {...draft,topics:Array.from({length:Number(draft.totalGroups)},()=>({topic:values[0],allowStudentTopic:allow}))};}
