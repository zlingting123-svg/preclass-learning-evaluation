"""Bounded local XMind JSON and legacy XML topic reader. Never extracts archive paths."""
import io,json,zipfile,xml.etree.ElementTree as ET

def read_xmind(data):
 out=[];count=0
 def add(title,depth):
  nonlocal count
  count+=1
  if count>500 or depth>12:raise ValueError('XMind最多支持500个主题、12级层级，请按画布拆分文件')
  title=' '.join(str(title or '未命名主题').split())
  if len(title)>180:raise ValueError('XMind主题超过180字，请缩短主题文字')
  out.append('  '*depth+title)
 def json_topic(t,d):
  if not isinstance(t,dict):raise ValueError('XMind主题结构无效')
  add(t.get('title'),d)
  children=t.get('children',{})
  if not isinstance(children,dict):raise ValueError('XMind子主题结构无效')
  for kind in ['attached','detached','summary','callout']:
   for c in children.get(kind,[]):json_topic(c,d+1)
 def tag(el):return el.tag.rsplit('}',1)[-1]
 def xml_topic(t,d):
  add(next((x.text for x in t if tag(x)=='title'),None),d)
  for c in t:
   if tag(c)=='children':
    for group in c:
     if tag(group)=='topics':
      for child in group:
       if tag(child)=='topic':xml_topic(child,d+1)
 with zipfile.ZipFile(io.BytesIO(data)) as z:
  if len(z.infolist())>10000 or sum(i.file_size for i in z.infolist())>64*1024*1024:raise ValueError('XMind解压后过大')
  if 'content.json' in z.namelist():
   sheets=json.loads(z.read('content.json'))
   if not isinstance(sheets,list) or not sheets:raise ValueError('XMind没有有效画布')
   for sheet in sheets:
    if len(sheets)>1:add(sheet.get('title','画布'),0)
    json_topic(sheet['rootTopic'],1 if len(sheets)>1 else 0)
  elif 'content.xml' in z.namelist():
   data=z.read('content.xml')
   if b'<!DOCTYPE' in data.upper() or b'<!ENTITY' in data.upper():raise ValueError('不支持含实体声明的XMind XML')
   root=ET.fromstring(data);sheets=[x for x in root if tag(x)=='sheet']
   if not sheets:raise ValueError('XMind没有有效画布')
   for sheet in sheets:
    if len(sheets)>1:add(next((x.text for x in sheet if tag(x)=='title'),'画布'),0)
    topics=[x for x in sheet if tag(x)=='topic']
    if not topics:raise ValueError('XMind画布没有中心主题')
    for topic in topics:xml_topic(topic,1 if len(sheets)>1 else 0)
  else:raise ValueError('文件不是可识别的XMind：缺少content.json或content.xml')
  thumbnail=None
  for name in ['Thumbnails/thumbnail.png','thumbnails/thumbnail.png']:
   if name in z.namelist():
    try:
     from PIL import Image
     with Image.open(io.BytesIO(z.read(name))) as img:
      if img.width*img.height>20000000:break
      target=io.BytesIO();img.convert('RGB').save(target,format='PNG');thumbnail=target.getvalue()
    except Exception:pass
    break
 outline='\n'.join(out)
 if len(outline)>60000:raise ValueError('XMind文字过多，请按画布拆分文件')
 return outline,len(sheets),count,thumbnail

def read_canvas(data):
 """Return the saved XMind canvas image unchanged, without parsing/rebuilding topics."""
 with zipfile.ZipFile(io.BytesIO(data)) as z:
  if len(z.infolist())>10000 or sum(i.file_size for i in z.infolist())>64*1024*1024:raise ValueError('XMind解压后过大')
  for name in ['Thumbnails/thumbnail.png','thumbnails/thumbnail.png']:
   if name in z.namelist():
    from PIL import Image
    raw=z.read(name)
    with Image.open(io.BytesIO(raw)) as img:
     if img.format!='PNG' or img.width*img.height>20000000:raise ValueError('XMind原稿画布无效或过大')
     img.verify()
    return raw
 return None
