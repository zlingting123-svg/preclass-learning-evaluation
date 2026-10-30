import { useEffect, useId, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import './companion.css';

export type CompanionState = 'idle' | 'welcome' | 'thinking' | 'done' | 'failed' | 'offline';
type Direction = 'up' | 'down' | 'left' | 'right';
type Position = {x:number;y:number};
const labels:Record<CompanionState,string>={idle:'安静陪伴',welcome:'欢迎提问',thinking:'正在思考',done:'回答完成',failed:'请求失败',offline:'服务待接入'};
const poseRects:Record<CompanionState,[number,number,number,number]>={idle:[0,0,512,534],welcome:[1024,0,512,534],thinking:[0,534,512,490],done:[512,534,512,490],failed:[1024,534,512,490],offline:[512,0,512,534]};
// Filled from the measured walking atlas; no pose is cut at a nominal grid boundary.
const walkingRows=[{y:0,h:316},{y:316,h:306},{y:622,h:312},{y:934,h:320}],walkingColumns=[0,314,627,941,1254];
const walkRow:Record<Direction,number>={down:0,up:1,left:2,right:3};
function remembered(key:string):Position|null {try{const p=JSON.parse(localStorage.getItem(key)??'null');return p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=0&&p.x<=1&&p.y>=0&&p.y<=1?p:null}catch{return null}}
const clamp=(v:number,max:number)=>Math.max(0,Math.min(v,Math.max(0,max)));

export function WhaleCompanion({state,place,onActivate,assetBase}:{state:CompanionState;assetBase?:string;place:'home'|'chat';onActivate?:()=>void}) {
 const assets=assetBase??`${import.meta.env.BASE_URL}companion/`;
 const area=useRef<HTMLDivElement>(null),character=useRef<HTMLButtonElement>(null),bounds=useRef({x:0,y:0,minY:0}),key=`preclass.whale-position.${place}`;
 const ratio=useRef<Position|null>(remembered(key)),pos=useRef<Position>({x:0,y:0});
 const [position,setPosition]=useState<Position>({x:0,y:0}),[walking,setWalking]=useState<Direction|null>(null),[tick,setTick]=useState(0),[reaction,setReaction]=useState<'hover'|'tap'|null>(null),[reduced,setReduced]=useState(()=>matchMedia('(prefers-reduced-motion: reduce)').matches);
 const drag=useRef<{id:number;start:Position;origin:Position;last:Position;moved:boolean}|null>(null),suppressClick=useRef(false);
 const reactionTimer=useRef<ReturnType<typeof setTimeout>>(),activationTimer=useRef<ReturnType<typeof setTimeout>>(),activate=useRef(onActivate);activate.current=onActivate;
 const clipId='whale-'+useId().replace(/:/g,'');
 function move(p:Position){const safe={x:clamp(p.x,bounds.current.x),y:Math.max(bounds.current.minY,clamp(p.y,bounds.current.y))};pos.current=safe;setPosition(safe)}
 function clearReaction(){clearTimeout(reactionTimer.current);clearTimeout(activationTimer.current);setReaction(null)}
 function reactToPointer(kind:'hover'|'tap'){if(walking||drag.current?.moved)return;clearTimeout(reactionTimer.current);character.current?.querySelector('.wc-sprite')?.getAnimations().forEach(animation=>{animation.currentTime=0});setReaction(kind);reactionTimer.current=setTimeout(()=>setReaction(null),kind==='tap'?720:820)}
 useEffect(()=>()=>{clearTimeout(reactionTimer.current);clearTimeout(activationTimer.current)},[]);
 function save(){const b=bounds.current;ratio.current={x:b.x?pos.current.x/b.x:0,y:b.y?pos.current.y/b.y:0};try{localStorage.setItem(key,JSON.stringify(ratio.current))}catch{/* storage may be unavailable */}}
 useEffect(()=>{const a=area.current!,c=character.current!;const resize=()=>{const maxY=Math.max(0,a.clientHeight-c.offsetHeight);bounds.current={x:Math.max(0,a.clientWidth-c.offsetWidth),y:maxY,minY:Math.min(place==='home'?42:12,maxY)};const b=bounds.current;const p=ratio.current?{x:ratio.current.x*b.x,y:ratio.current.y*b.y}:{x:place==='home'?b.x/2:b.x,y:place==='home'?(b.minY+b.y)/2:Math.min(24,b.y)};move(p)};resize();const observer=new ResizeObserver(resize);observer.observe(a);observer.observe(c);return()=>observer.disconnect()},[place]);
 useEffect(()=>{const image=new Image();image.src=`${assets}walk.png`},[assets]);
 useEffect(()=>{const media=matchMedia('(prefers-reduced-motion: reduce)'),change=()=>setReduced(media.matches);media.addEventListener('change',change);return()=>media.removeEventListener('change',change)},[]);
 useEffect(()=>{setTick(0);if(reduced)return;const timer=setInterval(()=>setTick(t=>t+1),140);return()=>clearInterval(timer)},[reduced,state,walking,reaction]);
 function pointerDown(e:ReactPointerEvent<HTMLButtonElement>){if(!e.isPrimary||e.button!==0)return;clearReaction();suppressClick.current=false;drag.current={id:e.pointerId,start:{x:e.clientX,y:e.clientY},origin:pos.current,last:{x:e.clientX,y:e.clientY},moved:false};e.currentTarget.setPointerCapture(e.pointerId)}
 function pointerMove(e:ReactPointerEvent<HTMLButtonElement>){const d=drag.current;if(!d||d.id!==e.pointerId)return;const dx=e.clientX-d.start.x,dy=e.clientY-d.start.y;if(!d.moved&&Math.hypot(dx,dy)<6)return;d.moved=true;suppressClick.current=true;const sx=e.clientX-d.last.x,sy=e.clientY-d.last.y;if(sx||sy)setWalking(Math.abs(sx)>=Math.abs(sy)?sx<0?'left':'right':sy<0?'up':'down');d.last={x:e.clientX,y:e.clientY};move({x:clamp(d.origin.x+dx,bounds.current.x),y:clamp(d.origin.y+dy,bounds.current.y)})}
 function finish(){if(!drag.current)return;if(drag.current.moved)save();drag.current=null;setWalking(null)}
 const rect=walking?(()=>{const row=walkingRows[walkRow[walking]];const col=reduced?0:tick%4;return [walkingColumns[col],row.y,walkingColumns[col+1]-walkingColumns[col],row.h] as const})():place==='home'&&reaction?poseRects.done:state==='welcome'?(!reduced&&tick%32>=3&&tick%32<=8?poseRects.done:poseRects.idle):state==='idle'&&tick%24===23?[512,0,512,534] as const:poseRects[state];
 const asset=walking?'walk.png':'poses.png';
 return <div ref={area} className={`wc-area wc-area-${place}`}><button ref={character} type="button" className="wc-character" data-state={walking?'walk-'+walking:state} data-reaction={walking?undefined:reaction??undefined} data-place={place} aria-label={`鲸鱼伙伴：${walking?'拖动中':labels[state]}，按住拖动或用方向键调整位置${place==='home'?'，点击进入AI助手':''}`} title={place==='home'?'点击向课程伙伴提问；按住可拖动':'按住拖动可调整伙伴位置'} style={{left:position.x,top:position.y}} onPointerEnter={e=>{if(e.pointerType!=='touch')reactToPointer('hover')}} onFocus={()=>reactToPointer('hover')} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={finish} onPointerCancel={finish} onLostPointerCapture={finish} onClick={e=>{if(suppressClick.current){e.preventDefault();suppressClick.current=false;return}reactToPointer('tap');if(onActivate){clearTimeout(activationTimer.current);if(reduced)onActivate();else activationTimer.current=setTimeout(()=>activate.current?.(),360)}}} onKeyDown={e=>{const change:Record<string,Position>={ArrowLeft:{x:-16,y:0},ArrowRight:{x:16,y:0},ArrowUp:{x:0,y:-16},ArrowDown:{x:0,y:16}};const v=change[e.key];if(!v)return;e.preventDefault();clearReaction();move({x:clamp(pos.current.x+v.x,bounds.current.x),y:clamp(pos.current.y+v.y,bounds.current.y)});save();setWalking(e.key.slice(5).toLowerCase() as Direction)}} onKeyUp={()=>setWalking(null)} onBlur={()=>setWalking(null)}>
 <svg className="wc-sprite" viewBox={rect.join(' ')} preserveAspectRatio="xMidYMax meet" aria-hidden="true"><defs><clipPath id={clipId} clipPathUnits="userSpaceOnUse"><rect x={rect[0]} y={rect[1]} width={rect[2]} height={rect[3]}/></clipPath></defs><image href={`${assets}${asset}`} width={walking?1254:1536} height={walking?1254:1024} clipPath={`url(#${clipId})`}/></svg>
 <span className="wc-shadow" aria-hidden="true"/>{reaction&&!walking&&<span className="wc-reaction-sparks" aria-hidden="true"><i/><i/><i/></span>}{state==='thinking'&&!walking&&<span className="wc-thought" aria-hidden="true"><i/><i/><i/></span>}{state==='offline'&&!walking&&<span className="wc-sleep" aria-hidden="true">z</span>}
 </button></div>
}
