from pathlib import Path
import subprocess,base64,json
r=Path(__file__).resolve().parent;a=Path('C:/Users/96496/Documents/Codex/2026-10-28/outputs-md/work/server-access');ssh=['ssh','-i',str(a/'preclass-deploy-ed25519'),'-o','UserKnownHostsFile='+str(a/'known_hosts'),'-o','StrictHostKeyChecking=yes','-o','BatchMode=yes','ubuntu@82.157.183.146']
files={p.name:base64.b64encode(p.read_bytes()).decode() for p in (r/'dist/assets').iterdir()}
script='''from pathlib import Path
import json,hashlib,base64,subprocess,os
root=Path('/home/ubuntu/rollcall-custom-stage');root.mkdir(exist_ok=True);base=Path('/opt/preclass/current').resolve();assert base.name=='20261101-password-autofill','Current changed; inspect it'
target=Path('/opt/preclass/releases/20261101-rollcall-custom');assert target.resolve()!=Path('/opt/preclass/current').resolve()
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
def manifest(p):return {str(f.relative_to(p)):('symlink:'+os.readlink(f) if f.is_symlink() else sha(f)) for f in p.rglob('*') if f.is_file() or f.is_symlink()}
before=manifest(base)
if not target.exists():subprocess.run(['cp','-a','--reflink=auto',str(base),str(target)],check=True)
else:
 existing=manifest(target)
 for rel,digest in before.items():
  if rel not in ['backend/dist/backend/src/attendance.js','frontend/dist/index.html']:assert existing.get(rel)==digest,'Candidate changed unexpectedly'
files=FILES
for name,value in files.items():(target/'frontend/dist/assets'/name).write_bytes(base64.b64decode(value))
p=target/'backend/dist/backend/src/attendance.js';s=(base/'backend/dist/backend/src/attendance.js').read_text();old='count:z.number().int().min(1).max(20)';assert s.count(old)==1;s=s.replace(old,'count:z.number().int().min(1).max(1000)');p.write_text(s)
a=target/'frontend/dist/assets';entry=(a/'main-entry-password-autofill-20261101.js').read_text();assert 'main-password-autofill-20261101.js' in entry;(a/'main-entry-rollcall-custom.js').write_text(entry.replace('main-password-autofill-20261101.js','main-rollcall-custom.js'))
p=target/'frontend/dist/index.html';s=(base/'frontend/dist/index.html').read_text();assert 'main-entry-password-autofill-20261101.js' in s;p.write_text(s.replace('main-entry-password-autofill-20261101.js','main-entry-rollcall-custom.js'))
for rel in ['backend/dist/backend/src/attendance.js','frontend/dist/assets/main-entry-rollcall-custom.js','frontend/dist/assets/main-rollcall-custom.js','frontend/dist/assets/attendance-rollcall-custom.js']:subprocess.run(['/opt/preclass/runtime/node/bin/node','--check',str(target/rel)],check=True)
after=manifest(target);changed=[p for p in before if before[p]!=after.get(p)];assert set(changed)=={'backend/dist/backend/src/attendance.js','frontend/dist/index.html'};assert len(set(after)-set(before))==4
(root/'stage.json').write_text(json.dumps({'base':str(base),'target':str(target),'before':before,'after':after}));print(json.dumps({'staged':True,'base':str(base),'target':str(target),'changed':changed,'added':list(set(after)-set(before))}))
'''.replace('FILES',repr(files))
result=subprocess.run(ssh+['sudo -n python3 -'],input=script.encode(),capture_output=True,timeout=40);print(result.stdout.decode());print(result.stderr.decode());assert result.returncode==0;(r/'stage-result.json').write_bytes(result.stdout)
