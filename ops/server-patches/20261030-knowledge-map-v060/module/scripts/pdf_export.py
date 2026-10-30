"""Generate PDF locally; preserve vector paths for SVG, raster originals stay raster."""
import io,os,sys,html,tempfile
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import pymupdf
from PIL import Image,ImageSequence
from scripts.svg import validate_svg
Image.MAX_IMAGE_PIXELS=40000000

def image_pdf(raw,all_pages=False):
 output=pymupdf.open()
 with Image.open(io.BytesIO(raw)) as source:
  frames=ImageSequence.Iterator(source) if all_pages else [source]
  for i,frame in enumerate(frames):
   if i>=500:raise ValueError('PDF最多支持500页，请拆分文件')
   rgba=frame.convert('RGBA');bg=Image.new('RGBA',rgba.size,'white');bg.alpha_composite(rgba);rgb=bg.convert('RGB');stream=io.BytesIO();rgb.save(stream,format='PNG')
   width,height=rgb.size;factor=min(.75,14400/max(width,height));page=output.new_page(width=width*factor,height=height*factor);page.insert_image(page.rect,stream=stream.getvalue())
 data=output.tobytes(garbage=4,deflate=True);output.close();return data

def export_pdf(source,target,office_preview=None):
 source=Path(source);ext=source.suffix.lower();raw=source.read_bytes()
 if ext=='.pdf':result=raw
 elif ext=='.svg':
  validate_svg(raw)
  with pymupdf.open(stream=raw,filetype='svg') as doc:result=doc.convert_to_pdf()
 elif ext=='.xmind':
  from scripts.xmind import read_canvas
  canvas=read_canvas(raw)
  if canvas:result=image_pdf(canvas)
  else:
   from scripts.xmind_render import parse,render
   sheets,_=parse(raw);combined=pymupdf.open()
   for index in range(len(sheets)):
    with pymupdf.open(stream=render(raw,index),filetype='svg') as svgdoc:pagepdf=svgdoc.convert_to_pdf()
    with pymupdf.open(stream=pagepdf,filetype='pdf') as part:combined.insert_pdf(part)
   result=combined.tobytes(garbage=4,deflate=True);combined.close()
 elif ext in ['.doc','.docx','.ppt','.pptx']:
  preview=Path(office_preview) if office_preview else None
  if preview and preview.exists():result=preview.read_bytes()
  else:
   from scripts.preview import convert
   with tempfile.TemporaryDirectory() as temp:
    preview=Path(temp)/'office.pdf';convert(source,preview);result=preview.read_bytes()
 elif ext in ['.png','.jpg','.jpeg','.webp','.gif','.bmp','.tif','.tiff']:
  result=image_pdf(raw,ext in ['.tif','.tiff'])
 elif ext in ['.txt','.md','.json']:
  text=raw.decode('utf-8-sig')
  if len(text)>600000:raise ValueError('文本超过PDF导出上限，请拆分后导出（原文件仍可下载）')
  text=text.replace('\t','    ');story=pymupdf.Story(html='<html><body><div style="white-space:pre-wrap;font-size:11pt;line-height:1.5">'+html.escape(text)+'</div></body></html>');buffer=io.BytesIO();writer=pymupdf.DocumentWriter(buffer);rect=pymupdf.paper_rect('a4');area=rect+(40,40,-40,-40)
  for _ in range(500):
   device=writer.begin_page(rect);more,_=story.place(area);story.draw(device);writer.end_page()
   if not more:break
  else:raise ValueError('PDF超过500页，请拆分文件')
  writer.close();result=buffer.getvalue()
 else:raise ValueError('此文件格式暂不支持PDF导出')
 with pymupdf.open(stream=result,filetype='pdf') as doc:
  if not len(doc) or doc.is_encrypted:raise ValueError('PDF文件无法读取或已加密')
 Path(target).write_bytes(result);os.chmod(target,0o600)
if __name__=='__main__':
 try:export_pdf(sys.argv[1],sys.argv[2],sys.argv[3] if len(sys.argv)>3 else None)
 except Exception as e:print(str(e),file=sys.stderr);sys.exit(1)
