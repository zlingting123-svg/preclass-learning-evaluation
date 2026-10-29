import type {Express,Response} from 'express';
import {z} from 'zod';
import type {User} from '../../shared/contracts.js';
import type {PersonalProfile} from '../../shared/personal.js';
import type {Account} from './auth.js';
import type {Service} from './service.js';
import {ensure} from './errors.js';
type StoredProfile=Pick<PersonalProfile,'nickname'|'avatarDataUrl'|'version'>;
function safeAvatar(value:string|null){
 if(value===null)return true;
 if(!/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(value))return false;
 const bytes=Buffer.from(value.slice('data:image/png;base64,'.length),'base64');
 if(bytes.length<45||bytes.length>150000||bytes.subarray(0,8).toString('hex')!=='89504e470d0a1a0a'||bytes.subarray(12,16).toString()!=='IHDR'||bytes.subarray(-12).toString('hex')!=='0000000049454e44ae426082')return false;
 return bytes.readUInt32BE(16)>0&&bytes.readUInt32BE(16)<=256&&bytes.readUInt32BE(20)>0&&bytes.readUInt32BE(20)<=256;
}
const input=z.object({nickname:z.string().trim().max(40),avatarDataUrl:z.string().max(210000).nullable().refine(safeAvatar,'头像须为不超过256像素、150KB的PNG图片'),expectedVersion:z.number().int().nonnegative()}).strict();
export class PersonalProfiles{
 constructor(readonly core:Service){}
 get(user:User):PersonalProfile{
  const account=this.core.store.all<Account>('account').find(a=>a.user.id===user.id);ensure(account,401,'UNAUTHENTICATED','账号不可用');
  const profile=this.core.store.get<StoredProfile>('personal_profile',user.id)??{nickname:'',avatarDataUrl:null,version:0};
  const identity=this.core.store.all<{userId:string;studentNumber:string}>('student_identity').find(i=>i.userId===user.id);
  return {...profile,username:account.username,realName:user.displayName,studentNumber:user.role==='student'?(identity?.studentNumber??account.username):null};
 }
 save(user:User,raw:unknown){
  const body=input.parse(raw);return this.core.store.transaction(()=>{
   const current=this.get(user);this.core.checkVersion(current.version,body.expectedVersion);
   this.core.store.put<StoredProfile>('personal_profile',user.id,{nickname:body.nickname,avatarDataUrl:body.avatarDataUrl,version:current.version+1});return this.get(user);
  });
 }
}
export function personalProfileRoutes(app:Express,core:Service,ok:(res:Response,data:unknown)=>unknown){
 const profiles=new PersonalProfiles(core);
 app.get('/api/v1/account/profile',(_req,res)=>ok(res,profiles.get(res.locals.user)));
 app.put('/api/v1/account/profile',(req,res)=>ok(res,profiles.save(res.locals.user,req.body)));
}
