import {createHmac,randomBytes,timingSafeEqual} from 'node:crypto';
import {ensure} from './errors.js';
export const QR_INTERVAL_MS=2000,QR_VALID_MS=10000,SCAN_PROOF_MS=180000;
const legacyUntil=Date.now()+30000;
const sign=(s,text)=>createHmac('sha256',s.secret).update(text).digest('base64url');
const equal=(a,b)=>typeof a==='string'&&a.length===b.length&&timingSafeEqual(Buffer.from(a),Buffer.from(b));
export function ticketAt(s,at){const slot=Math.floor(at/QR_INTERVAL_MS),body='q2.'+s.id+'.'+slot;return body+'.'+sign(s,body)}
export function verifyTicket(s,ticket,now){
 const parts=String(ticket).split('.');
 if(parts.length===4&&parts[0]==='q2'&&parts[1]===s.id&&/^\d{1,12}$/.test(parts[2])){
  const slot=Number(parts[2]),start=slot*QR_INTERVAL_MS;
  return start<=now&&now<start+QR_VALID_MS&&equal(parts[3],sign(s,parts.slice(0,3).join('.')));
 }
 // Allow an already displayed pre-upgrade QR only during the first 30 seconds.
 if(now<=legacyUntil&&parts.length===3&&parts[0]===s.id&&parts[1]===String(Math.floor(now/30000)))return equal(parts[2],sign(s,parts.slice(0,2).join('.')));
 return false;
}
export function qrState(s,now){
 const start=Math.floor(now/QR_INTERVAL_MS)*QR_INTERVAL_MS;
 return {ticket:ticketAt(s,now),expiresAt:start+QR_INTERVAL_MS,serverNow:now,qrIntervalMs:QR_INTERVAL_MS,qrValidityMs:QR_VALID_MS,qrTickets:Array.from({length:16},(_,i)=>({ticket:ticketAt(s,start+i*QR_INTERVAL_MS),from:start+i*QR_INTERVAL_MS,until:start+(i+1)*QR_INTERVAL_MS}))};
}
export function captureProof(s,ticket,now){
 ensure(verifyTicket(s,ticket,now),409,'QR_EXPIRED','二维码已过期，请重新扫码');
 const body='s2.'+s.id+'.'+now+'.'+randomBytes(12).toString('base64url');
 return {sessionId:s.id,scanProof:body+'.'+sign(s,body),expiresAt:now+SCAN_PROOF_MS};
}
export function verifyProof(s,proof,now){
 const p=String(proof).split('.');
 if(p.length!==5||p[0]!=='s2'||p[1]!==s.id||!/^\d{10,16}$/.test(p[2])||!/^[-_A-Za-z0-9]{16}$/.test(p[3]))return false;
 const at=Number(p[2]);return at<=now&&now<at+SCAN_PROOF_MS&&equal(p[4],sign(s,p.slice(0,4).join('.')));
}
