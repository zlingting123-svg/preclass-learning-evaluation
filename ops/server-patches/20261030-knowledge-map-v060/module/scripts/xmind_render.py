"""Offline XMind styled SVG fallback; no model, external service, or truncation."""
import io,json,re,zipfile,xml.etree.ElementTree as ET
from html import escape
import pymupdf
MAX_TOPICS=2000
FONT=pymupdf.Font('china-s')
def local(tag):return tag.rsplit('}',1)[-1]
def xml(data):
 text=data.decode('utf-8-sig')
 if '<!DOCTYPE' in text.upper() or '<!ENTITY' in text.upper():raise ValueError('XMind XML不能含实体声明')
 return ET.fromstring(text)
def color(value,default):
 return value if isinstance(value,str) and re.fullmatch(r'#[0-9a-fA-F]{3,8}|(?:black|white|red|green|blue|gray|transparent|none)',value) else default
def parse(data):
 count=0;styles={}
 def topic(title,id,props,children,depth=0,note='',position=None,layout=''):
  nonlocal count
  count+=1
  if count>MAX_TOPICS or depth>40:raise ValueError('XMind过大，请按画布拆分（最多2000主题、40层）')
  title=str(title or '未命名主题')
  if len(title)>10000:raise ValueError('单个主题内容过长')
  return dict(title=title,id=str(id or count),props=props,children=children,depth=depth,note=note,position=position,layout=layout)
 def jt(t,depth=0):
  if depth>40:raise ValueError('XMind层级过深')
  props=dict(styles.get(t.get('style',{}).get('id',''),{}));props.update(t.get('style',{}).get('properties',{}));children=[]
  for kind in ['attached','detached','summary','callout']:
   for c in t.get('children',{}).get(kind,[]):
    n=jt(c,depth+1);n['detached']=kind=='detached';children.append(n)
  notes=t.get('notes',{});note=notes.get('plain',{}) if isinstance(notes,dict) else ''
  if isinstance(note,dict):note=note.get('content','')
  return topic(t.get('title'),t.get('id'),props,children,depth,str(note),t.get('position'),t.get('structureClass',''))
 def xt(t,depth=0):
  if depth>40:raise ValueError('XMind层级过深')
  children=[];title='';note='';pos=None
  for c in t:
   if local(c.tag)=='title':title=''.join(c.itertext())
   elif local(c.tag)=='notes':note=' '.join(c.itertext())
   elif local(c.tag)=='position':pos={k:float(v) for k,v in c.attrib.items() if k in ['x','y']}
   elif local(c.tag)=='children':
    for group in c:
     if local(group.tag)=='topics':
      for child in group:
       if local(child.tag)=='topic':
        n=xt(child,depth+1);n['detached']=group.get('type')=='detached';children.append(n)
  return topic(title,t.get('id'),dict(styles.get(t.get('style-id'),{})),children,depth,note,pos,t.get('structure-class',''))
 with zipfile.ZipFile(io.BytesIO(data)) as z:
  if len(z.infolist())>10000 or sum(i.file_size for i in z.infolist())>64*1024*1024:raise ValueError('XMind解压后过大')
  if 'styles.xml' in z.namelist():
   for style in xml(z.read('styles.xml')).iter():
    if local(style.tag)=='style':
     props={}
     for prop in style:
      if local(prop.tag)=='topic-properties':props.update({local(k):v for k,v in prop.attrib.items()})
     styles[style.get('id')]=props
  sheets=[]
  if 'content.json' in z.namelist():
   content=json.loads(z.read('content.json'))
   if not isinstance(content,list):raise ValueError('XMind画布格式无效')
   for s in content:
    sheets.append({'title':s.get('title','画布'),'root':jt(s['rootTopic']),'relations':s.get('relationships',[])})
  elif 'content.xml' in z.namelist():
   for s in xml(z.read('content.xml')):
    if local(s.tag)!='sheet':continue
    root=next((x for x in s if local(x.tag)=='topic'),None)
    if root is None:continue
    title=next((''.join(x.itertext()) for x in s if local(x.tag)=='title'),'画布');relations=[]
    for relation in s.iter():
     if local(relation.tag)=='relationship':relations.append({'end1Id':relation.get('end1'),'end2Id':relation.get('end2'),'title':next((x.text for x in relation if local(x.tag)=='title'),'')})
    sheets.append({'title':title,'root':xt(root),'relations':relations})
  else:raise ValueError('XMind没有可识别的主题内容')
 if not sheets:raise ValueError('XMind没有有效画布')
 return sheets,count

def describe(data):
 sheets,count=parse(data)
 def total(n):return 1+sum(total(c) for c in n['children'])
 return {'topics':count,'sheets':[{'title':s['title'],'topics':total(s['root']),'branches':[c['title'] for c in s['root']['children']]} for s in sheets]}
def render(data,sheet=0,branch=-1):
 sheets,_=parse(data)
 if sheet<0 or sheet>=len(sheets):raise ValueError('画布编号无效')
 selected=sheets[sheet];root=selected['root'];children=root['children']
 if branch>=0:
  if branch>=len(children):raise ValueError('章节编号无效')
  root={**root,'children':[children[branch]]}
 nodes=[];edges=[];gap=30
 def size(n):
  p=n['props'];d=n['depth'];raw=str(p.get('font-size','22' if d==0 else '16' if d==1 else '12'))
  f=float(re.search(r'[0-9.]+',raw).group()) if re.search(r'[0-9.]+',raw) else 12
  f=max(10,min(40,f*(1.3333 if 'pt' in raw else 1)));n['font']=f
  limit=280 if d==0 else 245;lines=[]
  for paragraph in n['title'].split('\n'):
   line=''
   for char in paragraph:
    if line and FONT.text_length(line+char,fontsize=f)>limit:lines.append(line);line=''
    line+=char
   lines.append(line)
  n['lines']=lines;n['w']=max(90,min(limit,max((FONT.text_length(x,fontsize=f) for x in lines),default=0))+28);n['h']=max(40,len(lines)*f*1.35+22)
  for c in n['children']:size(c)
  n['span']=max(n['h'],sum(c['span'] for c in n['children'])+gap*max(0,len(n['children'])-1))
 size(root)
 def layout(n,x,y,side=1,branch_color='#348278'):
  n['x']=x;n['y']=y;n['branchColor']=branch_color;nodes.append(n);cursor=y-n['span']/2
  for c in n['children']:
   cy=cursor+c['span']/2;cx=x+(n['w']+100 if side==1 else -c['w']-100)
   if c.get('detached') and isinstance(c.get('position'),dict):
    cx=float(c['position'].get('x',cx));cy=float(c['position'].get('y',cy))
   layout(c,cx,cy,side,branch_color);edges.append((n,c));cursor+=c['span']+gap
 # Respect explicit left/right/balanced map direction, use stored node styles.
 layout_name=root.get('layout','');balanced=('map' in layout_name and 'unbalanced' not in layout_name and branch<0 and len(root['children'])>1)
 if balanced:
  n=root;n['x']=0;n['y']=0;n['branchColor']='#348278';nodes.append(n)
  for side,group in [(1,root['children'][::2]),(-1,root['children'][1::2])]:
   cursor=-(sum(c['span'] for c in group)+gap*max(0,len(group)-1))/2
   for c in group:
    cy=cursor+c['span']/2;layout(c,n['w']+100 if side==1 else -c['w']-100,cy,side,color(c['props'].get('fill'),'#348278'));edges.append((n,c));cursor+=c['span']+gap
 else:layout(root,0,0,-1 if 'left' in layout_name else 1)
 minx=min(n['x'] for n in nodes)-60;maxx=max(n['x']+n['w'] for n in nodes)+60;miny=min(n['y']-n['h']/2 for n in nodes)-60;maxy=max(n['y']+n['h']/2 for n in nodes)+60
 svg=[f'<svg xmlns="http://www.w3.org/2000/svg" width="{maxx-minx:.1f}" height="{maxy-miny:.1f}" viewBox="{minx:.1f} {miny:.1f} {maxx-minx:.1f} {maxy-miny:.1f}"><rect x="{minx}" y="{miny}" width="{maxx-minx}" height="{maxy-miny}" fill="white"/>']
 for a,b in edges:
  right=b['x']>a['x'];x1=a['x']+a['w'] if right else a['x'];x2=b['x'] if right else b['x']+b['w'];mid=(x1+x2)/2
  svg.append(f'<path d="M{x1},{a["y"]} C{mid},{a["y"]} {mid},{b["y"]} {x2},{b["y"]}" stroke="{color(b["props"].get("line-color"),b["branchColor"])}" stroke-width="2" fill="none"/>')
 positions={n['id']:n for n in nodes}
 for rel in selected['relations']:
  a=positions.get(rel.get('end1Id'));b=positions.get(rel.get('end2Id'))
  if a and b:svg.append(f'<path d="M{a["x"]+a["w"]/2},{a["y"]} Q{(a["x"]+b["x"])/2},{min(a["y"],b["y"])-70} {b["x"]+b["w"]/2},{b["y"]}" fill="none" stroke="#8c8c8c" stroke-dasharray="5 4"><title>{escape(str(rel.get("title") or "关联"))}</title></path>')
 for n in nodes:
  p=n['props'];d=n['depth'];fill=color(p.get('fill'),'#183C4A' if d==0 else '#348278' if d==1 else '#F7FAFC');textcolor=color(p.get('color'),'white' if d<2 else '#243B4A');weight='bold' if p.get('font-weight','bold' if d<2 else 'normal') in ['bold','700','800','900'] else 'normal';shape=p.get('shape-class','');x=n['x'];y=n['y']-n['h']/2
  svg.append('<g data-topic="'+escape(n['id'],quote=True)+'"><title>'+escape(n['title']+('\n'+n['note'] if n['note'] else ''))+'</title>')
  if 'ellipse' in shape:svg.append(f'<ellipse cx="{x+n["w"]/2}" cy="{n["y"]}" rx="{n["w"]/2}" ry="{n["h"]/2}" fill="{fill}"/>')
  else:svg.append(f'<rect x="{x}" y="{y}" width="{n["w"]}" height="{n["h"]}" rx="{0 if "rectangle" in shape.lower() else 9}" fill="{fill}" stroke="{color(p.get("border-line-color"),"#d2dfdc")}"/>')
  svg.append(f'<text font-family="sans-serif" font-size="{n["font"]}" font-weight="{weight}" fill="{textcolor}">')
  for i,line in enumerate(n['lines']):svg.append(f'<tspan x="{x+14}" y="{y+17+n["font"]+i*n["font"]*1.35}">{escape(line)}</tspan>')
  svg.append('</text></g>')
 svg.append('</svg>');return ''.join(svg).encode('utf-8')
