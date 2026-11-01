from pathlib import Path
import subprocess,json,base64,hashlib
r=Path(__file__).resolve().parent;out=Path('outputs/签到拼图重设计预览-2026-11-01');assert json.loads((out/'正式接入隔离验证.json').read_text(encoding='utf-8'))['passed'];a=Path('C:/Users/96496/Documents/Codex/2026-10-28/outputs-md/work/server-access');ssh=['ssh','-i',str(a/'preclass-deploy-ed25519'),'-o','UserKnownHostsFile='+str(a/'known_hosts'),'-o','StrictHostKeyChecking=yes','-o','BatchMode=yes','ubuntu@82.157.183.146'];files={p.name:base64.b64encode(p.read_bytes()).decode() for p in (r/'dist/assets').iterdir()};expected=hashlib.sha256((r/'main.before.js').read_bytes()).hexdigest()
script='''from pathlib import Path
import os,hashlib,base64,json,subprocess,urllib.request
base=Path('/opt/preclass/current').resolve();assert base.name=='20261101-rollcall-custom';target=Path('/opt/preclass/releases/20261101-puzzle-b');assert not target.exists();sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
def manifest(p):return {str(f.relative_to(p)):('symlink:'+os.readlink(f) if f.is_symlink() else sha(f)) for f in p.rglob('*') if f.is_file() or f.is_symlink()}
assert sha(base/'frontend/dist/assets/main-rollcall-custom.js')==EXPECTED;before=manifest(base);subprocess.run(['cp','-a','--reflink=auto',str(base),str(target)],check=True)
for name,data in FILES.items():(target/'frontend/dist/assets'/name).write_bytes(base64.b64decode(data))
a=target/'frontend/dist/assets';entry=(a/'main-entry-rollcall-custom.js').read_text();(a/'main-entry-puzzle-b.js').write_text(entry.replace('main-rollcall-custom.js','main-puzzle-b.js'));p=target/'frontend/dist/index.html';p.write_text(p.read_text().replace('main-entry-rollcall-custom.js','main-entry-puzzle-b.js'));after=manifest(target);assert [p for p in before if before[p]!=after.get(p)]==['frontend/dist/index.html'];assert len(set(after)-set(before))==4
for name in ['main-entry-puzzle-b.js','main-puzzle-b.js','attendance-puzzle-b.js']:subprocess.run(['/opt/preclass/runtime/node/bin/node','--check',str(a/name)],check=True)
assert Path('/opt/preclass/current').resolve()==base and manifest(base)==before;n=Path('/opt/preclass/.puzzle-b-next');assert not n.exists();n.symlink_to(target);os.replace(n,'/opt/preclass/current')
try:
 for rel in ['index.html','assets/main-puzzle-b.js','assets/attendance-puzzle-b.js','assets/attendance-puzzle-b.css']:
  with urllib.request.urlopen('http://127.0.0.1:5173/'+('' if rel=='index.html' else rel),timeout=8) as resp:assert hashlib.sha256(resp.read()).hexdigest()==sha(target/'frontend/dist'/rel)
except Exception:n.symlink_to(base);os.replace(n,'/opt/preclass/current');raise
print(json.dumps({'deployed':True,'current':str(target),'previous':str(base),'backendChanged':False,'databaseChanged':False,'servicesRestarted':False,'changedExistingFiles':1,'newAssets':4,'unchangedFiles':len(before)-1,'httpHashesVerified':True}))
'''.replace('EXPECTED',repr(expected)).replace('FILES',repr(files));p=subprocess.run(ssh+['sudo -n python3 -'],input=script.encode(),capture_output=True,timeout=40);print(p.stdout.decode());print(p.stderr.decode());assert p.returncode==0;(out/'B版部署验证.json').write_bytes(p.stdout)
