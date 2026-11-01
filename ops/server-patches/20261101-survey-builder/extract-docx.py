import sys,zipfile,io,json,xml.etree.ElementTree as ET,re
sys.stdout.reconfigure(encoding='utf-8')
NS={'w':'http://schemas.openxmlformats.org/wordprocessingml/2006/main'};W='{'+NS['w']+'}'
def val(node,key='val'):return node.get(W+key) if node is not None else None
def xml(z,name):
 b=z.read(name)
 if b'<!DOCTYPE' in b.upper() or b'<!ENTITY' in b.upper():raise ValueError('Word包含不支持的XML实体声明')
 return ET.fromstring(b)
try:
 raw=sys.stdin.buffer.read(1048577)
 if len(raw)>1048576:raise ValueError('Word文件不能超过1MB')
 with zipfile.ZipFile(io.BytesIO(raw)) as z:
  if len(z.infolist())>1000 or sum(f.file_size for f in z.infolist())>8*1024*1024:raise ValueError('Word解压内容过大，请拆分文件')
  doc=xml(z,'word/document.xml');abstracts={};nums={};styles={};counts={};warnings=[]
  if doc.find('.//w:ins',NS) is not None or doc.find('.//w:del',NS) is not None:raise ValueError('Word含修订内容，请先在Word中接受或拒绝修订后重新导入')
  if 'word/numbering.xml' in z.namelist():
   number=xml(z,'word/numbering.xml')
   for a in number.findall('w:abstractNum',NS):abstracts[val(a,'abstractNumId')]={val(l,'ilvl'):{'fmt':val(l.find('w:numFmt',NS)),'text':val(l.find('w:lvlText',NS)) or '%1.','start':int(val(l.find('w:start',NS)) or 1)} for l in a.findall('w:lvl',NS)}
   for n in number.findall('w:num',NS):nums[val(n,'numId')]={'abstract':val(n.find('w:abstractNumId',NS)),'starts':{val(l,'ilvl'):int(val(l.find('w:startOverride',NS)) or 1) for l in n.findall('w:lvlOverride',NS)}}
  if 'word/styles.xml' in z.namelist():
   for s in xml(z,'word/styles.xml').findall('w:style',NS):styles[val(s,'styleId')]=s
  def numbering(p):
   prop=p.find('w:pPr',NS);n=prop.find('w:numPr',NS) if prop is not None else None
   if n is not None:return val(n.find('w:numId',NS)),val(n.find('w:ilvl',NS)) or '0'
   style=val(prop.find('w:pStyle',NS)) if prop is not None else None
   for _ in range(12):
    s=styles.get(style)
    if s is None:break
    n=s.find('w:pPr/w:numPr',NS)
    if n is not None:return val(n.find('w:numId',NS)),val(n.find('w:ilvl',NS)) or '0'
    style=val(s.find('w:basedOn',NS))
   return None,'0'
  def paragraph(p):
   text=''
   for n in p.iter():
    if n.tag==W+'t':text+=n.text or ''
    elif n.tag==W+'tab':text+='\t'
    elif n.tag in [W+'br',W+'cr']:text+='\n'
   if not text.strip():return ''
   num,level=numbering(p)
   if num and num!='0' and not re.match(r'^\s*(?:\d+[.、）)]|[A-Z][.、）)]|[-•])',text):
    spec=nums.get(num)
    if not spec:raise ValueError('自动编号定义缺失，请修复Word编号后重试')
    lvl=abstracts.get(spec['abstract'],{}).get(level)
    if not lvl:raise ValueError('自动编号层级无法读取')
    key=(num,level);counts[key]=counts.get(key,spec['starts'].get(level,lvl['start'])-1)+1
    for k in list(counts):
     if k[0]==num and int(k[1])>int(level):counts.pop(k)
    if lvl['fmt']=='bullet' or int(level)>0:prefix='- '
    elif lvl['fmt'] in ['upperLetter','lowerLetter']:prefix=chr(65+(counts[key]-1)%26)+'. '
    elif lvl['fmt'] in ['decimal','decimalZero','chineseCounting','chineseCountingThousand']:prefix=str(counts[key])+'. '
    else:raise ValueError('不支持该Word自动编号格式，请改为数字或字母编号')
    text=prefix+text.strip()
   return text
  lines=[];body=doc.find('w:body',NS)
  for node in body:
   if node.tag==W+'p':
    t=paragraph(node)
    if t:lines.append(t)
   elif node.tag==W+'tbl':
    for row in node.findall('w:tr',NS):lines.append('\t'.join(' | '.join(paragraph(p) for p in cell.findall('w:p',NS)) for cell in row.findall('w:tc',NS)))
  text='\n'.join(lines)
  if not text.strip():raise ValueError('Word没有可识别文字，可能是扫描图片')
  if len(text)>300000:raise ValueError('识别文字过长，请拆分Word文件')
  print(json.dumps({'text':text,'warnings':warnings},ensure_ascii=False))
except Exception as e:
 print(json.dumps({'error':str(e) if isinstance(e,ValueError) else 'Word文件损坏、加密或格式不正确'},ensure_ascii=False));sys.exit(1)
