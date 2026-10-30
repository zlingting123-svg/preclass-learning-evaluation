"""Local editable hierarchy derived from originals; never writes the original upload."""
import io,json,zipfile,re
from pathlib import Path

def validate(outline):
 if not isinstance(outline,str) or not outline.strip() or len(outline)>200000:raise ValueError('图谱内容为空或超过20万字')
 lines=[line for line in outline.splitlines() if line.strip()]
 if len(lines)>2000:raise ValueError('编辑版最多支持2000个节点')
 roots=[];stack=[];previous=0
 for index,line in enumerate(lines):
  if '\t' in line or '\x00' in line:raise ValueError('请使用两个空格缩进一级，不使用制表符')
  spaces=len(line)-len(line.lstrip(' '));depth=spaces//2;title=line.strip()
  if spaces%2 or depth>40 or (index==0 and depth) or depth>previous+1:raise ValueError('层级无效：每级两个空格，最多40级，不能跳级')
  if len(title)>10000:raise ValueError('单节点文字超过1万字')
  node={'title':title,'children':{'attached':[]}}
  while len(stack)>depth:stack.pop()
  if stack:stack[-1]['children']['attached'].append(node)
  else:roots.append(node)
  stack.append(node);previous=depth
 return roots

def initial_outline(record,data):
 if record.get('editedOutline'):return record['editedOutline']
 if record.get('mode')=='graph':return record['outline']
 if record['ext'] in ['.json','.txt','.md']:
  text=(Path(data)/(record['id']+record['ext'])).read_text(encoding='utf-8-sig')
  if record['ext']=='.json':
   obj=json.loads(text);text=obj.get('outline','') if isinstance(obj,dict) else ''
  if text.strip():validate(text);return text
 if record['ext']=='.xmind':
  from scripts.xmind_render import parse
  sheets,_=parse((Path(data)/(record['id']+record['ext'])).read_bytes());lines=[]
  def walk(node,depth):
   lines.append('  '*depth+' '.join(node['title'].split()))
   for child in node['children']:walk(child,depth+1)
  for sheet in sheets:
   if len(sheets)>1:lines.append(' '.join(sheet['title'].split()))
   walk(sheet['root'],1 if len(sheets)>1 else 0)
  outline='\n'.join(lines);validate(outline);return outline
 return record['title']

def export_pdf(outline):
 import pymupdf
 from scripts.xmind_render import render
 roots=validate(outline)
 if len(roots)>100:raise ValueError('编辑版PDF最多100个根节点，请按章节拆分')
 buffer=io.BytesIO()
 with zipfile.ZipFile(buffer,'w',zipfile.ZIP_DEFLATED) as archive:archive.writestr('content.json',json.dumps([{'title':root['title'],'rootTopic':root} for root in roots],ensure_ascii=False))
 output=pymupdf.open()
 for index in range(len(roots)):
  svg=render(buffer.getvalue(),index)
  with pymupdf.open(stream=svg,filetype='svg') as drawing:
   with pymupdf.open(stream=drawing.convert_to_pdf(),filetype='pdf') as part:output.insert_pdf(part)
 result=output.tobytes(garbage=4,deflate=True);output.close();return result
