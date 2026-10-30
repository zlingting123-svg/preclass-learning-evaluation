from pathlib import Path
import re
root=Path('work/attendance-module');s=(root/'server-main.js').read_text(encoding='utf-8')
needle=re.search(r'\["/knowledge","book","[^"\n]+"\]',s).group()
assert s.count(needle)==1;s=s.replace(needle,needle+',["/attendance-images","grid","签到图片"]')
needle='...b&&l?[[`/core/classes/${l}/roster`'
assert s.count(needle)==1;s=s.replace(needle,'...b?[["/attendance","grid","拼图签到"],["/rollcall","users","随机点名"]]:[],...b&&l?[[`/core/classes/${l}/roster`')
needle='o.jsx(Ae,{path:"/knowledge",element:o.jsx(c5,{})}),'
assert s.count(needle)==1;s=s.replace(needle,needle+'o.jsx(Ae,{path:"/attendance-images",element:o.jsx(AttendancePanel,{request:Y,role:"admin"})}),')
needle='b&&o.jsxs(o.Fragment,{children:['
assert s.count(needle)==1;s=s.replace(needle,'o.jsx(Ae,{path:"/checkin",element:o.jsx("div",{className:"pv-page",children:"请在弹窗中确认签到。"})}),'+needle+'o.jsx(Ae,{path:"/attendance",element:o.jsx(AttendancePanel,{request:Y,classes:a,classId:l,role:e.role})}),o.jsx(Ae,{path:"/rollcall",element:o.jsx(AttendancePanel,{request:Y,classes:a,classId:l,role:e.role,mode:"rollcall"})}),')
needle='className:`pv-workspace ${E?"pv-chat-workspace":""}`,children:['
assert s.count(needle)==1;s=s.replace(needle,needle+'o.jsx(StudentAttendanceGate,{request:Y,user:e}),')
s='import{AttendancePanel,StudentAttendanceGate}from"./attendance-20261030.js";\n'+s
needle='x.pathname==="/personal"?'
assert s.count(needle)==1;s=s.replace(needle,'x.pathname==="/attendance"?"拼图签到":x.pathname==="/rollcall"?"随机点名":'+needle)
needle='"/knowledge":'
assert s.count(needle)==1;s=s.replace(needle,'"/attendance-images":"签到图片",'+needle)
(root/'patch/main-attendance-20261030.js').write_text(s,encoding='utf-8',newline='\n')
print('Added scoped teacher/admin routes and student check-in gate; preserved other layout code')
