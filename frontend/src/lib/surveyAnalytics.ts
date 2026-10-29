import type {SurveyStats} from '@shared/questionnaires';
export type QuestionStat = SurveyStats['questions'][number];
export type ChartKind = 'donut' | 'stack' | 'column' | 'bar' | 'lollipop' | 'treemap' | 'polar';
export const chartNames: Record<ChartKind,string> = {treemap:'矩形树图',polar:'极坐标选择率',donut:'环形占比',stack:'占比分布',column:'柱状对比',bar:'横向对比',lollipop:'点线对比'};
export const optionCode=(i:number)=>i<26?String.fromCharCode(65+i):String(i+1);
export const percentage=(value:number,answered:number)=>answered>0?Math.round(value/answered*1000)/10:0;
export function chooseChart(q:QuestionStat,index:number):ChartKind {
 const n=q.counts.length,long=q.counts.some(c=>c.name.length>12);
 if(q.type==='multiple')return n<=8&&index%2===0?'polar':'lollipop';
 if(long||n>6)return index%2===0?'bar':'lollipop';
 if(n<=3)return 'donut';
 return (['treemap','stack','donut','lollipop'] as ChartKind[])[index%4];
}
