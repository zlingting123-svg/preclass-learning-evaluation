from pathlib import Path
import json,urllib.request,urllib.error,urllib.parse,io,zipfile,hashlib
root=Path('/home/ubuntu/km-atlas-stage');access=json.loads(Path('/var/lib/preclass/km-atlas-test-host/access.json').read_text());base='http://127.0.0.1:3218/api';tokens=access['tokens'];checks=[]
def call(path,role=None,body=None,method='GET'):
 headers={'Authorization':'Bearer '+tokens[role]} if role else {}
 if isinstance(body,dict):body=json.dumps(body).encode();headers['Content-Type']='application/json'
 try:
  with urllib.request.urlopen(urllib.request.Request(base+path,data=body,headers=headers,method=method),timeout=90) as r:return r.status,r.read()
 except urllib.error.HTTPError as e:return e.code,e.read()
def data(path,role='teacher',body=None,method='GET',status=200):
 code,raw=call(path,role,body,method);assert code==status,(path,code,raw[:300]);return json.loads(raw)
assert call('/maps')[0]==401;assert len(data('/me')['classes'])==31
source=io.BytesIO();title='原始知识点';sheets=[{'title':'模拟画布','rootTopic':{'title':'测试根节点','children':{'attached':[{'title':title},{'title':'另一分支'}]}}}]
with zipfile.ZipFile(source,'w',zipfile.ZIP_DEFLATED) as z:z.writestr('content.json',json.dumps(sheets,ensure_ascii=False))
raw=source.getvalue();params=urllib.parse.urlencode({'classId':access['classId'],'name':'editor.xmind','title':'隔离节点编辑测试','mode':'file'});m=data('/maps?'+params,body=raw,method='POST',status=201);path='/maps/'+m['id'];assert call(path,'student')[0]==404
assert len(data(path+'/graph')['nodes'])==3;assert call(path+'/graph','student')[0]==404
outline=data(path+'/editable')['outline'];assert title in outline;assert data(path)['version']==m['version'];assert call(path+'/file','teacher')[1]==raw
modified=outline.replace(title,'修改后的知识点')+'\n    新增子节点';payload={'title':m['title'],'outline':m['outline'],'editedOutline':modified,'state':'draft','version':m['version']};edited=data(path,body=payload,method='PUT');assert edited['graphEdited'] and edited['editedOutline']==modified;assert edited['outline']==m['outline'];assert call(path,'student')[0]==404;checks.append('提取XMind可编辑副本、修改节点/层级、草稿隔离，原件字节保持')
published=data(path,body={**payload,'version':edited['version'],'state':'published'},method='PUT');g=data(path+'/graph','student');assert g['edited'] and len(g['nodes'])==4;assert call(path+'/graph','outsider')[0]==404;student=data(path,'student');assert student['graphEdited'] and '修改后的知识点' in student['editedOutline'];assert call(path+'/file','student')[1]==raw
assert call(path+'/editable','student')[0]==403;assert call(path,'student',{**payload,'version':published['version']},'PUT')[0]==403;assert call(path,'outsider')[0]==404;assert call(path+'/graph-pdf','outsider')[0]==404;assert call(path,'otherTeacher',{**payload,'version':published['version']},'PUT')[0] in [403,404];assert call(path,'teacher',payload,'PUT')[0]==409;checks.append('发布后学生只读；跨班、其他教师、学生写入和旧版本覆盖被拒绝')
import pymupdf
code,pdf=call(path+'/graph-pdf','student');assert code==200,pdf[:200]
with pymupdf.open(stream=pdf,filetype='pdf') as doc:assert '修改后的知识点' in ''.join(page.get_text() for page in doc);assert not any(page.get_images() for page in doc)
code,original_pdf=call(path+'/pdf','student');assert code==200
with pymupdf.open(stream=original_pdf,filetype='pdf') as doc:assert title in ''.join(page.get_text() for page in doc)
checks.append('编辑版PDF包含新节点且为矢量；原稿PDF与原XMind保留')
for bad in ['root\n    跳级','\t制表符','\n'.join('n' for _ in range(2001))]:assert call(path,'teacher',{**payload,'version':published['version'],'editedOutline':bad},'PUT')[0]==400
withdrawn=data(path,body={**payload,'version':published['version'],'state':'draft'},method='PUT');assert call(path+'/graph-pdf','student')[0]==404
big=io.BytesIO();children=[{'title':'节点'+str(i)} for i in range(723)]
with zipfile.ZipFile(big,'w') as z:z.writestr('content.json',json.dumps([{'rootTopic':{'title':'大图','children':{'attached':children}}}],ensure_ascii=False))
b=data('/maps?'+params,body=big.getvalue(),method='POST',status=201);large=data('/maps/'+b['id']+'/editable');assert len(large['outline'].splitlines())==724;checks.append('723分支XMind完整提取；非法缩进/2001节点拒绝，撤回后学生不可读')
multi=io.BytesIO();sheets=[{'title':'画布'+str(i),'rootTopic':{'title':'根'+str(i),'children':{'attached':[{'title':'主题'+str(i)+'-'+str(j)} for j in range(65)]}}} for i in range(11)]
with zipfile.ZipFile(multi,'w') as z:z.writestr('content.json',json.dumps(sheets,ensure_ascii=False))
multi_map=data('/maps?'+params,body=multi.getvalue(),method='POST',status=201);multi_path='/maps/'+multi_map['id'];multi_outline=data(multi_path+'/editable')['outline'];assert len(multi_outline.splitlines())==737 and '主题10-64' in multi_outline
multi_map=data(multi_path,body={**multi_map,'editedOutline':multi_outline,'state':'published'},method='PUT');code,multi_pdf=call(multi_path+'/graph-pdf','student');assert code==200
with pymupdf.open(stream=multi_pdf,filetype='pdf') as doc:assert len(doc)==11 and '主题10-64' in ''.join(page.get_text() for page in doc)
checks.append('11画布737节点编辑版完整导出11页PDF，末尾主题未截断')
result={'passed':True,'checks':checks,'teacherClasses':31,'originalSha256':hashlib.sha256(raw).hexdigest(),'realModelCalls':0,'productionWritten':False};(root/'editor-api-verification.json').write_text(json.dumps(result,ensure_ascii=False,indent=2));print(json.dumps(result,ensure_ascii=True))
