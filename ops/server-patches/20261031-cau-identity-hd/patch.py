from pathlib import Path
r=Path('work/cau-hd');s=(r/'main.before.js').read_text(encoding='utf-8');anchor='o.jsx("span",{className:"pv-cau-course",children:"环境评价与管理"})';assert s.count(anchor)==1;s=s.replace(','+anchor,'');anchor='src:"/assets/cau-identity.png",alt:"中国农业大学 China Agricultural University",width:242,height:74';assert s.count(anchor)==2;s=s.replace(anchor,'src:"/assets/cau-identity-hd.svg",alt:"中国农业大学 China Agricultural University",width:800,height:237');s=s.replace('/assets/cau-identity-1.css','/assets/cau-identity-hd.css');(r/'main-cau-identity-hd.js').write_text(s,encoding='utf-8');s=Path('work/cau-login/cau-identity-1.css').read_text(encoding='utf-8');s+='''\n/* High-resolution official vector identity; no white plaque. */
.pv-cau-lockup img{filter:brightness(0) invert(1);mix-blend-mode:normal;opacity:1}
.pv-cau-lockup{mix-blend-mode:normal}
.pv-cau-login-identity .pv-cau-lockup{width:min(460px,100%);padding:0;justify-content:flex-start}
.pv-cau-login-identity .pv-cau-lockup img{width:430px;max-width:100%;height:auto}
.pv-login:has(.pv-cau-login-identity)>aside{padding-top:50px}
@media(max-width:760px){.pv-cau-login-identity .pv-cau-lockup{width:68px;height:84px;padding:0}.pv-cau-login-identity .pv-cau-lockup img{width:280px;max-width:none;height:auto}.pv-login:has(.pv-cau-login-identity)>aside{padding:24px}}
''';(r/'cau-identity-hd.css').write_text(s,encoding='utf-8')
