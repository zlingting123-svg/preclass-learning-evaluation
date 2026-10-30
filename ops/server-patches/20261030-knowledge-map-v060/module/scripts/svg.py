"""Validate a standalone, passive SVG while retaining its exact original bytes."""
import re,xml.etree.ElementTree as ET

def validate_svg(data):
 try:text=data.decode('utf-8-sig')
 except UnicodeDecodeError:raise ValueError('请使用UTF-8编码的SVG')
 if '<!DOCTYPE' in text.upper() or '<!ENTITY' in text.upper():raise ValueError('SVG请移除DOCTYPE或实体声明后重新导出')
 try:root=ET.fromstring(text)
 except ET.ParseError:raise ValueError('SVG文件格式无效')
 if root.tag not in ['svg','{http://www.w3.org/2000/svg}svg']:raise ValueError('文件不是SVG画布')
 count=0
 for el in root.iter():
  count+=1
  if count>100000:raise ValueError('SVG元素过多，请简化后上传')
  tag=el.tag.rsplit('}',1)[-1].lower()
  if tag in ['script','foreignobject','iframe','object','embed','animate','animatemotion','animatetransform','set']:raise ValueError('仅支持静态SVG画布，请移除脚本、动画或嵌入网页')
  for key,value in el.attrib.items():
   attr=key.rsplit('}',1)[-1].lower()
   if attr.startswith('on'):raise ValueError('SVG不可包含事件脚本')
   if attr in ['href','src']:
    val=value.strip().lower()
    if val and not (val.startswith('#') or re.match(r'^data:image/(png|jpeg|jpg|gif|webp);base64,',val)):
     raise ValueError('SVG请嵌入所需图片资源，不支持外部资源链接')
  css=' '.join(el.attrib.values())+' '+(el.text or '')
  if re.search(r'@import|javascript\s*:',css,re.I):raise ValueError('SVG不可引用外部样式或脚本')
  for value in re.findall(r'url\s*\((.*?)\)',css,re.I|re.S):
   val=value.strip().strip('\"\'')
   if not val.startswith('#') and not re.match(r'^data:image/(png|jpeg|jpg|gif|webp);base64,',val,re.I):raise ValueError('SVG请内嵌资源，不支持外部资源引用')
 return data
