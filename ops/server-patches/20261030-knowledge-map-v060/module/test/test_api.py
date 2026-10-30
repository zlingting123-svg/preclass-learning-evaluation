import unittest,subprocess,tempfile,os,json,time,threading,socket,urllib.request,urllib.error
from pathlib import Path
from http.server import ThreadingHTTPServer,BaseHTTPRequestHandler
ROOT=Path(__file__).resolve().parents[1]
def port():
 s=socket.socket();s.bind(('127.0.0.1',0));p=s.getsockname()[1];s.close();return p
class Host(BaseHTTPRequestHandler):
 def log_message(self,*a):pass
 def do_GET(self):
  t=self.headers.get('Authorization','')[7:];role='teacher' if t=='teacher' else 'student'
  if t not in ['teacher','student','outsider']:self.send_response(401);self.end_headers();return
  x={'id':t,'role':role} if self.path.endswith('/auth/me') else ([] if t=='outsider' else [{'id':'class1','name':'一班'}])
  b=json.dumps({'data':x}).encode();self.send_response(200);self.end_headers();self.wfile.write(b)
 def do_POST(self):
  assert self.headers.get('Authorization')=='Bearer teacher'
  b=json.loads(self.rfile.read(int(self.headers['Content-Length'])));assert b['classId']=='class1'
  data=json.dumps({'data':{'outline':'自动整理主题\n  分支\n    细节'}}).encode();self.send_response(200);self.end_headers();self.wfile.write(data)
class Test(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.tmp=tempfile.TemporaryDirectory();cls.host=ThreadingHTTPServer(('127.0.0.1',0),Host);threading.Thread(target=cls.host.serve_forever,daemon=True).start();cls.p=port();env={**os.environ,'KM_DATA':cls.tmp.name,'KM_PORT':str(cls.p),'KM_HOST_API':f'http://127.0.0.1:{cls.host.server_port}/api/v1','KM_DEMO':'0'};cls.proc=subprocess.Popen([os.sys.executable,str(ROOT/'server.py')],env=env)
  for _ in range(100):
   try:urllib.request.urlopen(f'http://127.0.0.1:{cls.p}/api/config');break
   except OSError:time.sleep(.05)
 @classmethod
 def tearDownClass(cls):cls.proc.terminate();cls.proc.wait();cls.host.shutdown();cls.host.server_close();cls.tmp.cleanup()
 def call(self,path,token='',method='GET',body=None):
  if isinstance(body,dict):body=json.dumps(body).encode()
  q=urllib.request.Request(f'http://127.0.0.1:{self.p}'+path,data=body,method=method,headers={'Authorization':'Bearer '+token})
  try:
   with urllib.request.urlopen(q) as r:return r.status,json.load(r)
  except urllib.error.HTTPError as e:
   code=e.code;e.close();return code,None
 def test_lifecycle(self):
  self.assertEqual(self.call('/api/maps')[0],401)
  path='/api/maps?classId=class1&title=Test&name=test.txt&mode=graph'
  self.assertEqual(self.call(path,'student','POST',b'hello')[0],403)
  status,m=self.call(path,'teacher','POST','第一章\n知识点'.encode());self.assertEqual(status,201);self.assertIn('自动整理主题',m['outline'])
  self.assertEqual(self.call('/api/maps','student')[1],[])
  self.assertEqual(self.call('/api/maps/'+m['id']+'/file','student')[0],404)
  self.assertEqual(self.call('/api/maps/'+m['id']+'/pdf','student')[0],404)
  self.assertEqual(self.call('/api/maps/'+m['id']+'/pdf')[0],401)
  body={**m,'state':'published'};status,p=self.call('/api/maps/'+m['id'],'teacher','PUT',body);self.assertEqual(status,200)
  self.assertEqual(len(self.call('/api/maps','student')[1]),1)
  self.assertEqual(self.call('/api/maps/'+m['id'],'outsider')[0],404)
  self.assertEqual(self.call('/api/maps/'+m['id'],'student','PUT',p)[0],403)
  self.assertEqual(self.call('/api/maps/'+m['id'],'teacher','PUT',body)[0],409)
  status,w=self.call('/api/maps/'+m['id'],'teacher','PUT',{**p,'state':'draft'});self.assertEqual(status,200)
  self.assertEqual(self.call('/api/maps/'+m['id'],'student')[0],404)
  self.assertEqual(self.call('/api/maps/'+m['id']+'/pdf','student')[0],404)
 def test_xmind_default_native_and_download(self):
  from test_xmind import modern,legacy
  for raw in [modern(),legacy()]:
   status,m=self.call('/api/maps?classId=class1&title=XMind&name=map.xmind&mode=file','teacher','POST',raw)
   self.assertEqual(status,201);self.assertEqual(m['mode'],'file');self.assertEqual(m['outline'],'XMind');self.assertFalse(m['previewError']);self.assertIn('XMind',m['note'])
   path='/api/maps/'+m['id'];self.assertEqual(self.call(path,'student')[0],404)
   status,m=self.call(path,'teacher','PUT',{**m,'state':'published'});self.assertEqual(status,200)
   req=urllib.request.Request(f'http://127.0.0.1:{self.p}'+path+'/file',headers={'Authorization':'Bearer student'})
   with urllib.request.urlopen(req) as response:self.assertEqual(response.read(),raw)
   self.assertEqual(self.call(path+'/preview','outsider')[0],404)
   request=urllib.request.Request(f'http://127.0.0.1:{self.p}'+path+'/pdf',headers={'Authorization':'Bearer student'})
   import pymupdf
   with urllib.request.urlopen(request) as response:pdf=response.read()
   with pymupdf.open(stream=pdf,filetype='pdf') as doc:self.assertGreater(len(doc),0);self.assertFalse(doc[0].get_images())
   status,metadata=self.call(path,'student');self.assertTrue(metadata['canvasFallback']);self.assertGreater(metadata['canvasMeta']['topics'],0)
 def test_xmind_canvas_roundtrip(self):
  import io,zipfile
  from PIL import Image
  png=io.BytesIO();Image.new('RGBA',(640,360),(20,180,90,180)).save(png,format='PNG');original=png.getvalue();data=io.BytesIO()
  with zipfile.ZipFile(data,'w') as z:z.writestr('Thumbnails/thumbnail.png',original);z.writestr('content.json','No topic parsing required')
  raw=data.getvalue();status,m=self.call('/api/maps?classId=class1&title=Canvas&name=canvas.xmind&mode=graph','teacher','POST',raw)
  self.assertEqual(status,201);self.assertEqual(m['mode'],'file');self.assertFalse(m['previewError'])
  path='/api/maps/'+m['id'];self.assertEqual(self.call(path+'/preview','student')[0],404)
  status,m=self.call(path,'teacher','PUT',{**m,'state':'published'});self.assertEqual(status,200)
  for endpoint,expected in [('/preview',original),('/file',raw)]:
   request=urllib.request.Request(f'http://127.0.0.1:{self.p}'+path+endpoint,headers={'Authorization':'Bearer student'})
   with urllib.request.urlopen(request) as response:self.assertEqual(response.read(),expected)
  self.assertEqual(self.call(path+'/preview','outsider')[0],404)
 def test_svg_input_and_text_pdf(self):
  status,svg=self.call('/api/maps?classId=class1&title=SVG&name=vector.svg&mode=graph','teacher','POST',b'<svg xmlns="http://www.w3.org/2000/svg" width="80" height="60"><rect width="80" height="60" fill="green"/></svg>')
  self.assertEqual(status,201);self.assertEqual(svg['mode'],'file');self.assertEqual(svg['outline'],'SVG')
  for bad in [b'<svg><script>alert(1)</script></svg>',b'<svg><image href="file:///etc/passwd"/></svg>',b'<svg><style>@import "http://127.0.0.1";</style></svg>',b'<!DOCTYPE a [<!ENTITY x "xx">]><svg/>',b'<svg><rect onclick="alert(1)"/></svg>',b'<html/>']:
   self.assertEqual(self.call('/api/maps?classId=class1&title=Bad&name=bad.svg','teacher','POST',bad)[0],400)
  self.assertEqual(self.call('/api/maps?classId=class1&title=x&name=x.svg','student','POST',b'<svg/>')[0],403)
  status,m=self.call('/api/maps?classId=class1&title=Text&name=text.txt','teacher','POST','中文课程资料\n环境评价与管理'.encode())
  self.assertEqual(status,201);_,m=self.call('/api/maps/'+m['id'],'teacher','PUT',{**m,'state':'published'})
  req=urllib.request.Request(f'http://127.0.0.1:{self.p}/api/maps/'+m['id']+'/pdf',headers={'Authorization':'Bearer student'})
  import pymupdf
  with urllib.request.urlopen(req) as response:raw=response.read()
  with pymupdf.open(stream=raw,filetype='pdf') as doc:self.assertIn('环境评价与管理',''.join(p.get_text() for p in doc))
 def test_input(self):
  self.assertEqual(self.call('/api/maps?classId=class1&title=x&name=x.png','teacher','POST',b'not png')[0],400)
  self.assertEqual(self.call('/api/maps?classId=other&title=x&name=x.txt','teacher','POST',b'x')[0],403)
  self.assertEqual(self.call('/api/maps?classId=class1&title=x&name=../x.txt','teacher','POST',b'x')[0],400)
if __name__=='__main__':unittest.main()
