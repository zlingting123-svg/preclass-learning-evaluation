/* Hallmark · pre-emit critique: P4 H5 E4 S5 R5 V5 */
import {useEffect,useRef,useState} from 'react';
import type {CSSProperties} from 'react';
import type {SurveyStats} from '@shared/questionnaires';
import * as echarts from 'echarts/core';
import {BarChart,PieChart,ScatterChart,TreemapChart} from 'echarts/charts';
import {GridComponent,TooltipComponent,PolarComponent} from 'echarts/components';
import {CanvasRenderer} from 'echarts/renderers';
import {chartNames,chooseChart,optionCode,percentage} from '../lib/surveyAnalytics';
import type {ChartKind,QuestionStat} from '../lib/surveyAnalytics';
import '../styles/survey-analytics.css';
echarts.use([BarChart,PieChart,ScatterChart,TreemapChart,GridComponent,TooltipComponent,PolarComponent,CanvasRenderer]);
function ChartCanvas({q,kind,onExpand}:{q:QuestionStat;kind:ChartKind;onExpand?:()=>void}) {
 const ref=useRef<HTMLDivElement>(null);
 useEffect(()=>{
  if(!ref.current||!q.answered)return;
  const el=ref.current,css=getComputedStyle(el),token=(name:string)=>css.getPropertyValue(name).trim();
  const colors=['--sa-c1','--sa-c2','--sa-c3','--sa-c4','--sa-c5','--sa-c6'].map(token),ink=token('--sa-ink'),muted=token('--sa-muted'),line=token('--sa-line');
  const chart=echarts.init(el),codes=q.counts.map((_,i)=>optionCode(i)),values=q.counts.map(c=>percentage(c.value,q.answered));
  const tip=(p:any)=>{const i=kind==='treemap'?p.data.optionIndex:kind==='stack'?p.seriesIndex:p.dataIndex,c=q.counts[i];return c?`${optionCode(i)} · ${c.name}\n${c.value} 人 · ${percentage(c.value,q.answered)}%${q.type==='multiple'?' 选择率':' 占比'}`:''};
  const base={color:colors,animation:!matchMedia('(prefers-reduced-motion: reduce)').matches,animationDuration:350,textStyle:{fontFamily:css.fontFamily,color:ink},tooltip:{trigger:'item',renderMode:'richText',confine:true,formatter:tip}};
  if(kind==='donut')chart.setOption({...base,series:[{type:'pie',radius:['52%','76%'],center:['50%','50%'],label:{show:true,formatter:'{b}',color:ink},data:q.counts.map((c,i)=>({name:codes[i],value:c.value}))}],graphic:[{type:'text',left:'center',top:'44%',style:{text:String(q.answered),fill:ink,fontSize:30,fontWeight:650}},{type:'text',left:'center',top:'59%',style:{text:'有效作答',fill:muted,fontSize:12}}]});
  else if(kind==='treemap')chart.setOption({...base,series:[{type:'treemap',roam:false,nodeClick:false,breadcrumb:{show:false},top:8,bottom:8,left:0,right:0,visibleMin:0,label:{show:true,formatter:(p:any)=>`${optionCode(p.data.optionIndex)}  ${percentage(p.value,q.answered)}%`,fontSize:15,color:token('--sa-paper')},itemStyle:{borderWidth:3,borderColor:token('--sa-paper'),gapWidth:3},data:q.counts.map((c,i)=>({name:c.name,value:c.value,optionIndex:i}))}]});
  else if(kind==='polar')chart.setOption({...base,polar:{radius:['20%','78%']},angleAxis:{type:'value',min:0,max:100,startAngle:90,axisLabel:{show:false},axisLine:{show:false},splitLine:{lineStyle:{color:line}}},radiusAxis:{type:'category',data:codes,axisLabel:{color:ink,fontSize:12},axisLine:{show:false},axisTick:{show:false}},series:[{type:'bar',coordinateSystem:'polar',roundCap:true,label:{show:true,position:'middle',formatter:(p:any)=>codes[p.dataIndex],color:token('--sa-paper'),fontSize:11},showBackground:true,backgroundStyle:{color:token('--sa-soft')},itemStyle:{color:(p:any)=>colors[p.dataIndex%colors.length]},data:values}]});
  else if(kind==='stack')chart.setOption({...base,grid:{left:8,right:8,top:40,bottom:40},xAxis:{type:'value',max:100,show:false},yAxis:{type:'category',data:['占比'],show:false},series:q.counts.map((_,i)=>({type:'bar',name:codes[i],stack:'total',barWidth:62,label:{show:values[i]>=10,formatter:codes[i]+'\n'+values[i]+'%',color:token('--sa-paper')},data:[values[i]]}))});
  else {
   const vertical=kind==='column',category={type:'category',data:codes,inverse:!vertical,axisTick:{show:false},axisLine:{show:false},axisLabel:{color:ink}},value={type:'value',min:0,max:100,axisLabel:{formatter:'{value}%',color:muted},splitLine:{lineStyle:{color:line}}};
   chart.setOption({...base,grid:{left:vertical?40:32,right:55,top:25,bottom:32},xAxis:vertical?category:value,yAxis:vertical?value:category,series:[{type:'bar',barMaxWidth:vertical?44:kind==='lollipop'?3:22,itemStyle:{borderRadius:vertical?[5,5,0,0]:[0,4,4,0],color:colors[0]},label:{show:kind!=='lollipop',position:vertical?'top':'right',formatter:(p:any)=>values[p.dataIndex]+'%',color:ink},data:values},...(kind==='lollipop'?[{type:'scatter',symbolSize:12,itemStyle:{color:colors[1]},label:{show:true,position:'right',formatter:(p:any)=>values[p.dataIndex]+'%',color:ink},data:values.map((v,i)=>[v,codes[i]])}]:[])]});
  }
  const resize=new ResizeObserver(()=>chart.resize());resize.observe(el);
  return()=>{resize.disconnect();chart.dispose()};
 },[q,kind]);
 const download=()=>{const chart=ref.current&&echarts.getInstanceByDom(ref.current);if(!chart)return;const a=document.createElement('a');a.download='问卷统计-'+q.id+'.png';a.href=chart.getDataURL({type:'png',pixelRatio:3,backgroundColor:getComputedStyle(ref.current!).getPropertyValue('--sa-paper').trim()});a.click()};
 return <><div className="sa-chart-actions">{onExpand&&<button type="button" onClick={onExpand}>⤢ 放大查看</button>}<button type="button" onClick={download}>↓ 导出图形</button></div><div ref={ref} className="sa-chart" style={{height:kind==='stack'?160:kind==='bar'||kind==='lollipop'?Math.max(240,q.counts.length*35+55):300}} role="img" aria-label={`${q.title}，${chartNames[kind]}，完整数据见下方明细`}/>{kind==='polar'&&<p className="sa-note sa-polar-note">每圈代表一个选项，完整一周 = 100% 选择率</p>}{kind==='treemap'&&q.counts.some(c=>!c.value)&&<p className="sa-note">零人选择的选项列在下方明细中。</p>}</>;
}
function ChoiceChart({q,kind}:{q:QuestionStat;kind:ChartKind}) {
 const dialog=useRef<HTMLDialogElement>(null),[expanded,setExpanded]=useState(false);
 return <><ChartCanvas q={q} kind={kind} onExpand={()=>{dialog.current?.showModal();setExpanded(true)}}/><dialog className="sa-dialog" ref={dialog} onClose={()=>setExpanded(false)}><header><h3>{q.title}</h3><button type="button" onClick={()=>dialog.current?.close()}>关闭</button></header>{expanded&&<ChartCanvas q={q} kind={kind}/>}<p className="sa-note">有效作答 {q.answered} 人 · {q.type==='multiple'?'可多选，各选项比例合计可能超过 100%':'单选占比'}</p><ul className="sa-values">{q.counts.map((c,i)=><li key={i}><span className="sa-code">{optionCode(i)}</span><span>{c.name}</span><strong>{c.value} 人 · {percentage(c.value,q.answered)}%</strong></li>)}</ul></dialog></>;
}
function QuestionCard({q,index}:{q:QuestionStat;index:number}) {
 const auto=chooseChart(q,index),[selected,setSelected]=useState<'auto'|ChartKind>('auto'),kind=selected==='auto'?auto:selected;
 const allowed:ChartKind[]=q.type==='multiple'?['polar','lollipop','bar']:['treemap','donut','lollipop','bar','column',...(q.counts.length<=6?['stack'] as ChartKind[]:[])];
 return <article id={`analytics-${q.id}`} className="sa-question" tabIndex={-1} data-chart-kind={kind}>
  <header className="sa-question-head"><span className="sa-number">{String(index+1).padStart(2,'0')}</span><div><span className="sa-type">{q.type==='multiple'?'多选题':q.type==='text'?'文字题':'单选题'}</span><h3>{q.title}</h3></div></header>
  <div className="sa-question-meta"><span>有效作答 <strong>{q.answered}</strong> 人</span>{q.type!=='text'&&<label>图形<select aria-label={`第${index+1}题图形`} value={selected} onChange={e=>setSelected(e.target.value as typeof selected)}><option value="auto">自动 · {chartNames[auto]}</option>{allowed.map(k=><option value={k} key={k}>{chartNames[k]}</option>)}</select></label>}</div>
  {!q.answered?<div className="sa-empty">暂无作答<span>提交答卷后自动生成统计图</span></div>:q.type==='text'?<div className="sa-texts">{q.texts.map((t,i)=><blockquote key={i}>{t}</blockquote>)}</div>:<ChoiceChart q={q} kind={kind}/>}
  {q.type!=='text'&&<><p className="sa-note">{q.type==='multiple'?'选择率 = 选择人数 ÷ 本题有效作答人数；可多选，合计可能超过 100%。':'占比 = 选择人数 ÷ 本题有效作答人数。'}</p><ul className="sa-values">{q.counts.map((c,i)=><li key={i}><span className="sa-code">{optionCode(i)}</span><span>{c.name}</span><strong>{c.value} 人 <small>{q.answered?percentage(c.value,q.answered)+'%':'—'}</small></strong></li>)}</ul></>}
 </article>;
}
export function SurveyAnalytics({stats}:{stats:SurveyStats}) {
 const choice=stats.questions.filter(q=>q.type!=='text'),total=stats.students.length,done=stats.students.filter(s=>s.status==='已提交').length,started=stats.students.filter(s=>s.status==='作答中').length;
 const jump=(id:string)=>{const el=document.getElementById(`analytics-${id}`);el?.focus({preventScroll:true});el?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'})};
 return <div className="survey-analytics">
  <div className="sa-banner"><div><span className="sa-eyebrow">QUESTIONNAIRE / ANALYTICS</span><h2>回答之中，看见全貌。</h2><p>只统计已提交答卷 · 选择率按各题有效作答人数计算</p></div><div className="sa-completion"><strong>{total?percentage(done,total)+'%':'—'}</strong><span>当前名单完成率</span></div></div>
  <div className="sa-metrics">{[['当前名单',total],['已提交',done],['作答中',started],['未开始',total-done-started]].map(([name,n])=><div key={name}><span>{name}</span><strong>{n}<small>人</small></strong></div>)}</div>
  <p className="sa-note">完成情况以当前班级名单为准；逐题统计包含本问卷累计已提交答卷，名单变更后两者可能不同。跳过的选填题不计入本题分母。</p>
  {choice.length>0&&<section className="sa-overview"><div className="sa-section-head"><div><h2>选择分布 · 全景矩阵</h2><p>颜色越深，选择率越高。点击题目或色块查看明细。</p></div><span>0% <i className="sa-scale"/> 100%</span></div><p className="sa-note">A、B…代表每题自己的选项顺序，不代表跨题相同含义。— 表示无此选项或暂无作答。</p><div className="sa-heat-scroll" tabIndex={0} aria-label="整卷选择热力图，可横向滚动"><table className="sa-heat"><thead><tr><th>题目 / 选项</th>{Array.from({length:Math.max(...choice.map(q=>q.counts.length))},(_,i)=><th key={i}>{optionCode(i)}</th>)}</tr></thead><tbody>{choice.map(q=><tr key={q.id}><th><button onClick={()=>jump(q.id)}>{stats.questions.indexOf(q)+1}. {q.title}</button></th>{Array.from({length:Math.max(...choice.map(q=>q.counts.length))},(_,i)=>{const c=q.counts[i],p=c?percentage(c.value,q.answered):0;return <td key={i}>{c&&q.answered?<button onClick={()=>jump(q.id)} title={`${c.name}：${c.value} 人 / ${q.answered} 人（${p}%）`} aria-label={`${q.title}，${c.name}，${c.value}人，${p}%`} style={{'--sa-rate':p+'%'} as CSSProperties} className={p>55?'sa-hot':''}>{p}%</button>:<span>—</span>}</td>})}</tr>)}</tbody></table></div></section>}
  <div className="sa-section-head"><div><h2>逐题探索</h2><p>共 {stats.questions.length} 题 · 根据题型自动选择图形，也可手动切换</p></div></div>
  <div className="sa-question-grid">{stats.questions.map((q,i)=><QuestionCard key={stats.survey.id+q.id} q={q} index={i}/>)}</div>
 </div>;
}
