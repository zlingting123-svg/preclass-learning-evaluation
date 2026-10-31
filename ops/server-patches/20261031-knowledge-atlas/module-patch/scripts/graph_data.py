"""Read source structure into graph data without generating or inventing knowledge."""
import hashlib,json
from pathlib import Path

def graph_for(record,data):
 nodes=[];links=[];sheets=[];prefix=record['id']
 def add_tree(node,sheet,parent=None,depth=0,group=None):
  nid=prefix+':'+str(sheet)+':'+str(len(nodes));group=group or nid
  item={'id':nid,'label':node['title'],'parentId':parent,'depth':depth,'groupId':group,'sheet':sheet,'children':[],'note':str(node.get('note','') or '')}
  nodes.append(item)
  if parent:links.append({'source':parent,'target':nid,'kind':'hierarchy'})
  for child in node['children']:
   cid=add_tree(child,sheet,nid,depth+1,None if depth==0 else group);item['children'].append(cid)
  return nid
 if record.get('editedOutline') or record.get('mode')=='graph':
  from scripts.editor import validate
  outline=record.get('editedOutline') or record['outline'];roots=validate(outline);flat=0
  def convert(raw):return {'title':raw['title'],'children':[convert(child) for child in raw['children']['attached']]}
  for index,root in enumerate(roots):
   before=len(nodes);rid=add_tree(convert(root),index)
   for item in nodes[before:]:item['outlineIndex']=flat;flat+=1
   sheets.append({'id':index,'title':root['title'],'rootId':rid})
 elif record['ext']=='.xmind':
  from scripts.xmind_render import parse
  source=Path(data)/(record['id']+record['ext']);raw_sheets,count=parse(source.read_bytes())
  for index,sheet in enumerate(raw_sheets):
   old_to_new={};start=len(nodes)
   def walk(raw,parent=None,depth=0,group=None):
    nid=prefix+':'+str(index)+':'+str(len(nodes));group=group or nid
    item={'id':nid,'label':raw['title'],'parentId':parent,'depth':depth,'groupId':group,'sheet':index,'children':[],'note':str(raw.get('note','') or '')};nodes.append(item);old_to_new[raw['id']]=nid
    if parent:links.append({'source':parent,'target':nid,'kind':'hierarchy'})
    for child in raw['children']:item['children'].append(walk(child,nid,depth+1,None if depth==0 else group))
    return nid
   rid=walk(sheet['root']);sheets.append({'id':index,'title':sheet['title'],'rootId':rid})
   for relation in sheet.get('relations',[]):
    a=old_to_new.get(relation.get('end1Id'));b=old_to_new.get(relation.get('end2Id'))
    if a and b:links.append({'source':a,'target':b,'kind':'association','label':str(relation.get('title') or '')})
 else:raise ValueError('此文件没有可直接读取的图谱结构，请先编排编辑版')
 return {'id':record['id'],'title':record['title'],'version':record['version'],'sourceSha256':record['sha256'],'nodes':nodes,'links':links,'sheets':sheets,'topicCount':len(nodes),'edited':bool(record.get('editedOutline')),'basis':'source_structure'}
