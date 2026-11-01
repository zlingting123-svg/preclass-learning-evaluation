from pathlib import Path
import subprocess,base64,json,hashlib
r=Path(__file__).resolve().parent;out=Path('outputs/问卷自动导入与编辑器-2026-11-01');out.mkdir(exist_ok=True);a=Path('C:/Users/96496/Documents/Codex/2026-10-28/outputs-md/work/server-access');ssh=['ssh','-i',str(a/'preclass-deploy-ed25519'),'-o','UserKnownHostsFile='+str(a/'known_hosts'),'-o','StrictHostKeyChecking=yes','-o','BatchMode=yes','ubuntu@82.157.183.146']
files={'frontend/dist/assets/'+p.name:base64.b64encode(p.read_bytes()).decode() for p in (r/'dist/assets').iterdir()}
for p in (r/'backend').iterdir():files['backend/dist/backend/src/'+p.name]=base64.b64encode(p.read_bytes()).decode()
files['backend/scripts/extract-survey-docx.py']=base64.b64encode((r/'extract-docx.py').read_bytes()).decode()
hashes={name:hashlib.sha256((r/'before'/name).read_bytes()).hexdigest() for name in ['questionnaires.js','questionnaire-routes.js']};hashes['MAIN']=hashlib.sha256((r/'main.before.js').read_bytes()).hexdigest()
script='''from pathlib import Path
import os,json,base64,hashlib,subprocess
base=Path('/opt/preclass/current').resolve();assert base.name=='20261101-puzzle-b';target=Path('/opt/preclass/releases/20261101-survey-builder');root=Path('/home/ubuntu/survey-builder-stage');root.mkdir(exist_ok=True)
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
def manifest(p):return {str(f.relative_to(p)):('symlink:'+os.readlink(f) if f.is_symlink() else sha(f)) for f in p.rglob('*') if f.is_file() or f.is_symlink()}
for name,digest in HASHES.items():assert sha(base/('frontend/dist/assets/main-puzzle-b.js' if name=='MAIN' else 'backend/dist/backend/src/'+name))==digest,'Baseline changed'
before=manifest(base)
if not target.exists():subprocess.run(['cp','-a','--reflink=auto',str(base),str(target)],check=True)
else:
 old=json.loads((root/'stage.json').read_text());assert old['before']==before and manifest(target)==old['after'],'Candidate drift'
for name,data in FILES.items():
 p=target/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(base64.b64decode(data))
p=target/'frontend/dist/index.html';p.write_text((base/'frontend/dist/index.html').read_text().replace('main-entry-puzzle-b.js','main-entry-survey-builder.js'))
after=manifest(target);changed=[p for p in before if before[p]!=after.get(p)];assert set(changed)=={'frontend/dist/index.html','backend/dist/backend/src/questionnaires.js','backend/dist/backend/src/questionnaire-routes.js'};assert len(set(after)-set(before))==9
for name in FILES:
 if name.endswith('.js'):subprocess.run(['/opt/preclass/runtime/node/bin/node','--check',str(target/name)],check=True)
(root/'stage.json').write_text(json.dumps({'base':str(base),'target':str(target),'before':before,'after':after}));print(json.dumps({'staged':True,'changed':changed,'added':list(set(after)-set(before)),'unchanged':len(before)-len(changed)}))
'''.replace('FILES',repr(files)).replace('HASHES',repr(hashes))
p=subprocess.run(ssh+['sudo -n python3 -'],input=script.encode(),capture_output=True,timeout=50);print(p.stdout.decode());print(p.stderr.decode());assert p.returncode==0;(r/'stage-result.json').write_bytes(p.stdout)
