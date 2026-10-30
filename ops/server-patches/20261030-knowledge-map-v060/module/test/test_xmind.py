import unittest,io,zipfile,json,sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from scripts.xmind import read_xmind,read_canvas

def archive(name,data):
 b=io.BytesIO()
 with zipfile.ZipFile(b,'w',zipfile.ZIP_DEFLATED) as z:
  z.writestr(name,data);z.writestr('metadata.json','{"creator":{"name":"Knowledge map format test"}}')
 return b.getvalue()
def modern():
 return archive('content.json',json.dumps([{'id':'sheet1','title':'环评程序','rootTopic':{'id':'root1','title':'环境影响评价','children':{'attached':[{'id':'a','title':'准备阶段','children':{'attached':[{'id':'b','title':'现场调查','children':{'attached':[{'id':'c','title':'水环境调查'}]}}]}},{'id':'d','title':'预测评价'}],'detached':[{'id':'e','title':'公众参与'}]}}},{'id':'sheet2','title':'环境管理','rootTopic':{'id':'root2','title':'管理措施','children':{'attached':[{'id':'f','title':'监测计划'}]}}}],ensure_ascii=False))
def legacy():
 return archive('content.xml','''<?xml version="1.0"?><xmap-content xmlns="urn:xmind:xmap:xmlns:content:2.0" version="2.0"><sheet id="s"><title>旧版画布</title><topic id="r"><title>生态环境</title><children><topics type="attached"><topic id="a"><title>水环境</title><children><topics type="attached"><topic id="b"><title>水质监测</title></topic></topics></children></topic></topics><topics type="detached"><topic id="c"><title>补充主题</title></topic></topics></children></topic></sheet></xmap-content>''')
class XMind(unittest.TestCase):
 def test_modern_sheets_and_detached(self):
  text,sheets,count,_=read_xmind(modern());self.assertEqual(sheets,2);self.assertEqual(count,10);self.assertIn('      现场调查\n        水环境调查',text);self.assertIn('    公众参与',text);self.assertIn('环境管理\n  管理措施',text)
 def test_legacy_xml(self):
  text,sheets,count,_=read_xmind(legacy());self.assertEqual((sheets,count),(1,4));self.assertEqual(text,'生态环境\n  水环境\n    水质监测\n  补充主题')
 def test_saved_canvas_bytes_without_relayout(self):
  from PIL import Image
  png=io.BytesIO();Image.new('RGBA',(800,400),(10,180,30,140)).save(png,format='PNG');raw=png.getvalue();out=io.BytesIO()
  with zipfile.ZipFile(out,'w') as z:
   z.writestr('Thumbnails/thumbnail.png',raw);z.writestr('content.json','This is intentionally not parsed')
  self.assertEqual(read_canvas(out.getvalue()),raw)
  self.assertIsNone(read_canvas(modern()));self.assertIsNone(read_canvas(legacy()))
 def test_invalid_not_silent(self):
  for data in [archive('content.json','[]'),archive('other.txt','hello'),archive('content.xml','<!DOCTYPE a [<!ENTITY x "bad">]><xmap-content/>')]:
   with self.assertRaises(ValueError):read_xmind(data)
 def test_limits_not_silent_truncation(self):
  data=archive('content.json',json.dumps([{'rootTopic':{'title':'root','children':{'attached':[{'title':str(i)} for i in range(500)]}}}]))
  with self.assertRaises(ValueError):read_xmind(data)
if __name__=='__main__':unittest.main()
