from pathlib import Path
r=Path('work/cau-login');s=(r/'main.before.js').read_text(encoding='utf-8')
img='o.jsx("img",{src:"/assets/cau-identity.png",alt:"中国农业大学 China Agricultural University",width:242,height:74,decoding:"async"})'
shield='o.jsx("span",{className:"pv-cau-shield",children:o.jsx("img",{src:"/assets/cau-identity.png",alt:"中国农业大学校徽",width:242,height:74,decoding:"async"})})'
anchor='o.jsx("div",{className:"pv-welcome-mark","aria-hidden":"true",children:o.jsx(ve,{name:"spark"})})';assert s.count(anchor)==1;s=s.replace(anchor,'o.jsx("div",{className:"pv-welcome-mark pv-cau-welcome",children:o.jsx("div",{className:"pv-cau-lockup",children:'+img+'})})')
s=s.replace('o.jsx("span",{className:"pv-welcome-label",children:"LEARNING, CONNECTED."})','o.jsx("span",{className:"pv-welcome-label",children:"环境评价与管理"})')
a=s.index('function I5(');b=s.index('function D5(',a);login=s[a:b]
anchor='o.jsxs("div",{className:"pv-brand",children:[o.jsx("span",{className:"pv-brand-icon",children:o.jsx(ve,{name:"spark"})}),"环境评价与管理",o.jsx("span",{className:"pv-beta",children:"DESIGN PREVIEW"})]})';assert login.count(anchor)==1
login=login.replace(anchor,'o.jsxs("div",{className:"pv-cau-login-identity",children:[o.jsx("div",{className:"pv-cau-lockup",children:'+img+'}),o.jsx("span",{className:"pv-cau-course",children:"环境评价与管理"})]})')
login=login.replace('独立外观预览 · 保留原有业务与权限','环境评价与管理 · 课程学习平台');s=s[:a]+login+s[b:]
anchor='o.jsx("span",{className:"pv-brand-icon",children:o.jsx(ve,{name:"spark"})})';assert s.count(anchor)==1;s=s.replace(anchor,'o.jsx("span",{className:"pv-brand-icon pv-cau-brand-icon",children:'+shield+'})')
s='import "./cau-identity-1.css";\n'+s
# CSS cannot be imported as an ES module directly; append via a scoped stylesheet loader instead.
s=s.replace('import "./cau-identity-1.css";','const cauIdentityStyle=document.createElement("link");cauIdentityStyle.rel="stylesheet";cauIdentityStyle.href="/assets/cau-identity-1.css";document.head.append(cauIdentityStyle);',1)
(r/'main-cau-identity-1.js').write_text(s,encoding='utf-8')
