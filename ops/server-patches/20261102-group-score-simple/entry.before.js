const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/main-learning-balanced-20261102.js","assets/jsx-runtime-Ds7-OPOE.js","assets/react-DFdtPfhg.js","assets/echarts-CDQk3v0B.js","assets/main-CHRoFHV3.css"])))=>i.map(i=>d[i]);
import"./jsx-runtime-Ds7-OPOE.js";import"./react-DFdtPfhg.js";const p="modulepreload",v=function(i){return"/"+i},u={},E=function(d,c,P){let l=Promise.resolve();if(c&&c.length>0){let m=function(e){return Promise.all(e.map(o=>Promise.resolve(o).then(s=>({status:"fulfilled",value:s}),s=>({status:"rejected",reason:s}))))};document.getElementsByTagName("link");const r=document.querySelector("meta[property=csp-nonce]"),t=r?.nonce||r?.getAttribute("nonce");l=m(c.map(e=>{if(e=v(e),e in u)return;u[e]=!0;const o=e.endsWith(".css"),s=o?'[rel="stylesheet"]':"";if(document.querySelector(`link[href="${e}"]${s}`))return;const n=document.createElement("link");if(n.rel=o?"stylesheet":p,o||(n.as="script"),n.crossOrigin="",n.href=e,t&&n.setAttribute("nonce",t),document.head.appendChild(n),o)return new Promise((f,h)=>{n.addEventListener("load",f),n.addEventListener("error",()=>h(new Error(`Unable to preload CSS for ${e}`)))})}))}function a(r){const t=new Event("vite:preloadError",{cancelable:!0});if(t.payload=r,window.dispatchEvent(t),!t.defaultPrevented)throw r}return l.then(r=>{for(const t of r||[])t.status==="rejected"&&a(t.reason);return d().catch(a)})};async function y(){await E(()=>import("./main-learning-balanced-20261102.js"),__vite__mapDeps([0,1,2,3,4]))}y();

const css=document.createElement('link');css.rel='stylesheet';css.href='/assets/survey-builder.css';document.head.appendChild(css);

const tw=document.createElement('link');tw.rel='stylesheet';tw.href='/assets/teacher-workspace.css';document.head.appendChild(tw);

const rosterCss=document.createElement('link');rosterCss.rel='stylesheet';rosterCss.href='/assets/roster-redesign.css';document.head.appendChild(rosterCss);

const ql=document.createElement('link');ql.rel='stylesheet';ql.href='/assets/question-list.css';document.head.appendChild(ql);

const qrBalance=document.createElement('link');qrBalance.rel='stylesheet';qrBalance.href='/assets/attendance-balance.css';document.head.appendChild(qrBalance);

const rsp=document.createElement('link');rsp.rel='stylesheet';rsp.href='/assets/response-search.css';document.head.appendChild(rsp);

const profileCss=document.createElement('link');profileCss.rel='stylesheet';profileCss.href='/assets/sidebar-account.css';document.head.appendChild(profileCss);

const delStyle=document.createElement('link');delStyle.rel='stylesheet';delStyle.href='/assets/survey-delete.css';document.head.appendChild(delStyle);

const topCss=document.createElement("link");topCss.rel="stylesheet";topCss.href="/assets/back-to-top.css";document.head.appendChild(topCss);import("./back-to-top.js");

const qiCss=document.createElement("link");qiCss.rel="stylesheet";qiCss.href="/assets/question-insight.css";document.head.appendChild(qiCss);

const readableCss=document.createElement("link");readableCss.rel="stylesheet";readableCss.href="/assets/readable-fonts.css";document.head.appendChild(readableCss);import("./readable-fonts.js");

const groupCss=document.createElement("link");groupCss.rel="stylesheet";groupCss.href="/assets/groups.css";document.head.appendChild(groupCss);

const historyCss=document.createElement("link");historyCss.rel="stylesheet";historyCss.href="/assets/history-tools.css";document.head.appendChild(historyCss);

const boardCss=document.createElement("link");boardCss.rel="stylesheet";boardCss.href="/assets/group-board.css";document.head.appendChild(boardCss);

const topicCss=document.createElement("link");topicCss.rel="stylesheet";topicCss.href="/assets/group-topics.css";document.head.appendChild(topicCss);

const displayCss=document.createElement("link");displayCss.rel="stylesheet";displayCss.href="/assets/group-display.css";document.head.appendChild(displayCss);

const readerCss=document.createElement("link");readerCss.rel="stylesheet";readerCss.href="/assets/group-reader.css";document.head.appendChild(readerCss);

const homeworkCss=document.createElement("link");homeworkCss.rel="stylesheet";homeworkCss.href="/assets/homework-interface.css";document.head.appendChild(homeworkCss);

const studentCss=document.createElement("link");studentCss.rel="stylesheet";studentCss.href="/assets/student-home.css";document.head.appendChild(studentCss);

const gradeCss=document.createElement("link");gradeCss.rel="stylesheet";gradeCss.href="/assets/teacher-grade.css";document.head.appendChild(gradeCss);

const exportCss=document.createElement("link");exportCss.rel="stylesheet";exportCss.href="/assets/attendance-export.css";document.head.appendChild(exportCss);

const homeworkGradeCss=document.createElement("link");homeworkGradeCss.rel="stylesheet";homeworkGradeCss.href="/assets/homework-grade.css";document.head.appendChild(homeworkGradeCss);

const freeGradeCss=document.createElement("link");freeGradeCss.rel="stylesheet";freeGradeCss.href="/assets/group-free-grade.css";document.head.appendChild(freeGradeCss);
