import '../styles/class-picker.css';
import {useEffect,useState} from 'react';
import type {ManagedClassInfo} from '@shared/onboarding';
import {apiRequest} from '../services/httpClient';
export function ClassPicker({onClaimed}:{onClaimed:(id:string)=>void}){
 const [items,setItems]=useState<ManagedClassInfo[]>([]),[loading,setLoading]=useState(true),[busy,setBusy]=useState(''),[error,setError]=useState(''),[search,setSearch]=useState('');
 async function load(){setLoading(true);try{setItems(await apiRequest('GET','/teacher/class-catalog'));setError('')}catch(e){setError(e instanceof Error?e.message:'读取失败')}finally{setLoading(false)}}
 useEffect(()=>{void load()},[]);
 return <section className="svc-card class-picker"><h2>添加已建班级</h2><p className="svc-muted">名单和学生账号由管理员统一导入。同一班级允许多名教师共同选择，选择后可查看该班名单并开展教学。</p><div className="svc-filters"><label>查找班级<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="班级名称或教学分组"/></label><button disabled={loading||!!busy} onClick={()=>void load()}>刷新班级</button></div>
 {error&&<p className="svc-error" role="alert">{error}</p>}{loading?<p role="status">正在读取班级…</p>:<div className="svc-table-wrap"><table><thead><tr><th>班级</th><th>教学分组</th><th>学生人数</th><th>已选择教师</th><th>操作</th></tr></thead><tbody>{items.filter(c=>(c.name+c.batchName).includes(search.trim())).map(c=><tr key={c.id}><td>{c.name}</td><td>{c.batchName}</td><td>{c.memberCount}</td><td>{c.teacherNames.join('、')||'暂无教师'}</td><td><button disabled={c.claimed||!!busy} onClick={async()=>{setBusy(c.id);setError('');try{await apiRequest('POST',`/teacher/classes/${encodeURIComponent(c.id)}/claim`,{body:{}});await load();onClaimed(c.id)}catch(e){setError(e instanceof Error?e.message:'选择失败')}finally{setBusy('')}}}>{c.claimed?'已添加':busy===c.id?'添加中…':'添加到我的班级'}</button></td></tr>)}</tbody></table>{!items.length&&<p className="svc-empty">管理员尚未导入班级，请联系管理员。</p>}</div>}</section>;
}
