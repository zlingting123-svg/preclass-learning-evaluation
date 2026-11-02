from pathlib import Path
import subprocess,json,base64,hashlib
r=Path(__file__).resolve().parent;out=Path('outputs/分组转让与连续浏览-2026-11-02')
for name in ['隔离验证.json','后台隔离验证.json']:assert json.loads((out/name).read_text(encoding='utf-8'))['passed']
a=Path('C:/Users/96496/Documents/Codex/2026-10-28/outputs-md/work/server-access')
ssh=['ssh','-i',str(a/'preclass-deploy-ed25519'),'-o','UserKnownHostsFile='+str(a/'known_hosts'),'-o','StrictHostKeyChecking=yes','-o','BatchMode=yes','ubuntu@82.157.183.146']
files={p.name:base64.b64encode(p.read_bytes()).decode() for p in (r/'dist/assets').iterdir()}
backend={name:{'before':hashlib.sha256((r/name.replace('.js','.before.js')).read_bytes()).hexdigest(),'after':base64.b64encode((r/name.replace('.js','.after.js')).read_bytes()).decode()} for name in ['groups.js','group-board.js','courseware.js']}
newbackend={n:base64.b64encode((r/n).read_bytes()).decode() for n in ['group-transfer.js','courseware-reader.js']}
baseline=json.loads((r/'baseline.json').read_text());baseline['panelHash']=hashlib.sha256(Path('work/group-display/dist/assets/groups-display-panel.js').read_bytes()).hexdigest();baseline['coursewareHash']=hashlib.sha256((r/'courseware-ui-crest-20261102.js').read_bytes()).hexdigest()
script='''from pathlib import Path
import os,json,hashlib,base64,subprocess,urllib.request,time
base=Path('/opt/preclass/current').resolve();assert base.name=='20261102-group-display';target=Path('/opt/preclass/releases/20261102-group-reader');assert not target.exists()
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
def manifest(p):return {str(f.relative_to(p)):('symlink:'+os.readlink(f) if f.is_symlink() else sha(f)) for f in p.rglob('*') if f.is_file() or f.is_symlink()}
assert sha(base/'frontend/dist/index.html')==BASELINE['indexHash'];assert sha(base/'frontend/dist/assets'/BASELINE['mainName'])==BASELINE['mainHash'];assert sha(base/'frontend/dist/assets/groups-display-panel.js')==BASELINE['panelHash'];assert sha(base/'frontend/dist/assets/courseware-ui-crest-20261102.js')==BASELINE['coursewareHash']
for name,item in BACKEND.items():assert sha(base/'backend/dist/backend/src'/name)==item['before']
before=manifest(base);subprocess.run(['cp','-a','--reflink=auto',str(base),str(target)],check=True)
for name,data in FILES.items():(target/'frontend/dist/assets'/name).write_bytes(base64.b64decode(data))
for name,item in BACKEND.items():(target/'backend/dist/backend/src'/name).write_bytes(base64.b64decode(item['after']))
for name,data in NEWBACKEND.items():(target/'backend/dist/backend/src'/name).write_bytes(base64.b64decode(data))
p=target/'frontend/dist/index.html';s=p.read_text();assert BASELINE['entryName'] in s;p.write_text(s.replace(BASELINE['entryName'],'/assets/main-entry-group-reader.js'))
after=manifest(target);assert {p for p in before if before[p]!=after.get(p)}=={'frontend/dist/index.html','backend/dist/backend/src/groups.js','backend/dist/backend/src/group-board.js','backend/dist/backend/src/courseware.js'};assert set(after)-set(before)=={'frontend/dist/assets/'+n for n in FILES}|{'backend/dist/backend/src/'+n for n in NEWBACKEND}
for name in FILES:
 if name.endswith('.js'):subprocess.run(['/opt/preclass/runtime/node/bin/node','--check',str(target/'frontend/dist/assets'/name)],check=True)
for name in list(BACKEND)+list(NEWBACKEND):subprocess.run(['/opt/preclass/runtime/node/bin/node','--check',str(target/'backend/dist/backend/src'/name)],check=True)
assert Path('/opt/preclass/current').resolve()==base and manifest(base)==before
n=Path('/opt/preclass/.group-reader-next');assert not n.exists();n.symlink_to(target);os.replace(n,'/opt/preclass/current')
try:
 subprocess.run(['systemctl','restart','preclass-test.service'],check=True,timeout=30)
 for i in range(30):
  try:
   with urllib.request.urlopen('http://127.0.0.1:5173/api/v1/health',timeout=3) as resp:assert json.load(resp)['ok']
   break
  except Exception:
   if i==29:raise
   time.sleep(.5)
 for rel in ['index.html']+['assets/'+n for n in FILES]:
  with urllib.request.urlopen('http://127.0.0.1:5173/'+('' if rel=='index.html' else rel),timeout=8) as resp:assert hashlib.sha256(resp.read()).hexdigest()==sha(target/'frontend/dist'/rel)
 assert subprocess.run(['systemctl','is-active','--quiet','preclass-test.service']).returncode==0
except Exception:
 n.symlink_to(base);os.replace(n,'/opt/preclass/current');subprocess.run(['systemctl','restart','preclass-test.service'],check=True,timeout=30);raise
print(json.dumps({'deployed':True,'current':str(target),'previous':str(base),'backendChanged':True,'databaseChanged':False,'serviceRestarted':True,'changedExistingFiles':4,'newFiles':9,'httpHashesVerified':True,'health':True}))
'''.replace('NEWBACKEND',repr(newbackend)).replace('BASELINE',repr(baseline)).replace('BACKEND',repr(backend)).replace('FILES',repr(files))
proc=subprocess.run(ssh+['sudo','-n','python3','-'],input=script.encode(),capture_output=True,timeout=90);print(proc.stdout.decode());print(proc.stderr.decode());assert proc.returncode==0;(out/'部署验证.json').write_bytes(proc.stdout)
