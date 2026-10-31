from pathlib import Path
import subprocess,tarfile,io,base64
base=Path(__file__).resolve().parent
access=Path('C:/Users/96496/Documents/Codex/2026-10-28/outputs-md/work/server-access')
ssh=['ssh','-i',str(access/'preclass-deploy-ed25519'),'-o','UserKnownHostsFile='+str(access/'known_hosts'),'-o','StrictHostKeyChecking=yes','-o','BatchMode=yes','ubuntu@82.157.183.146']
buf=io.BytesIO()
with tarfile.open(fileobj=buf,mode='w:gz') as tar:
 for p in (base/'fixes').rglob('*'):
  if not p.is_file() or '/dist/' not in p.as_posix():continue
  info=tar.gettarinfo(str(p),arcname=p.relative_to(base/'fixes').as_posix());info.mode=0o644;info.uid=info.gid=0;info.uname=info.gname='root'
  with p.open('rb') as f:tar.addfile(info,f)
script='''from pathlib import Path
import os,hashlib,tarfile,io,base64,json
root=Path('/home/ubuntu/audit-fast-checkin-stage');p=root/'stage.json';state=json.loads(p.read_text());base=Path(state['base']);target=Path(state['target']);assert Path('/opt/preclass/current').resolve()==base
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
def manifest(p):return {str(f.relative_to(p)):('symlink:'+os.readlink(f) if f.is_symlink() else sha(f)) for f in p.rglob('*') if f.is_file() or f.is_symlink()}
assert manifest(base)==state['before'];assert manifest(target)==state['after']
with tarfile.open(fileobj=io.BytesIO(base64.b64decode(PAYLOAD)),mode='r:gz') as tar:tar.extractall(target,filter='data')
state['after']=manifest(target);p.write_text(json.dumps(state));print('Candidate updated, production unchanged')
'''.replace('PAYLOAD',repr(base64.b64encode(buf.getvalue()).decode()))
r=subprocess.run(ssh+['sudo -n python3 -'],input=script.encode(),capture_output=True,timeout=30);print(r.stdout.decode());print(r.stderr.decode());assert r.returncode==0
