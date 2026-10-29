import '../styles/account.css';
import {useState} from 'react';
import {apiRequest} from '../services/httpClient';
import {api,clearSession,getCurrentUser} from '../services/api';
export function PasswordChangePage({onComplete,onLogout,mode="initial"}:{onComplete:()=>void;onLogout:()=>void;mode?:"initial"|"self"}){
 const [current,setCurrent]=useState(''),[next,setNext]=useState(''),[confirm,setConfirm]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const Container=mode==="self"?"div":"main";
 return <Container className="pv-page pv-password-page account-password"><section className="svc-card"><p className="pv-eyebrow">ACCOUNT SECURITY</p>{mode==="self"?<h2>修改密码</h2>:<h1>首次登录，请修改初始密码</h1>}<p className="svc-muted">{getCurrentUser()?.displayName}，{mode==="self"?"你可以在此更改登录密码。":"请设置个人密码后再进入课程。"}更改成功后，原有登录会话会失效，请重新登录。</p>
 <form onSubmit={async e=>{e.preventDefault();if(busy)return;setError('');if(next!==confirm){setError('两次输入的新密码不一致');return}setBusy(true);try{await apiRequest('PUT','/auth/password',{body:{currentPassword:current,newPassword:next}});setCurrent('');setNext('');setConfirm('');clearSession();onComplete()}catch(e){setError(e instanceof Error?e.message:'修改失败')}finally{setBusy(false)}}}>
 <label>{mode==="self"?"当前密码":"当前／初始密码"}<input type="password" autoComplete="current-password" value={current} onChange={e=>setCurrent(e.target.value)} required/></label>
 <label>新密码<input type="password" autoComplete="new-password" minLength={12} value={next} onChange={e=>setNext(e.target.value)} required/></label><p className="svc-muted">至少12个字符，最多72字节，必须与当前密码不同。</p>
 <label>确认新密码<input type="password" autoComplete="new-password" minLength={12} value={confirm} onChange={e=>setConfirm(e.target.value)} required/></label>
 {error&&<p className="svc-error" role="alert">{error}</p>}<button className="svc-primary" disabled={busy}>{busy?'正在修改…':'保存新密码并重新登录'}</button>
 <button type="button" disabled={busy} onClick={async()=>{await api.logout().catch(()=>{});clearSession();onLogout()}}>退出当前账号</button>
 </form></section></Container>;
}
