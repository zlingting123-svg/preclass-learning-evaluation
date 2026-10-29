import {useEffect,useState} from 'react';
import type {PersonalProfile} from '@shared/personal';
import {apiRequest} from '../services/httpClient';
import {PasswordChangePage} from './PasswordChangePage';
import '../styles/personal.css';
export function PersonalCenter({onSaved,onPasswordChanged,onLogout}:{onSaved:(profile:PersonalProfile)=>void;onPasswordChanged:()=>void;onLogout:()=>void}){
 const [profile,setProfile]=useState<PersonalProfile|null>(null),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
 async function load(){try{const value=await apiRequest<PersonalProfile>('GET','/account/profile');setProfile(value);setError('');onSaved(value)}catch(e){setError(e instanceof Error?e.message:'读取失败')}}
 useEffect(()=>{void load()},[]);
 async function avatar(file:File){
  setError('');setNotice('');if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>5*1024*1024){setError('请选择5MB以内的PNG、JPG或WebP图片');return;}
  setBusy(true);let image:ImageBitmap|undefined;
  try{image=await createImageBitmap(file);const canvas=document.createElement('canvas');canvas.width=128;canvas.height=128;const context=canvas.getContext('2d');if(!context)throw new Error('当前浏览器无法处理头像');const edge=Math.min(image.width,image.height);context.drawImage(image,(image.width-edge)/2,(image.height-edge)/2,edge,edge,0,0,128,128);const value=canvas.toDataURL('image/png');setProfile(p=>p?{...p,avatarDataUrl:value}:p);setNotice('头像已预览，保存个人信息后生效');}catch{setError('图片无法读取，请换一张图片')}finally{image?.close();setBusy(false)}
 }
 return <div className="pv-page personal-center"><h1>个人中心</h1><section className="svc-card"><h2>个人信息</h2><p className="svc-muted">昵称和头像仅用于你自己的界面。教师与管理员查看名单、答卷时仍显示学号和真实姓名。</p>{error&&<p className="svc-error" role="alert">{error}</p>}{notice&&<p className="svc-notice" role="status">{notice}</p>}
 {profile&&<form onSubmit={async e=>{e.preventDefault();setBusy(true);setError('');setNotice('');try{const saved=await apiRequest<PersonalProfile>('PUT','/account/profile',{body:{nickname:profile.nickname,avatarDataUrl:profile.avatarDataUrl,expectedVersion:profile.version}});setProfile(saved);onSaved(saved);setNotice('个人信息已保存')}catch(e){setError(e instanceof Error?e.message:'保存失败')}finally{setBusy(false)}}}>
 <fieldset disabled={busy}><div className="personal-avatar-row">{profile.avatarDataUrl?<img className="personal-avatar" src={profile.avatarDataUrl} alt="我的头像"/>:<span className="personal-avatar">{Array.from(profile.nickname||profile.realName)[0]}</span>}<label>上传头像<input type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>{const file=e.target.files?.[0];if(file)void avatar(file);e.target.value=''}}/></label><button type="button" disabled={!profile.avatarDataUrl} onClick={()=>setProfile({...profile,avatarDataUrl:null})}>移除头像</button></div>
 <label>账号<input value={profile.username} readOnly/></label>{profile.studentNumber&&<label>学号<input value={profile.studentNumber} readOnly/></label>}<label>真实姓名<input value={profile.realName} readOnly/></label><label>昵称（仅自己可见）<input value={profile.nickname} maxLength={40} placeholder="不填写则显示真实姓名" onChange={e=>setProfile({...profile,nickname:e.target.value})}/></label>
 <div className="personal-actions"><button className="svc-primary">保存个人信息</button><button type="button" onClick={()=>void load()}>重新读取</button></div></fieldset></form>}</section>
 <PasswordChangePage mode="self" onComplete={onPasswordChanged} onLogout={onLogout}/></div>;
}
