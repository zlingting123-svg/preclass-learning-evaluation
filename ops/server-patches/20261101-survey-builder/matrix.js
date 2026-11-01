import {ensure} from './errors.js';
import {keyFor} from './service.js';
export function validateMatrixAnswer(q,value,final){
 if(value===undefined){ensure(!final||!q.required,400,'REQUIRED','请完成矩阵题：'+q.title);return}
 ensure(value!==null&&typeof value==='object'&&!Array.isArray(value),400,'INVALID_ANSWERS','矩阵答案格式不正确');
 const rows=q.rows||[];ensure(Object.keys(value).every(id=>rows.some(r=>r.id===id)),400,'INVALID_ANSWERS','矩阵答案包含未知评分项目');
 for(const row of rows){const v=value[row.id];ensure(v===undefined||typeof v==='string'&&q.options.includes(v),400,'INVALID_OPTIONS','矩阵评分不是有效选项');if(final&&q.required)ensure(v!==undefined,400,'REQUIRED','请完成评分项目：'+row.title)}
}
export function flattenMatrixSurvey(survey,responses){
 if(!survey.questions.some(q=>q.type==='matrix'))return{questions:survey.questions,responses};
 const questions=survey.questions.flatMap(q=>q.type==='matrix'?(q.rows||[]).map(row=>({id:'matrix_'+keyFor(q.id,row.id).slice(0,48),title:q.title+' — '+row.title,type:'single',required:q.required,options:q.options,_parent:q.id,_row:row.id})):q);
 return{questions,responses:responses.map(r=>({...r,answers:{...r.answers,...Object.fromEntries(questions.filter(q=>q._parent).map(q=>[q.id,r.answers[q._parent]?.[q._row]]))}}))};
}
