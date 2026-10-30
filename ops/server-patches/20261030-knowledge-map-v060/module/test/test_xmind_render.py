import unittest,sys,io,zipfile,tempfile,xml.etree.ElementTree as ET
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from scripts.xmind_render import parse,render,describe
from scripts.pdf_export import export_pdf
from test_xmind import modern,legacy
class Rendering(unittest.TestCase):
 def test_xml_styles_and_complete_labels(self):
  out=io.BytesIO()
  with zipfile.ZipFile(out,'w') as z:
   z.writestr('content.xml','<xmap-content><sheet><title>课程</title><topic id="root" style-id="style" structure-class="org.xmind.ui.map.unbalanced"><title>完整主题不截断</title><children><topics type="attached"><topic id="child"><title>长标题包含全部课程知识点应当换行而不是省略或被截断</title></topic></topics></children></topic></sheet></xmap-content>')
   z.writestr('styles.xml','<xmap-styles xmlns:svg="http://www.w3.org/2000/svg" xmlns:fo="http://www.w3.org/1999/XSL/Format"><styles><style id="style"><topic-properties svg:fill="#123456" fo:color="#fedcba" fo:font-size="22pt" fo:font-weight="bold"/></style></styles></xmap-styles>')
  raw=out.getvalue();svg=render(raw);root=ET.fromstring(svg)
  self.assertEqual(len(root.findall('.//{http://www.w3.org/2000/svg}g')),2);self.assertIn(b'#123456',svg);self.assertIn(b'#fedcba',svg)
  text=''.join(x.text or '' for x in root.iter() if x.tag.endswith('tspan'));self.assertIn('长标题包含全部课程知识点应当换行而不是省略或被截断',text)
 def test_multiple_sheets_branches_pdf(self):
  import pymupdf
  raw=modern();meta=describe(raw);self.assertEqual(len(meta['sheets']),2);self.assertEqual(meta['topics'],8)
  svg=render(raw,0,0);self.assertIn('水环境调查',svg.decode());self.assertNotIn('预测评价',svg.decode())
  with tempfile.TemporaryDirectory() as temp:
   source=Path(temp)/'input.xmind';target=Path(temp)/'output.pdf';source.write_bytes(raw);export_pdf(source,target)
   with pymupdf.open(target) as doc:
    self.assertEqual(len(doc),2);self.assertIn('监测计划',doc[1].get_text());self.assertTrue(doc[0].get_drawings());self.assertEqual(doc[0].get_images(),[])
 def test_legacy_and_invalid(self):
  self.assertEqual(describe(legacy())['topics'],4);self.assertIn('补充主题',render(legacy()).decode())
  for args in [(-1,-1),(0,999),(999,-1)]:
   with self.assertRaises(ValueError):render(legacy(),*args)
if __name__=='__main__':unittest.main()
