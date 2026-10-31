import {layoutPieces} from '../attendance-preview/layout.js';
function edge(x,y,dx,dy,sign){const length=Math.hypot(dx,dy),nx=-dy/length,ny=dx/length,r=length*.16;const p=(t,n=0)=>`${(x+dx*t+nx*n).toFixed(2)},${(y+dy*t+ny*n).toFixed(2)}`;return sign?`L${p(.35)} C${p(.45)} ${p(.38,sign*r)} ${p(.5,sign*r)} C${p(.62,sign*r)} ${p(.55)} ${p(.65)} L${p(1)}`:`L${p(1)}`}
const polarity=(a,b)=>((a*17+b*13)%3===0?1:-1);
export function puzzle(state,newIds=[]){const W=960,H=720,N=state.roster.length,{cols,rows,cells}=layoutPieces(N),w=W/cols,h=H/rows,checked=new Set(state.signed),complete=checked.size===N;
 let defs=`<filter id="frost" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="${Math.max(0,Math.min(32,Number(state.blur)||0))}"/></filter>`,pieces='';
 for(let i=0;i<N;i++){
  const {c,r,span}=cells[i],x=c*w,y=r*h,width=w*span;let path=`M${x},${y}`;
  for(let j=0;j<span;j++)path+=edge(x+j*w,y,w,0,r?polarity(c+j,r):0);
  path+=edge(x+width,y,0,h,c+span===cols?0:polarity(c+span,r));
  for(let j=span-1;j>=0;j--)path+=edge(x+(j+1)*w,y+h,-w,0,r===rows-1?0:-polarity(c+j,r+1));
  path+=edge(x,y+h,0,-h,c?-polarity(c,r):0)+'Z';
  const s=state.roster[i],done=checked.has(s.id);defs+=`<clipPath id="clip${i}"><path d="${path}"/></clipPath>`;
  pieces+=`<g class="piece ${done?'arrived':''} ${newIds.includes(s.id)?'fly':''}" data-id="${s.id}" role="button" tabindex="0" aria-label="${done?'已签到拼图':'查看未签到同学'} ${i+1}"><title>${done?'已签到':'点击查看缺席同学'}</title><path d="${path}"/><g clip-path="url(#clip${i})"><image class="image-shard ${done?'clear':'frosted'}" href="${state.photo}" width="960" height="720" preserveAspectRatio="xMidYMid slice" ${done?'':'filter="url(#frost)"'}/></g><path class="piece-outline" d="${path}"/><text class="cell-label" x="${x+width/2}" y="${y+h/2+5}" text-anchor="middle">${done?'✦':String(i+1).padStart(2,'0')}</text></g>`;
 }
 return `<svg class="puzzle-board" viewBox="-26 -26 1012 772" aria-label="班级签到拼图，共${N}块"><defs>${defs}</defs>${complete?`<image class="unlocked-image" href="${state.photo}" width="960" height="720" preserveAspectRatio="xMidYMid slice"/>`:pieces}</svg>`;
}
