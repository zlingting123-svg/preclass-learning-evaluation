import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { AuthSession } from '@shared/contracts';
import { apiRequest } from '../../services/httpClient';
import { setSession } from '../../services/api';
import './admin.css';
export function AdminLogin(){
 const [username,setUsername]=useState(''),[password,setPassword]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),navigate=useNavigate();
 return <main className="admin-login"><section><Link to="/login" className="admin-back">← 返回学习平台</Link><p className="admin-kicker">SERVICE ADMINISTRATION</p><h1>服务管理端</h1><p>统一管理平台账户、服务器与 API。</p><form onSubmit={async e=>{e.preventDefault();if(busy)return;setBusy(true);setError('');try{const session=await apiRequest<AuthSession>('POST','/admin/login',{body:{username,password}});setSession(session);setPassword('');navigate('/admin',{replace:true});}catch(e){setError(e instanceof Error?e.message:'登录失败');}finally{setBusy(false);}}}>
 <label>管理员账号<input autoComplete="username" value={username} onChange={e=>setUsername(e.target.value)} required/></label>
 <label>管理员密码<input type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} required/></label>
 {error&&<p role="alert" className="admin-error">{error}</p>}<button className="admin-primary" disabled={busy}>{busy?'正在验证…':'进入服务管理端'}</button></form>
 <small>仅管理员可访问。课程内容和教学统计请使用师生端。</small></section><aside><span>学习平台 / 运维空间</span><h2>让账户可找回，<br/>让服务可管理。</h2><p>独立权限入口 · 操作留痕 · 密钥留在服务端</p></aside></main>;
}
