from pathlib import Path
import subprocess,tarfile,io,base64,json,hashlib
base=Path(__file__).resolve().parent
access=Path('C:/Users/96496/Documents/Codex/2026-10-28/outputs-md/work/server-access')
ssh=['ssh','-i',str(access/'preclass-deploy-ed25519'),'-o','UserKnownHostsFile='+str(access/'known_hosts'),'-o','StrictHostKeyChecking=yes','-o','BatchMode=yes','ubuntu@82.157.183.146']
buf=io.BytesIO();expected={}
with tarfile.open(fileobj=buf,mode='w:gz') as tar:
 for p in (base/'fixes').rglob('*'):
  if not p.is_file() or '/dist/' not in p.as_posix():continue
  rel=p.relative_to(base/'fixes').as_posix();info=tar.gettarinfo(str(p),arcname=rel);info.mode=0o644;info.uid=info.gid=0;info.uname=info.gname='root'
  with p.open('rb') as f:tar.addfile(info,f)
  previous=base/'main'/rel
  if previous.exists():expected[rel]=hashlib.sha256(previous.read_bytes()).hexdigest()
expected['frontend/dist/assets/main-rollcall-stage.js']=hashlib.sha256((base/'main-rollcall-stage.js').read_bytes()).hexdigest()
script='''from pathlib import Path
import os,hashlib,subprocess,tarfile,io,base64,json
current=Path('/opt/preclass/current');base=current.resolve();assert base==Path('/opt/preclass/releases/20261031-rollcall-stage'),'Server release changed; inspect before applying'
root=Path('/home/ubuntu/audit-fast-checkin-stage');root.mkdir(exist_ok=True,mode=0o700)
target=Path('/opt/preclass/releases/20261031-audit-fast-checkin');assert not target.exists(),'Candidate exists; inspect it'
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
def manifest(p):return {str(f.relative_to(p)):('symlink:'+os.readlink(f) if f.is_symlink() else sha(f)) for f in p.rglob('*') if f.is_file() or f.is_symlink()}
expected=EXPECTED
for rel,digest in expected.items():assert sha(base/rel)==digest,'Server file changed: '+rel
before=manifest(base);subprocess.run(['cp','-a','--reflink=auto',str(base),str(target)],check=True)
with tarfile.open(fileobj=io.BytesIO(base64.b64decode(PAYLOAD)),mode='r:gz') as tar:tar.extractall(target,filter='data')
a=target/'frontend/dist/assets';entry=(a/'main-entry-rollcall-stage.js').read_text();assert 'main-rollcall-stage.js' in entry;(a/'main-entry-audit-fix.js').write_text(entry.replace('main-rollcall-stage.js','main-audit-fix.js'))
p=target/'frontend/dist/index.html';html=p.read_text();assert 'main-entry-rollcall-stage.js' in html;p.write_text(html.replace('main-entry-rollcall-stage.js','main-entry-audit-fix.js'))
after=manifest(target)
for rel in after:
 if rel.endswith('.js') and (rel not in before or before[rel]!=after[rel]):subprocess.run(['/opt/preclass/runtime/node/bin/node','--check',str(target/rel)],check=True)
assert current.resolve()==base and manifest(base)==before
state={'base':str(base),'target':str(target),'before':before,'after':after,'changed':[p for p in before if before[p]!=after.get(p)],'added':list(set(after)-set(before))}
(root/'stage.json').write_text(json.dumps(state));print(json.dumps({'staged':True,'productionUnchanged':True,'target':str(target),'changed':state['changed'],'added':state['added']}))
'''.replace('EXPECTED',repr(expected)).replace('PAYLOAD',repr(base64.b64encode(buf.getvalue()).decode()))
r=subprocess.run(ssh+['sudo -n python3 -'],input=script.encode(),capture_output=True,timeout=60)
print(r.stdout.decode());print(r.stderr.decode());assert r.returncode==0
(base/'stage-result.json').write_bytes(r.stdout)
