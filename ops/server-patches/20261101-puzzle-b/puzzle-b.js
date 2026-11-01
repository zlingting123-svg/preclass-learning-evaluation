const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
export function puzzleB(state,newIds=[],layout){
 const N=state.roster.length;if(!N)return '<div class="mosaic-empty">班级暂无学生</div>';
 const {cols,rows,cells}=layout(N),w=960/cols,h=720/rows,signed=new Set(state.signed),count=state.roster.filter(s=>signed.has(s.id)).length,complete=count===N,photo=esc(state.photo),newSet=new Set(newIds);let mask='',tiles='',hits='';
 for(let i=0;i<N;i++){const {c,r,span}=cells[i],x=c*w,y=r*h,width=span*w,id=state.roster[i].id,done=signed.has(id),gap=1.05;
  if(done){mask+=`<rect x="${x+gap}" y="${y+gap}" width="${width-2*gap}" height="${h-2*gap}" fill="white"/>`;tiles+=`<rect class="mosaic-seam" x="${x+gap}" y="${y+gap}" width="${width-2*gap}" height="${h-2*gap}"/>`;if(newSet.has(id))tiles+=`<rect class="mosaic-arrival" x="${x}" y="${y}" width="${width}" height="${h}"/>`}
  else hits+=`<rect class="mosaic-hit" data-id="${esc(id)}" x="${x}" y="${y}" width="${width}" height="${h}" role="button" tabindex="0" aria-label="查看第${i+1}片对应的未签到同学"><title>点击查看未签到同学</title></rect>`;
 }
 const defs=`<filter id="mosaic-frost" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="${Math.max(0,Math.min(32,Number(state.blur)||0))}"/></filter><mask id="mosaic-clear" maskUnits="userSpaceOnUse" x="0" y="0" width="960" height="720">${mask}</mask>`;
 return `<svg class="puzzle-board mosaic-board ${complete?'mosaic-complete':''}" viewBox="0 0 960 720" role="group" aria-label="签到拼图，共${N}片，${count}人已签到"><defs>${defs}</defs>${complete?`<image class="mosaic-photo" href="${photo}" width="960" height="720" preserveAspectRatio="xMidYMid slice"/>`:`<image href="${photo}" width="960" height="720" preserveAspectRatio="xMidYMid slice" filter="url(#mosaic-frost)" opacity=".28"/><rect width="960" height="720" fill="var(--mosaic-veil)" opacity=".3"/><image href="${photo}" width="960" height="720" preserveAspectRatio="xMidYMid slice" mask="url(#mosaic-clear)"/>${tiles}${hits}`}</svg>`;
}
