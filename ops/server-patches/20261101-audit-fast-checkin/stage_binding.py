from pathlib import Path
import subprocess,json,base64
root=Path(__file__).resolve().parent;access=Path('C:/Users/96496/Documents/Codex/2026-10-28/outputs-md/work/server-access')
ssh=['ssh','-i',str(access/'preclass-deploy-ed25519'),'-o','UserKnownHostsFile='+str(access/'known_hosts'),'-o','StrictHostKeyChecking=yes','-o','BatchMode=yes','ubuntu@82.157.183.146']
payload={name:base64.b64encode((root/'fixes/backend/dist/backend/src'/name).read_bytes()).decode() for name in ['attendance.js','attendance-qr.js']}
script='''from pathlib import Path
import subprocess,os,hashlib,json,base64
root=Path('/home/ubuntu/audit-fast-checkin-stage');state=json.loads((root/'stage.json').read_text());base=Path('/opt/preclass/releases/20261031-audit-fast-checkin');target=Path('/opt/preclass/releases/20261101-audit-fast-checkin-bound');assert Path('/opt/preclass/current').resolve()==base and not target.exists()
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
def manifest(p):return {str(f.relative_to(p)):('symlink:'+os.readlink(f) if f.is_symlink() else sha(f)) for f in p.rglob('*') if f.is_file() or f.is_symlink()}
before=manifest(base);assert before==state['after'];(root/'stage-first.json').write_text(json.dumps(state));subprocess.run(['cp','-a','--reflink=auto',str(base),str(target)],check=True)
payload=PAYLOAD
for name,encoded in payload.items():p=target/'backend/dist/backend/src'/name;p.write_bytes(base64.b64decode(encoded));subprocess.run(['/opt/preclass/runtime/node/bin/node','--check',str(p)],check=True)
after=manifest(target);changed=[p for p in before if before[p]!=after.get(p)];assert set(changed)=={'backend/dist/backend/src/attendance.js','backend/dist/backend/src/attendance-qr.js'}
state={'base':str(base),'target':str(target),'before':before,'after':after,'changed':changed,'added':[]};(root/'stage.json').write_text(json.dumps(state));print(json.dumps({'staged':True,'target':str(target),'changed':changed,'productionUnchanged':True}))
'''.replace('PAYLOAD',repr(payload))
r=subprocess.run(ssh+['sudo -n python3 -'],input=script.encode(),capture_output=True,timeout=30);print(r.stdout.decode());print(r.stderr.decode());assert r.returncode==0
