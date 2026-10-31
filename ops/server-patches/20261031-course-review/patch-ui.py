from pathlib import Path
r=Path('work/course-review-fix');s=Path('work/cau-hd/main-cau-identity-hd.js').read_text(encoding='utf-8');s=s.replace('/assets/cau-identity-hd.css','/assets/course-review-layout.css');a=s.index('function I5(');b=s.index('function D5(',a);login=s[a:b];feature=lambda items:'o.jsxs("div",{className:"pv-login-features",children:['+','.join('o.jsxs("span",{children:[o.jsx(ve,{name:"'+icon+'"}),"'+label+'"]})' for icon,label in items)+']})'
old=feature([('users','班级协同'),('book','问卷洞察'),('spark','AI 课程助手')]);assert login.count(old)==1
login=login.replace(old,feature([('users','签到与点名'),('book','知识图谱'),('users','学生画像'),('spark','知识库问答')]))
s=s[:a]+login+s[b:];(r/'main-course-review.js').write_text(s,encoding='utf-8')
s=Path('work/cau-hd/cau-identity-hd.css').read_text(encoding='utf-8');s+='''\n/* Hallmark · pre-emit critique: P5 H5 E4 S5 R5 V4 */
.pv-login:has(.pv-cau-login-identity){grid-template-columns:minmax(0,.94fr) minmax(0,1fr)}
.pv-login:has(.pv-cau-login-identity)>aside{padding:44px clamp(30px,4vw,64px);gap:32px}
.pv-login:has(.pv-cau-login-identity) .pv-login-story{margin:auto 0;padding:0;max-width:540px}
.pv-login:has(.pv-cau-login-identity) .pv-login-story h1{font-size:clamp(34px,3.1vw,46px);line-height:1.28;margin:16px 0 20px;letter-spacing:-.035em}
.pv-login:has(.pv-cau-login-identity) .pv-login-story>p:not(.pv-eyebrow){font-size:15px;line-height:1.8;margin:0 0 25px}
.pv-login:has(.pv-cau-login-identity) .pv-login-features{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));column-gap:25px;row-gap:0;margin-top:24px;max-width:480px;border-top:1px solid var(--pv-hero-edge)}
.pv-login:has(.pv-cau-login-identity) .pv-login-features span{font-size:14px;padding:17px 0;border-bottom:1px solid var(--pv-hero-edge);gap:12px;white-space:nowrap}
.pv-login:has(.pv-cau-login-identity) .pv-login-features .pv-icon{width:20px;height:20px}
.pv-login:has(.pv-cau-login-identity) .pv-login-form{max-width:400px}
.pv-login:has(.pv-cau-login-identity) .pv-login-form label{font-size:14px}
.pv-login:has(.pv-cau-login-identity) .pv-login-form input{height:50px;font-size:16px}
.pv-login:has(.pv-cau-login-identity) .pv-login-form .pv-primary{height:50px;font-size:14px}
@media(max-width:760px){.pv-login:has(.pv-cau-login-identity){grid-template-columns:minmax(0,1fr)}.pv-login:has(.pv-cau-login-identity)>aside{padding:24px;gap:18px;min-height:0}.pv-login:has(.pv-cau-login-identity) .pv-login-story{margin:0;padding:0}.pv-login:has(.pv-cau-login-identity) .pv-login-story h1{font-size:25px;margin:0}.pv-login:has(.pv-cau-login-identity) .pv-login-features{display:none}.pv-login:has(.pv-cau-login-identity)>main{padding:30px 24px}}
''';(r/'course-review-layout.css').write_text(s,encoding='utf-8')
