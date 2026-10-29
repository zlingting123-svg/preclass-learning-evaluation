import {createCipheriv,createDecipheriv,randomBytes} from 'node:crypto';
import type {Store} from './store.js';
import {ensure} from './errors.js';
interface EncryptedCredential {version:1;iv:string;tag:string;ciphertext:string;updatedAt:string}
export class CredentialVault {
 private master?:Buffer;
 constructor(readonly store:Store,master=process.env.AI_SECRET_MASTER_KEY){
  if(master){const decoded=Buffer.from(master,'base64');ensure(decoded.length===32&&decoded.toString('base64')===master,503,'VAULT_KEY_INVALID','密钥存储主密钥无效');this.master=decoded;}
 }
 get ready(){return !!this.master}
 has(id:string){return !!this.store.get('ai_provider_credential',id)}
 validate(secret:string){ensure(/^sk-[A-Za-z0-9_-]{10,250}$/.test(secret),400,'INVALID_PROVIDER_KEY','请输入有效的DeepSeek API Key，不要输入环境变量名');ensure(this.master,503,'VAULT_NOT_READY','服务端密钥存储尚未初始化');}
 get(id:string):string|undefined{
  const record=this.store.get<EncryptedCredential>('ai_provider_credential',id);if(!record)return undefined;
  ensure(this.master,503,'VAULT_LOCKED','密钥存储主密钥未加载');
  try{
   ensure(record.version===1,503,'VAULT_INVALID','密钥存储格式无效');
   const iv=Buffer.from(record.iv,'base64'),tag=Buffer.from(record.tag,'base64');ensure(iv.length===12&&tag.length===16,503,'VAULT_INVALID','密钥存储格式无效');
   const decipher=createDecipheriv('aes-256-gcm',this.master,iv,{authTagLength:16});decipher.setAAD(Buffer.from('preclass-ai-credential:v1:'+id));decipher.setAuthTag(tag);
   return Buffer.concat([decipher.update(Buffer.from(record.ciphertext,'base64')),decipher.final()]).toString('utf8');
  }catch{ensure(false,503,'VAULT_DECRYPT_FAILED','无法读取已保存的API密钥，请检查服务端主密钥');}
 }
 set(id:string,secret:string){
  this.validate(secret);const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',this.master!,iv,{authTagLength:16});cipher.setAAD(Buffer.from('preclass-ai-credential:v1:'+id));
  const ciphertext=Buffer.concat([cipher.update(secret,'utf8'),cipher.final()]);
  this.store.put<EncryptedCredential>('ai_provider_credential',id,{version:1,iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),ciphertext:ciphertext.toString('base64'),updatedAt:new Date().toISOString()});
 }
 prune(activeIds:string[]){
  // Store's public interface intentionally does not enumerate record keys; persist an ID index.
  const old=this.store.get<{ids:string[]}>('ai_credential_index','current')?.ids??[];
  for(const id of old)if(!activeIds.includes(id))this.store.remove('ai_provider_credential',id);
  this.store.put('ai_credential_index','current',{ids:activeIds});
 }
}
