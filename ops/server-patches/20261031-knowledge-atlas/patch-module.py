from pathlib import Path
root=Path('work/km-neural-preview');before=root/'module-before';patch=root/'module-patch'
s=(before/'server.py').read_text(encoding='utf-8');s=s.replace("['/','/app.js','/style.css']", "['/','/app.js','/style.css','/atlas.bundle.js','/atlas.css']");s=s.replace("/graph-pdf|/page/[0-9]+", "/graph-pdf|/graph|/page/[0-9]+")
anchor="  if self.command=='GET' and match[2]=='/editable':";assert s.count(anchor)==1;s=s.replace(anchor,"""  if self.command=='GET' and match[2]=='/graph':
   with lock:
    m=get(match[1])
    if not can_read(m,user,classes):raise Error(404,'图谱不存在或尚未发布')
    from scripts.graph_data import graph_for
    try:graph=graph_for(m,DATA)
    except ValueError as e:raise Error(422,str(e))
    return self.send(200,graph)
"""+anchor)
(patch/'server.py').write_text(s,encoding='utf-8',newline='\n')
s=(before/'index.html').read_text(encoding='utf-8');s=s.replace('<link rel="stylesheet" href="style.css">','<link rel="stylesheet" href="style.css"><link rel="stylesheet" href="atlas.css?v=source-atlas1">');s=s.replace('<div class="canvas">','<div id="atlasHost" hidden></div><div class="canvas">');s=s.replace('<script src="app.js?v=060-integration"></script>', '<script type="module" src="app.js?v=source-atlas1"></script>');assert 'type="module" src="app.js?v=source-atlas1"' in s;(patch/'public/index.html').write_text(s,encoding='utf-8',newline='\n')
s=(before/'app.js').read_text(encoding='utf-8');s="import {createAtlas} from './atlas.bundle.js?v=source-atlas1';\n"+s
s=s.replace("const embedded=", "let atlas=null,atlasOutlineSignature='';const embedded=",1)
s=s.replace("async function open(id){selected=", "async function open(id){atlas?.destroy();atlas=null;atlasOutlineSignature='';$('atlasHost').hidden=true;selected=",1)
a="if(isGraph){if(selected.ext==='.xmind')for(const n of nodes())if(n.depth>=2&&n.children.length)collapsed.add(n.id);draw()}else await showPreview($('inlinePreview'),false);";assert s.count(a)==1
s=s.replace(a,"if(selected.ext==='.xmind'||selected.graphEdited||isGraph){await mountAtlas()}else await showPreview($('inlinePreview'),false);")
s=s.replace("function draw(){const all=", "function draw(){if(atlas){if(editing){const signature=$('outline').value;if(signature!==atlasOutlineSignature){atlas.setData(editorGraph());atlasOutlineSignature=signature}atlas.focusNode('edit:'+activeNode,{notify:false})}return}const all=",1)
s=s.replace("$('close').onclick=()=>{$('viewer').hidden=true};", "$('close').onclick=()=>{atlas?.destroy();atlas=null;$('atlasHost').hidden=true;$('viewer').hidden=true};")
a="editing=true;originalView=false;undo=[];";assert s.count(a)==1;s=s.replace(a,a+"if(atlas){atlas.setMode('2d');atlasOutlineSignature=''}")
s=s.replace("document.querySelector('.canvas').hidden=false;$('inlinePreview').hidden=true;$('mapNote').textContent='编辑节点", "document.querySelector('.canvas').hidden=!!atlas;if(atlas)$('graphTools').hidden=true;$('inlinePreview').hidden=true;$('mapNote').textContent='编辑节点",1)
anchor='function selectNode(id){';assert s.count(anchor)==1
helper="""function editorGraph(){const list=nodes(),result=list.map(n=>({id:'edit:'+n.id,label:n.label,parentId:n.parent?'edit:'+n.parent.id:null,depth:n.depth,groupId:'edit:'+(n.depth===0?n.id:(()=>{let p=n;while(p.parent&&p.depth>1)p=p.parent;return p.id})()),sheet:0,children:n.children.map(c=>'edit:'+c.id),outlineIndex:n.id,note:''}));return {id:selected.id,title:selected.title,version:selected.version,sourceSha256:selected.sha256,edited:true,topicCount:result.length,nodes:result,links:result.filter(n=>n.parentId).map(n=>({source:n.parentId,target:n.id,kind:'hierarchy'})),sheets:result.filter(n=>!n.parentId).map((n,i)=>({id:i,title:n.label,rootId:n.id}))}}
async function mountAtlas(){const host=$('atlasHost');host.hidden=false;host.textContent='正在读取源文件结构…';$('inlinePreview').hidden=true;$('graphTools').hidden=true;document.querySelector('.canvas').hidden=true;$('outlineEditor').hidden=true;$('showOriginal').hidden=true;$('original').textContent='查看原稿';const graph=await api('maps/'+selected.id+'/graph');host.textContent='';atlas=createAtlas(host,graph,{onSelect:n=>{if(editing&&Number.isInteger(n.outlineIndex)){activeNode=n.outlineIndex;$('nodeLabel').value=n.label;$('nodeCount').textContent=nodes().length+' 个节点'}}});$('mapNote').textContent=graph.edited?'教师编辑版 · 可切换结构导图与3D网络，原文件保留。':'已读取源文件完整主题与层级，可按章节探索或切换3D网络。'}
"""
s=s.replace(anchor,helper+anchor);(patch/'public/app.js').write_text(s,encoding='utf-8',newline='\n')
s=(before/'style.css').read_text(encoding='utf-8');s+='\nhtml,body{overflow-x:clip}#atlasHost{margin:16px 0;width:100%;min-width:0}#atlasHost:not([hidden])~.canvas{display:none}#atlasHost .ka-body{height:min(76vh,800px);min-height:600px}.km-embedded #viewer:has(#atlasHost:not([hidden])){padding:16px;border-radius:16px}.km-embedded #atlasHost .ka-body{height:calc(100dvh - 240px);min-height:540px}#nodeEditor button{white-space:nowrap}@media(max-width:767px){#atlasHost .ka-body,.km-embedded #atlasHost .ka-body{height:540px;min-height:0}.km-embedded #viewer:has(#atlasHost:not([hidden])){padding:0;border:0;background:transparent}#viewer .sectionhead{align-items:flex-start}#viewer .sectionhead button{white-space:nowrap}#atlasHost .ka:fullscreen .ka-body{height:calc(100dvh - 151px)}}\n';(patch/'public/style.css').write_text(s,encoding='utf-8',newline='\n')
for name in ['atlas.bundle.js','atlas.css']:(patch/'public'/name).write_bytes((root/name).read_bytes())
(patch/'scripts/graph_data.py').write_bytes((root/'graph_data.py').read_bytes())

s=(patch/'public/index.html').read_text(encoding='utf-8').replace('主要支持 SVG 矢量图和 XMind 思维导图：上传后直接浏览；XMind没有预览也能读取主题与样式显示，核对后发布给学生。也可上传图片、PDF、Word 和 PPT。','上传 XMind 后按源文件主题生成交互图谱，可切换结构导图和 3D 网络；编辑核对后按班级发布。也支持 SVG、图片、PDF、Word 和 PPT。').replace('XMind优先显示自带预览；没有预览时按文件中的主题与样式生成矢量画布，可切换章节，不调用AI。SVG直接显示矢量原图。','XMind读取原有主题与关系，不调用AI补写知识；原稿保留，可随时查看与下载。SVG显示矢量原图。').replace('其他文件自动生成交互图谱（SVG/XMind显示原稿）','其他文件提取层级草稿（需教师核对）');(patch/'public/index.html').write_text(s,encoding='utf-8')
