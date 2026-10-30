from pathlib import Path
root=Path('work/km-v060/knowledge-map');p=root/'server.py';s=p.read_text(encoding='utf-8')
before=" return user,host('/classes',token)";after=""" classes=[];cursor=None;seen=set()
 from urllib.parse import urlencode
 for _ in range(1000):
  page=host('/classes'+('?' + urlencode({'cursor':cursor}) if cursor else ''),token)
  if isinstance(page,list):classes.extend(page);break
  if not isinstance(page,dict) or not isinstance(page.get('items'),list):raise Error(503,'主系统班级接口格式不兼容')
  classes.extend(page['items']);cursor=page.get('nextCursor')
  if not cursor:break
  if cursor in seen:raise Error(503,'主系统班级分页无效')
  seen.add(cursor)
 else:raise Error(503,'班级分页超过上限')
 return user,classes""";assert s.count(before)==1;s=s.replace(before,after)
s=s.replace("if k!='outline'", "if k not in ['outline','editedOutline']")
s=s.replace("(/file|/preview|/pdf|/page/[0-9]+)?", "(/file|/preview|/pdf|/editable|/graph-pdf|/page/[0-9]+)?")
anchor="  if self.command=='GET' and match[2]=='/pdf':";assert s.count(anchor)==1
s=s.replace(anchor,"""  if self.command=='GET' and match[2]=='/editable':
   m=get(match[1]);owned(m,user,classes)
   from scripts.editor import initial_outline
   try:outline=initial_outline(m,DATA)
   except ValueError as e:raise Error(422,str(e))
   return self.send(200,{'outline':outline,'version':m['version']})
  if self.command=='GET' and match[2]=='/graph-pdf':
   m=get(match[1])
   if not can_read(m,user,classes):raise Error(404,'图谱不存在或尚未发布')
   outline=m.get('editedOutline') or (m['outline'] if m.get('mode')=='graph' else '')
   if not outline:raise Error(400,'请先保存可编辑的图谱版本')
   from scripts.editor import export_pdf
   with lock:job=pdf_locks.setdefault(m['id'],threading.Lock())
   with job:
    cache=DATA/(m['id']+'.edited-v'+str(m['version'])+'.pdf')
    if not cache.exists():
     try:pdf=export_pdf(outline)
     except ValueError as e:raise Error(422,str(e))
     cache.write_bytes(pdf);os.chmod(cache,0o600)
    if not can_read(get(m['id']),user,classes):raise Error(404,'图谱不存在或尚未发布')
    return self.send(200,cache.read_bytes(),'application/pdf')
"""+anchor)
s=s.replace("owned(m,user,classes);b=json.loads(self.body(100000))", "owned(m,user,classes);b=json.loads(self.body(1000000))")
anchor="   m.update(outline=outline,title=title,state=state,version=m['version']+1);save(m);return self.send(200,m)";assert s.count(anchor)==1
s=s.replace(anchor,"""   if 'editedOutline' in b:
    from scripts.editor import validate
    try:validate(b['editedOutline'])
    except ValueError as e:raise Error(400,str(e))
    m.update(editedOutline=b['editedOutline'],graphEdited=True)
   else:m['outline']=outline
   m.update(title=title,state=state,version=m['version']+1);save(m);return self.send(200,m)""")
p.write_text(s,encoding='utf-8',newline='\n')
p=root/'public/index.html';s=p.read_text(encoding='utf-8').replace('◈ 学习空间','◈ 环境评价与管理').replace('登录学习空间','登录环境评价与管理').replace('连接知识，理解全貌','KNOWLEDGE MAP').replace('从一个概念出发，看见知识之间的联系。','按班级查看课程图谱、原稿和教师发布的编辑版。')
s=s.replace('<button id="downloadPdf">下载 PDF</button>','<button id="downloadPdf">下载 PDF</button><button id="downloadGraphPdf" hidden>下载编辑版 PDF</button><button id="editNodes" hidden>编辑节点</button><button id="showOriginal" hidden>查看原稿</button>')
s=s.replace('每行一个知识点，两个空格缩进一级；最多500个节点。保存会同步更新所有查看者看到的已发布内容。','可选择画布中的节点修改，也可直接编排层级。两个空格缩进一级，最多2000个节点。保存草稿后学生不可见，核对后再发布。原文件保留。')
s=s.replace('<textarea id="outline"', '<div id="nodeEditor" class="tools"><input id="nodeLabel" aria-label="知识点名称" placeholder="选择节点后修改名称"><button id="renameNode">修改节点</button><button id="addChild">添加子节点</button><button id="addSibling">添加同级节点</button><button id="deleteNode">删除节点</button><button id="promoteNode">升级</button><button id="demoteNode">降级</button><button id="undoNode">撤销</button><span id="nodeCount"></span></div><textarea id="outline"')
s=s.replace('<script src="app.js"></script>','<script src="app.js?v=060-integration"></script>')
p.write_text(s,encoding='utf-8',newline='\n')
