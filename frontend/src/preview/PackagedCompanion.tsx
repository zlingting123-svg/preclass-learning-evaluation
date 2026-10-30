import {createElement,useEffect,useRef} from 'react';
import type {CompanionState} from './WhaleCompanion';
// Only the locally installed, framework-independent release module renders the character.
let registration:Promise<unknown>|undefined;
export function PackagedCompanion({state,place,onActivate}:{state:CompanionState;place:'home'|'chat';onActivate?:()=>void}){
 const host=useRef<HTMLElement>(null),callback=useRef(onActivate);callback.current=onActivate;
 useEffect(()=>{registration??=import(/* @vite-ignore */ `${import.meta.env.BASE_URL}ai-companion/module.js`);void registration.catch(error=>console.error('Companion module failed to load',error));const element=host.current!,activate=()=>callback.current?.();element.addEventListener('companion-activate',activate);return()=>element.removeEventListener('companion-activate',activate)},[]);
 return <div className={`pc-slot pc-slot-${place}`}>{createElement('preclass-ai-companion',{ref:host,place,state})}</div>
}
