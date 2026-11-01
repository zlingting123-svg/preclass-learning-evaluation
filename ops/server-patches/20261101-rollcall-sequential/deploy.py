from pathlib import Path
import subprocess,json,base64,hashlib
r=Path(__file__).resolve().parent;out=Path('outputs/逐个点名与右侧名单-2026-11-01');assert json.loads((out/'浏览器验证.json').read_text(encoding='utf-8'))['passed'];a=Path('C:/Users/96496/Documents/Codex/2026-10-28/outputs-md/work/server-access');ssh=['ssh','-i',str(a/'preclass-deploy-ed25519'),'-o','UserKnownHostsFile='+str(a/'known_hosts'),'-o','StrictHostKeyChecking=yes','-o','BatchMode=yes','ubuntu@82.157.183.146'];files={p.name:base64.b64encode(p.read_bytes()).decode() for p in (r/'dist/assets').iterdir()};baseline=json.loads((r/'baseline.json').read_text());baseline['indexHash']=hashlib.sha256((r/'index.before.html').read_bytes()).hexdigest()
script='''from pathlib import Path
import os,json,hashlib,base64,subprocess,urllib.request
base=Path('/opt/preclass/current').resolve();assert base.name=='20261101-survey-builder';target=Path('/opt/preclass/releases/20261101-rollcall-sequential');assert not target.exists();sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
def manifest(p):return {str(f.relative_to(p)):('symlink:'+os.readlink(f) if f.is_symlink() else sha(f)) for f in p.rglob('*') if f.is_file() or f.is_symlink()}
assert sha(base/'frontend/dist/index.html')==BASELINE['indexHash'];assert sha(base/'frontend/dist/assets'/BASELINE['mainName'])==BASELINE['mainHash'];assert sha(base/'frontend/dist/assets/attendance-puzzle-b.js')==BASELINE['attendanceHash'];before=manifest(base);subprocess.run(['cp','-a','--reflink=auto',str(base),str(target)],check=True)
for name,data in FILES.items():(target/'frontend/dist/assets'/name).write_bytes(base64.b64decode(data))
p=target/'frontend/dist/index.html';s=p.read_text();assert BASELINE['entryName'] in s;p.write_text(s.replace(BASELINE['entryName'],'/assets/main-entry-rollcall-sequential.js'));after=manifest(target);assert [p for p in before if before[p]!=after.get(p)]==['frontend/dist/index.html'];assert len(set(after)-set(before))==4
for name in FILES:
 if name.endswith('.js'):subprocess.run(['/opt/preclass/runtime/node/bin/node','--check',str(target/'frontend/dist/assets'/name)],check=True)
assert Path('/opt/preclass/current').resolve()==base and manifest(base)==before;n=Path('/opt/preclass/.rollcall-sequential-next');assert not n.exists();n.symlink_to(target);os.replace(n,'/opt/preclass/current')
try:
 for rel in ['index.html','assets/main-entry-rollcall-sequential.js','assets/main-rollcall-sequential.js','assets/attendance-sequential.js','assets/attendance-sequential.css','assets/survey-builder.js','assets/attendance-puzzle-b.js']:
  with urllib.request.urlopen('http://127.0.0.1:5173/'+('' if rel=='index.html' else rel),timeout=8) as resp:assert hashlib.sha256(resp.read()).hexdigest()==sha(target/'frontend/dist'/rel)
 with urllib.request.urlopen('http://127.0.0.1:5173/api/v1/health',timeout=5) as resp:assert json.load(resp)['ok']
except Exception:n.symlink_to(base);os.replace(n,'/opt/preclass/current');raise
print(json.dumps({'deployed':True,'current':str(target),'previous':str(base),'backendChanged':False,'databaseChanged':False,'servicesRestarted':False,'changedExistingFiles':1,'newAssets':4,'unchangedFiles':len(before)-1,'httpHashesVerified':True,'health':True,'singleRequestBatchAlgorithmUnchanged':True,'puzzleBAndSurveyBuilderPreserved':True}))
'''.replace('BASELINE',repr(baseline)).replace('FILES',repr(files));p=subprocess.run(ssh+['sudo -n python3 -'],input=script.encode(),capture_output=True,timeout=45);print(p.stdout.decode());print(p.stderr.decode());assert p.returncode==0;(out/'部署验证.json').write_bytes(p.stdout)
