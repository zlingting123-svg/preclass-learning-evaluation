import unittest,os,tempfile,importlib.util,io,zipfile,json
from pathlib import Path
class Extract(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.temp=tempfile.TemporaryDirectory();os.environ['KM_DATA']=cls.temp.name
  path=Path(__file__).resolve().parents[1]/'server.py';spec=importlib.util.spec_from_file_location('module_server',path);cls.m=importlib.util.module_from_spec(spec);spec.loader.exec_module(cls.m)
 @classmethod
 def tearDownClass(cls):cls.temp.cleanup()
 def test_pdf(self):
  import pymupdf
  doc=pymupdf.open();p=doc.new_page();p.insert_text((40,60),'Ecology\nWater Quality');b=doc.tobytes();doc.close();outline,note=self.m.extract('lesson.pdf',b);self.assertIn('Water Quality',outline)
 def test_docx_xmind(self):
  def archive(name,b):
   out=io.BytesIO()
   with zipfile.ZipFile(out,'w') as z:z.writestr(name,b)
   return out.getvalue()
  doc=archive('word/document.xml','<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>环境知识</w:t></w:r></w:p></w:body></w:document>');self.assertIn('环境知识',self.m.extract('a.docx',doc)[0])
  mind=archive('content.json',json.dumps([{'rootTopic':{'title':'生态','children':{'attached':[{'title':'水环境'}]}}}],ensure_ascii=False));outline,_=self.m.extract('a.xmind',mind);self.assertIn('  水环境',outline)
if __name__=='__main__':unittest.main()
