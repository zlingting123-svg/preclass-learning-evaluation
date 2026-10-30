import {createRoot} from 'react-dom/client';
import type {Root} from 'react-dom/client';
import {WhaleCompanion} from '../preview/WhaleCompanion';
import type {CompanionState} from '../preview/WhaleCompanion';
import css from '../preview/companion.css?inline';
const states=new Set(['idle','welcome','thinking','done','failed','offline']);
class CompanionElement extends HTMLElement {
 static observedAttributes=['state','place'];
 private root:Root|null=null;
 connectedCallback(){if(!this.shadowRoot){const shadow=this.attachShadow({mode:'open'}),style=document.createElement('style'),mount=document.createElement('div');style.nonce=this.getAttribute('style-nonce')??'';style.textContent=css+'\n:host{display:block;position:relative;width:100%;height:100%;--pv-accent:#226a56}#mount{position:absolute;inset:0}.wc-area-home{position:absolute;inset:0;height:100%;margin:0}';mount.id='mount';shadow.append(style,mount)}if(!this.root)this.root=createRoot(this.shadowRoot!.getElementById('mount')!);this.renderCompanion()}
 disconnectedCallback(){queueMicrotask(()=>{if(!this.isConnected){this.root?.unmount();this.root=null}})}
 attributeChangedCallback(){this.renderCompanion()}
 setState(state:CompanionState){if(!states.has(state))throw Error('Unsupported companion state');this.setAttribute('state',state)}
 private renderCompanion(){if(!this.root)return;const place=this.getAttribute('place')==='home'?'home':'chat',raw=this.getAttribute('state')??(place==='home'?'welcome':'idle');const state=(states.has(raw)&&!(place==='chat'&&raw==='welcome')?raw:'idle') as CompanionState;this.root.render(<WhaleCompanion place={place} state={state} assetBase={new URL('./',import.meta.url).href} onActivate={place==='home'?()=>this.dispatchEvent(new CustomEvent('companion-activate',{bubbles:true,composed:true})):undefined}/>)}
}
if(!customElements.get('preclass-ai-companion'))customElements.define('preclass-ai-companion',CompanionElement);
