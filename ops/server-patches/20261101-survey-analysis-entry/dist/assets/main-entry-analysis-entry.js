const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/main-analysis-entry.js","assets/jsx-runtime-Ds7-OPOE.js","assets/react-DFdtPfhg.js","assets/echarts-CDQk3v0B.js","assets/main-CHRoFHV3.css"])))=>i.map(i=>d[i]);
import"./jsx-runtime-Ds7-OPOE.js";import"./react-DFdtPfhg.js";const p="modulepreload",v=function(i){return"/"+i},u={},E=function(d,c,P){let l=Promise.resolve();if(c&&c.length>0){let m=function(e){return Promise.all(e.map(o=>Promise.resolve(o).then(s=>({status:"fulfilled",value:s}),s=>({status:"rejected",reason:s}))))};document.getElementsByTagName("link");const r=document.querySelector("meta[property=csp-nonce]"),t=r?.nonce||r?.getAttribute("nonce");l=m(c.map(e=>{if(e=v(e),e in u)return;u[e]=!0;const o=e.endsWith(".css"),s=o?'[rel="stylesheet"]':"";if(document.querySelector(`link[href="${e}"]${s}`))return;const n=document.createElement("link");if(n.rel=o?"stylesheet":p,o||(n.as="script"),n.crossOrigin="",n.href=e,t&&n.setAttribute("nonce",t),document.head.appendChild(n),o)return new Promise((f,h)=>{n.addEventListener("load",f),n.addEventListener("error",()=>h(new Error(`Unable to preload CSS for ${e}`)))})}))}function a(r){const t=new Event("vite:preloadError",{cancelable:!0});if(t.payload=r,window.dispatchEvent(t),!t.defaultPrevented)throw r}return l.then(r=>{for(const t of r||[])t.status==="rejected"&&a(t.reason);return d().catch(a)})};async function y(){await E(()=>import("./main-analysis-entry.js"),__vite__mapDeps([0,1,2,3,4]))}y();

const css=document.createElement('link');css.rel='stylesheet';css.href='/assets/survey-builder.css';document.head.appendChild(css);

const tw=document.createElement('link');tw.rel='stylesheet';tw.href='/assets/teacher-workspace.css';document.head.appendChild(tw);

const rosterCss=document.createElement('link');rosterCss.rel='stylesheet';rosterCss.href='/assets/roster-redesign.css';document.head.appendChild(rosterCss);

const ql=document.createElement('link');ql.rel='stylesheet';ql.href='/assets/question-list.css';document.head.appendChild(ql);

const qrBalance=document.createElement('link');qrBalance.rel='stylesheet';qrBalance.href='/assets/attendance-balance.css';document.head.appendChild(qrBalance);

const rsp=document.createElement('link');rsp.rel='stylesheet';rsp.href='/assets/response-search.css';document.head.appendChild(rsp);

const profileCss=document.createElement('link');profileCss.rel='stylesheet';profileCss.href='/assets/sidebar-account.css';document.head.appendChild(profileCss);
