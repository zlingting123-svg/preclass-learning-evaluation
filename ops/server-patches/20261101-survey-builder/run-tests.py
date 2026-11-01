from pathlib import Path
import subprocess,json,io,zipfile,base64
r=Path(__file__).resolve().parent;a=Path('C:/Users/96496/Documents/Codex/2026-10-28/outputs-md/work/server-access');ssh=['ssh','-i',str(a/'preclass-deploy-ed25519'),'-o','UserKnownHostsFile='+str(a/'known_hosts'),'-o','StrictHostKeyChecking=yes','-o','BatchMode=yes','ubuntu@82.157.183.146']
ns='http://schemas.openxmlformats.org/wordprocessingml/2006/main'
def docx(body,numbering=None):
 b=io.BytesIO()
 with zipfile.ZipFile(b,'w') as z:
  z.writestr('word/document.xml',f'<w:document xmlns:w="{ns}"><w:body>{body}</w:body></w:document>')
  if numbering:z.writestr('word/numbering.xml',numbering)
 return base64.b64encode(b.getvalue()).decode()
def p(t,n=None):return '<w:p>'+('' if n is None else f'<w:pPr><w:numPr><w:numId w:val="{n}"/></w:numPr></w:pPr>')+f'<w:r><w:t>{t}</w:t></w:r></w:p>'
numbering=f'<w:numbering xmlns:w="{ns}"><w:abstractNum w:abstractNumId="0"><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="decimal"/></w:lvl></w:abstractNum><w:abstractNum w:abstractNumId="1"><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="upperLetter"/></w:lvl></w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num><w:num w:numId="2"><w:abstractNumId w:val="1"/></w:num></w:numbering>'
original=next(Path('work/source-integration/repo/docs').rglob('课前学生画像问题清单.docx'));fixtures={'original':base64.b64encode(original.read_bytes()).decode(),'numbered':docx(p('选择（单选）',1)+p('甲',2)+p('乙',2)+p('请说明（填空题）',1),numbering),'table':docx('<w:tbl>'+''.join('<w:tr>'+''.join('<w:tc>'+''.join(p(t) for t in cell)+'</w:tc>' for cell in row)+'</w:tr>' for row in [[['题目'],['题型'],['选项']],[['请选择'],['多选'],['甲','乙']]])+'</w:tbl>'),'revisions':docx('<w:ins>'+p('1. 修订（填空题）')+'</w:ins>')}
script="from pathlib import Path;import base64;Path('/home/ubuntu/survey-builder-stage/fixtures.json').write_bytes(base64.b64decode("+repr(base64.b64encode(json.dumps(fixtures).encode()).decode())+"))"
p0=subprocess.run(ssh+['sudo -n python3 -'],input=script.encode(),capture_output=True);assert p0.returncode==0,p0.stderr.decode();p1=subprocess.run(ssh+['/opt/preclass/runtime/node/bin/node --input-type=module'],input=(r/'backend-test.mjs').read_bytes(),capture_output=True,timeout=45);print(p1.stdout.decode());print(p1.stderr.decode());assert p1.returncode==0;Path('outputs/问卷自动导入与编辑器-2026-11-01/服务端验证.json').write_bytes(p1.stdout)

