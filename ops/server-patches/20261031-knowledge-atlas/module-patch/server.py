#!/usr/bin/env python3
"""Independent knowledge-map module. Production authentication delegates to the host."""
from contextlib import contextmanager
from xml.etree.ElementTree import ParseError as ETParseError
import os,json,sqlite3,uuid,hashlib,re,zipfile,io,subprocess,tempfile,threading
from pathlib import Path
from urllib.request import Request,urlopen
from urllib.error import HTTPError
from http.server import ThreadingHTTPServer,BaseHTTPRequestHandler
BASE=Path(__file__).resolve().parent
DATA=Path(os.environ.get('KM_DATA',BASE/'work'));DATA.mkdir(parents=True,exist_ok=True)
DB=DATA/'maps.sqlite'; HOST=os.environ.get('KM_HOST_API','http://127.0.0.1:3001/api/v1').rstrip('/')
DEMO=os.environ.get('KM_DEMO')=='1';LIMIT=32*1024*1024
lock=threading.RLock()
pdf_locks={}
@contextmanager
def connect():
 c=sqlite3.connect(DB);c.row_factory=sqlite3.Row
 try:
  with c:yield c
 finally:c.close()
with connect() as c:c.execute('CREATE TABLE IF NOT EXISTS maps(id TEXT PRIMARY KEY, payload TEXT NOT NULL)')
class Error(Exception):
 def __init__(self,status,message):self.status=status;self.message=message

def host(path,token=None,body=None):
 headers={'Content-Type':'application/json'}
 if token:headers['Authorization']='Bearer '+token
 try:
  with urlopen(Request(HOST+path,data=None if body is None else json.dumps(body).encode(),headers=headers),timeout=12) as r:return json.load(r)['data']
 except HTTPError as e:raise Error(e.code,'登录失效或没有访问权限')
 except (OSError,KeyError,ValueError):raise Error(503,'主系统暂时不可用')
def identity(h):
 auth=h.headers.get('Authorization','');token=auth[7:] if auth.startswith('Bearer ') else ''
 if DEMO:
  if token not in ['demo-teacher','demo-student','demo-other']:raise Error(401,'请登录')
  return {'id':token,'role':'teacher' if token=='demo-teacher' else 'student'},[{'id':'demo-class','name':'本地演示班级'}] if token!='demo-other' else []
 if not token:raise Error(401,'请登录')
 user=host('/auth/me',token);user=user.get('user',user)
 if user.get('role') not in ['teacher','student']:raise Error(403,'请使用教师或学生账号')
 classes=[];cursor=None;seen=set()
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
 return user,classes
def records():
 with connect() as c:return [json.loads(x[0]) for x in c.execute('SELECT payload FROM maps ORDER BY rowid DESC')]
def save(m):
 with connect() as c:c.execute('INSERT INTO maps VALUES(?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload',(m['id'],json.dumps(m,ensure_ascii=False)))
def can_read(m,user,classes):return m['classId'] in {c['id'] for c in classes} and (m['owner']==user['id'] or m['state']=='published')
def owned(m,user,classes):
 if user['role']!='teacher' or m['owner']!=user['id'] or m['classId'] not in {c['id'] for c in classes}:raise Error(403,'无编辑权限')
def get(mid):
 if not re.fullmatch('[a-f0-9-]{36}',mid):raise Error(404,'图谱不存在')
 with connect() as c:r=c.execute('SELECT payload FROM maps WHERE id=?',(mid,)).fetchone()
 if not r:raise Error(404,'图谱不存在')
 return json.loads(r[0])
def ocr_bytes(b, suffix):
 with tempfile.TemporaryDirectory(prefix='map-ocr-') as td:
  path=Path(td)/('image'+suffix);path.write_bytes(b)
  r=subprocess.run([os.sys.executable,str(BASE/'scripts/ocr.py'),str(path)],capture_output=True,text=True,timeout=120)
  if r.returncode:raise Error(422,'图像识别未成功，请检查 OCR 组件或导入文字版文件')
  return r.stdout.strip()
def extract(name,b):
 ext=Path(name).suffix.lower();message='已生成结构草稿，请教师核对后发布。';outline=''
 if ext in ['.txt','.md','.json']:
  text=b.decode('utf-8-sig');
  if ext=='.json':
   x=json.loads(text)
   if isinstance(x,dict) and isinstance(x.get('outline'),str):return x['outline'][:60000],message
  lines=[x.strip() for x in text.splitlines() if x.strip()];outline='\n'.join(lines[:100])
 elif ext=='.xmind':
  from scripts.xmind import read_xmind
  try:outline,sheets,count,_=read_xmind(b)
  except (ValueError,KeyError,TypeError,ETParseError) as e:raise Error(400,str(e))
  message=f'已读取XMind：{sheets}个画布、{count}个主题。保留主题层级并重新排版；原始样式、关系线和附件请下载原件在XMind中查看。'
 elif ext=='.docx':
  with zipfile.ZipFile(io.BytesIO(b)) as z:
   if sum(x.file_size for x in z.infolist())>64*1024*1024:raise Error(400,'文档解压后过大')
   import xml.etree.ElementTree as ET
   root=ET.fromstring(z.read('word/document.xml'));ns={'w':'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
   lines=[''.join(p.itertext()).strip() for p in root.findall('.//w:p',ns)]
   outline='\n'.join(x[:180] for x in lines if x)[:60000]
 elif ext in ['.doc','.ppt','.pptx']:
  with tempfile.TemporaryDirectory() as folder:
   source=Path(folder)/('source'+ext);target=Path(folder)/'preview.pdf';source.write_bytes(b)
   subprocess.run([os.sys.executable,str(BASE/'scripts/preview.py'),str(source),str(target)],capture_output=True,check=True,timeout=150)
   return extract(Path(name).stem+'.pdf',target.read_bytes())
 elif ext=='.pdf':
  try:
   from pypdf import PdfReader
   reader=PdfReader(io.BytesIO(b));
   if reader.is_encrypted:raise Error(400,'请先解密 PDF')
   lines=[]
   for index,page in enumerate(reader.pages[:300]):
    text=page.extract_text() or ''
    if not text.strip():
     import pymupdf as fitz
     doc=fitz.open(stream=b,filetype='pdf');image=doc[index].get_pixmap(matrix=fitz.Matrix(1.5,1.5)).tobytes('png');text=ocr_bytes(image,'.png');doc.close()
    for line in text.splitlines():
     line=line.strip()
     if 2<len(line)<=100:lines.append(line)
   outline='\n'.join(lines[:100])
   message='已从 PDF 前300页提取结构草稿（最多100条），不是全文智能解读；请编辑层级后发布。' if outline else 'PDF 未提取到文字，请查看原件并手工编排图谱。'
  except ImportError:message='PDF 原件已保存；文字提取组件未安装，请手工编排。'
 else:
  outline=ocr_bytes(b,ext)
  if not outline:raise Error(422,'图片没有识别到文字，请导入清晰图像')
  message='已识别图片文字并生成结构草稿，请教师核对文字和层级。'
 if not outline:outline=Path(name).stem+'\n  请编辑知识点\n    请编辑知识点之间的联系'
 # Conservative heuristic only; preserve explicit Markdown/indentation.
 if ext not in ['.xmind','.json','.md']:
  lines=outline.splitlines();outline=Path(name).stem+'\n'+'\n'.join('  '+x[:180] for x in lines[:100])
 return outline[:60000],message
class Handler(BaseHTTPRequestHandler):
 def log_message(self,*args):pass
 def send(self,status,data,ctype='application/json; charset=utf-8'):
  b=json.dumps(data,ensure_ascii=False).encode() if ctype.startswith('application/json') and not isinstance(data,bytes) else data
  self.send_response(status);self.send_header('Content-Type',ctype);self.send_header('Content-Length',str(len(b)));self.send_header('Cache-Control','no-store');self.send_header('X-Content-Type-Options','nosniff');self.send_header('Referrer-Policy','no-referrer');
  if ctype.startswith('image/svg+xml'):self.send_header('Content-Security-Policy',"default-src 'none'; style-src 'unsafe-inline'; img-src data:; sandbox")
  self.end_headers();self.wfile.write(b)
 def body(self,limit=LIMIT):
  n=int(self.headers.get('Content-Length','0'))
  if n<=0 or n>limit:raise Error(413,'文件过大（上限32MB）或请求为空')
  return self.rfile.read(n)
 def send_pdf(self,m,user,classes):
  with lock:job=pdf_locks.setdefault(m['id'],threading.Lock())
  with job:
   if m['ext']=='.pdf':return self.send(200,(DATA/(m['id']+m['ext'])).read_bytes(),'application/pdf')
   cache=DATA/(m['id']+'.download-v2.pdf')
   if not cache.exists():
    fd,temp=tempfile.mkstemp(prefix=m['id']+'-',suffix='.pdf',dir=DATA);os.close(fd)
    try:
     source=DATA/(m['id']+m['ext']);office=DATA/(m['id']+'.preview.pdf')
     try:r=subprocess.run([os.sys.executable,str(BASE/'scripts/pdf_export.py'),str(source),temp,str(office)],capture_output=True,text=True,timeout=150)
     except subprocess.TimeoutExpired:raise Error(504,'PDF生成超时，请稍后重试或下载原文件')
     if r.returncode:raise Error(422,(r.stderr.strip().splitlines() or ['PDF生成失败，请下载原文件'])[-1][:240])
     os.replace(temp,cache)
    finally:
     if os.path.exists(temp):os.unlink(temp)
   if not can_read(get(m['id']),user,classes):raise Error(404,'图谱不存在或尚未发布')
   return self.send(200,cache.read_bytes(),'application/pdf')
 def route(self):
  from urllib.parse import urlsplit,parse_qs
  origin=self.headers.get('Origin')
  if self.command in ['POST','PUT'] and origin and urlsplit(origin).netloc!=self.headers.get('Host'):raise Error(403,'请求来源不允许')
  path=urlsplit(self.path).path;path=path.removeprefix('/knowledge-map') or '/'
  if self.command=='GET' and path in ['/','/app.js','/style.css','/atlas.bundle.js','/atlas.css']:
   f=BASE/'public'/({'/':'index.html'}.get(path,path.lstrip('/')));ctype={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8'}[f.suffix];return self.send(200,f.read_bytes(),ctype)
  if path=='/api/config':return self.send(200,{'demo':DEMO})
  if path=='/api/login' and self.command=='POST':
   if DEMO:raise Error(400,'演示使用身份切换')
   return self.send(200,host('/auth/login',body=json.loads(self.body(4096))))
  user,classes=identity(self)
  if path=='/api/me':return self.send(200,{'user':user,'classes':classes})
  if path=='/api/maps' and self.command=='GET':return self.send(200,[{k:v for k,v in m.items() if k not in ['outline','editedOutline']} for m in records() if can_read(m,user,classes)])
  if path=='/api/maps' and self.command=='POST':
   if user['role']!='teacher':raise Error(403,'仅教师可导入')
   q=parse_qs(urlsplit(self.path).query);classId=q.get('classId',[''])[0];name=q.get('name',[''])[0];title=q.get('title',[''])[0].strip();mode=q.get('mode',['file'])[0]
   if mode not in ['file','graph']:raise Error(400,'导入模式无效')
   if classId not in {c['id'] for c in classes}:raise Error(403,'无班级权限')
   if not title or len(title)>180 or len(name)>240 or '/' in name or '\\' in name:raise Error(400,'名称无效')
   b=self.body();ext=Path(name).suffix.lower();types={'.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.pdf':'application/pdf','.doc':'application/msword','.ppt':'application/vnd.ms-powerpoint','.pptx':'application/vnd.openxmlformats-officedocument.presentationml.presentation','.gif':'image/gif','.bmp':'image/bmp','.tif':'image/tiff','.tiff':'image/tiff','.docx':'application/vnd.openxmlformats-officedocument.wordprocessingml.document','.xmind':'application/octet-stream','.txt':'text/plain','.md':'text/plain','.json':'application/json'}
   if ext not in types:raise Error(400,'支持图片、PDF、Word DOC/DOCX、PPT/PPTX、XMind及文本')
   if ext=='.pdf' and not b.startswith(b'%PDF-'):raise Error(400,'PDF格式无效')
   if ext=='.png' and not b.startswith(b'\x89PNG\r\n\x1a\n'):raise Error(400,'PNG格式无效')
   if ext in ['.jpg','.jpeg'] and not b.startswith(b'\xff\xd8'):raise Error(400,'JPEG格式无效')
   if ext=='.webp' and not (b.startswith(b'RIFF') and b[8:12]==b'WEBP'):raise Error(400,'WebP格式无效')
   if ext=='.svg':
    from scripts.svg import validate_svg
    try:validate_svg(b)
    except ValueError as e:raise Error(400,str(e))
    mode='file'
   if ext=='.xmind':
    from scripts.xmind import read_canvas
    mode='file';xmindCanvas=read_canvas(b)
    if xmindCanvas is None:
     from scripts.xmind_render import describe
     try:describe(b)
     except (ValueError,ETParseError,KeyError,TypeError) as e:raise Error(400,'XMind解析失败：'+str(e))
   outline,note=extract(name,b) if mode=='graph' else (title,'原文件已保存，请预览核对后发布。')
   if ext=='.svg':note='SVG矢量原稿，可放大浏览并下载原文件或PDF。'
   if ext=='.xmind':note='直接显示XMind文件内保存的原稿画布，保留原来的排版、颜色和连线。'
   if mode=='graph' and not DEMO and ext not in ['.xmind','.json']:
    token=self.headers.get('Authorization','')[7:]
    try:
     generated=host('/teacher/knowledge-map-generate',token,{'classId':classId,'text':outline[:8000]});outline=generated['outline'];note='已由模型依据提取的结构文字自动整理，请核对后发布（本次最多8000字，长文档建议按章节导入）。'
    except Error as e:raise Error(e.status,'自动整理未完成：'+e.message)
   elif mode=='graph' and DEMO and ext not in ['.xmind','.json']:
    note+=' 本地离线预览按文字行生成层级，未调用真实模型。'
   mid=str(uuid.uuid4());f=DATA/(mid+ext);f.write_bytes(b);os.chmod(f,0o600)
   previewExt=ext;previewMime=types[ext];previewError=''
   if ext=='.xmind':
    from scripts.xmind import read_canvas
    thumbnail=xmindCanvas
    previewExt='.preview.png';previewMime='image/png'
    if thumbnail:
     (DATA/(mid+previewExt)).write_bytes(thumbnail);os.chmod(DATA/(mid+previewExt),0o600)
    else:
     from scripts.xmind_render import render
     previewExt='.preview.svg';previewMime='image/svg+xml';(DATA/(mid+previewExt)).write_bytes(render(b));os.chmod(DATA/(mid+previewExt),0o600)
     note='XMind未带预览，已按文件主题与样式生成矢量画布；布局可能与XMind客户端略有差异。'
   elif ext in ['.doc','.docx','.ppt','.pptx','.bmp','.tif','.tiff']:
    previewExt='.preview.pdf' if ext in ['.doc','.docx','.ppt','.pptx'] else '.preview.png'
    previewMime='application/pdf' if previewExt.endswith('pdf') else 'image/png'
    try:
     subprocess.run([os.sys.executable,str(BASE/'scripts/preview.py'),str(f),str(DATA/(mid+previewExt))],capture_output=True,check=True,timeout=150)
    except Exception:previewError='该文件暂时无法在线预览，可下载原文件；请确认已安装LibreOffice或文件是否损坏。'
   elif ext in ['.png','.jpg','.jpeg','.webp','.gif']:
    from PIL import Image
    try:
     with Image.open(io.BytesIO(b)) as image:image.verify()
    except Exception:
     f.unlink();raise Error(400,'图像内容无效或过大')
   pageCount=0
   if previewMime=='application/pdf' and not previewError:
    try:
     import pymupdf
     with pymupdf.open(DATA/(mid+previewExt)) as pdf:
      if pdf.is_encrypted:raise ValueError('encrypted')
      pageCount=len(pdf)
    except Exception:previewError='PDF无法在线浏览，文件可能已加密或损坏。请下载原文件查看。'
   m={'id':mid,'title':title,'name':name,'classId':classId,'owner':user['id'],'state':'draft','version':1,'outline':outline,'note':note,'ext':ext,'mime':types[ext],'sha256':hashlib.sha256(b).hexdigest(),'mode':mode,'pageCount':pageCount,'previewExt':previewExt,'previewMime':previewMime,'previewError':previewError};save(m);return self.send(201,m)
  match=re.fullmatch('/api/maps/([a-f0-9-]+)(/file|/preview|/pdf|/editable|/graph-pdf|/graph|/page/[0-9]+)?',path)
  if not match:raise Error(404,'接口不存在')
  if self.command=='GET' and match[2]=='/graph':
   with lock:
    m=get(match[1])
    if not can_read(m,user,classes):raise Error(404,'图谱不存在或尚未发布')
    from scripts.graph_data import graph_for
    try:graph=graph_for(m,DATA)
    except ValueError as e:raise Error(422,str(e))
    return self.send(200,graph)
  if self.command=='GET' and match[2]=='/editable':
   m=get(match[1]);owned(m,user,classes)
   from scripts.editor import initial_outline
   try:outline=initial_outline(m,DATA)
   except ValueError as e:raise Error(422,str(e))
   return self.send(200,{'outline':outline,'version':m['version']})
  if self.command=='GET' and match[2]=='/graph-pdf':
   m=get(match[1])
   if not can_read(m,user,classes):raise Error(404,'图谱不存在或尚未发布')
   outline=m.get('editedOutline') or (m['outline'] if m.get('mode')=='graph' else '')
   if not outline:raise Error(400,'请先保存可编辑的图谱版本')
   from scripts.editor import export_pdf
   with lock:job=pdf_locks.setdefault(m['id'],threading.Lock())
   with job:
    cache=DATA/(m['id']+'.edited-v'+str(m['version'])+'.pdf')
    if not cache.exists():
     try:pdf=export_pdf(outline)
     except ValueError as e:raise Error(422,str(e))
     cache.write_bytes(pdf);os.chmod(cache,0o600)
    if not can_read(get(m['id']),user,classes):raise Error(404,'图谱不存在或尚未发布')
    return self.send(200,cache.read_bytes(),'application/pdf')
  if self.command=='GET' and match[2]=='/pdf':
   m=get(match[1])
   if not can_read(m,user,classes):raise Error(404,'图谱不存在或尚未发布')
   return self.send_pdf(m,user,classes)
  with lock:
   m=get(match[1])
   if not can_read(m,user,classes):raise Error(404,'图谱不存在或尚未发布')
   if self.command=='GET':
    if m['ext']=='.xmind' and match[2]!='/file':
     from scripts.xmind import read_canvas
     raw=(DATA/(m['id']+m['ext'])).read_bytes();canvas=read_canvas(raw)
     m['mode']='file';m['previewError']='';m['canvasFallback']=canvas is None
     if canvas is None:
      from scripts.xmind_render import describe,render
      try:m['canvasMeta']=describe(raw)
      except (ValueError,ETParseError,KeyError,TypeError) as e:raise Error(422,'XMind主题解析失败：'+str(e))
      m['previewMime']='image/svg+xml'
      if match[2]=='/preview':
       query=parse_qs(urlsplit(self.path).query);sheet=int(query.get('sheet',['0'])[0]);branch=int(query.get('branch',['-1'])[0])
       if sheet<0 or sheet>=len(m['canvasMeta']['sheets']):raise Error(400,'画布编号无效')
       if branch < -1 or branch>=len(m['canvasMeta']['sheets'][sheet]['branches']):raise Error(400,'章节编号无效')
       cache=DATA/(m['id']+f'.canvas-v1-s{sheet}-b{branch}.svg')
       if not cache.exists():
        try:canvas=render(raw,sheet,branch)
        except ValueError as e:raise Error(400,str(e))
        cache.write_bytes(canvas);os.chmod(cache,0o600)
       return self.send(200,cache.read_bytes(),'image/svg+xml')
     else:
      m['previewMime']='image/png'
      if match[2]=='/preview':return self.send(200,canvas,'image/png')
    if match[2]=='/file':return self.send(200,(DATA/(m['id']+m['ext'])).read_bytes(),m['mime'])
    if match[2] and match[2].startswith('/page/'):
     if m.get('previewError'):raise Error(422,m['previewError'])
     if m.get('previewMime',m['mime'])!='application/pdf':raise Error(400,'此文件无需翻页')
     import pymupdf
     number=int(match[2].split('/')[-1])
     with pymupdf.open(DATA/(m['id']+m.get('previewExt',m['ext']))) as pdf:
      if number<1 or number>len(pdf):raise Error(400,'页码无效')
      page=pdf[number-1];factor=min(2,1600/max(page.rect.width,page.rect.height));data=page.get_pixmap(matrix=pymupdf.Matrix(factor,factor),alpha=False).tobytes('png')
     return self.send(200,data,'image/png')
    if match[2]=='/preview':
     if m.get('previewError'):raise Error(422,m['previewError'])
     return self.send(200,(DATA/(m['id']+m.get('previewExt',m['ext']))).read_bytes(),m.get('previewMime',m['mime']))
    return self.send(200,m)
   if self.command!='PUT' or match[2]:raise Error(405,'不支持的操作')
   owned(m,user,classes);b=json.loads(self.body(1000000))
   if b.get('version')!=m['version']:raise Error(409,'内容已被修改，请重新打开')
   outline=b.get('outline','');title=b.get('title','').strip();state=b.get('state')
   if ('editedOutline' not in b and (not isinstance(outline,str) or not outline.strip() or len(outline)>60000 or len(outline.splitlines())>500)) or state not in ['draft','published'] or not title or len(title)>180:raise Error(400,'标题或图谱内容无效（最多500个节点）')
   if 'editedOutline' in b:
    from scripts.editor import validate
    try:validate(b['editedOutline'])
    except ValueError as e:raise Error(400,str(e))
    m.update(editedOutline=b['editedOutline'],graphEdited=True)
   else:m['outline']=outline
   m.update(title=title,state=state,version=m['version']+1);save(m);return self.send(200,m)
 def handle_all(self):
  try:self.route()
  except Error as e:self.send(e.status,{'error':e.message})
  except (ValueError,KeyError,zipfile.BadZipFile,UnicodeError):self.send(400,{'error':'文件或请求格式不正确'})
  except Exception:self.send(500,{'error':'处理失败，文件可能无法解析'})
 do_GET=do_POST=do_PUT=handle_all
if __name__=='__main__':
 ThreadingHTTPServer(('127.0.0.1',int(os.environ.get('KM_PORT','3216'))),Handler).serve_forever()
