from pathlib import Path
root=Path(__file__).parent/'knowledge-map'
p=root/'server.py';s=p.read_text(encoding='utf-8')
before=" return user,host('/classes',token)"
after=""" classes=[];cursor=None;seen=set()
 from urllib.parse import urlencode
 for _ in range(1000):
  page=host('/classes'+('?' + urlencode({'cursor':cursor}) if cursor else ''),token)
  if isinstance(page,list):classes.extend(page);break
  if not isinstance(page,dict) or not isinstance(page.get('items'),list):raise Error(503,'主系统班级接口格式不兼容')
  classes.extend(page['items']);cursor=page.get('nextCursor')
  if not cursor:break
  if cursor in seen:raise Error(503,'主系统班级分页无效')
  seen.add(cursor)
 else:raise Error(503,'班级分页超过上限')
 return user,classes"""
assert s.count(before)==1;s=s.replace(before,after);p.write_text(s,encoding='utf-8',newline='\n')
print('Adapted identity to real host items/nextCursor pagination; legacy array responses remain supported')
