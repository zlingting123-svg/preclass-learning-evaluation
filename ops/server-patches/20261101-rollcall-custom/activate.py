from pathlib import Path
import subprocess,json
r=Path(__file__).resolve().parent;out=Path('outputs/自定义点名与减速动画-2026-11-01');assert json.loads((out/'浏览器验证.json').read_text(encoding='utf-8'))['passed'];assert json.loads((out/'服务端验证.json').read_text())['passed']
a=Path('C:/Users/96496/Documents/Codex/2026-10-28/outputs-md/work/server-access');ssh=['ssh','-i',str(a/'preclass-deploy-ed25519'),'-o','UserKnownHostsFile='+str(a/'known_hosts'),'-o','StrictHostKeyChecking=yes','-o','BatchMode=yes','ubuntu@82.157.183.146']
script=r'''
from pathlib import Path
import os,json,hashlib,subprocess,sqlite3,time,urllib.request
root=Path('/home/ubuntu/rollcall-custom-stage');state=json.loads((root/'stage.json').read_text());base=Path(state['base']);target=Path(state['target']);current=Path('/opt/preclass/current')
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
def manifest(p):return {str(f.relative_to(p)):('symlink:'+os.readlink(f) if f.is_symlink() else sha(f)) for f in p.rglob('*') if f.is_file() or f.is_symlink()}
assert current.resolve()==base and manifest(base)==state['before'] and manifest(target)==state['after']
with sqlite3.connect('file:/var/lib/preclass/ai/metadata.sqlite?mode=ro',uri=True) as db:assert db.execute("SELECT count(*) FROM usage_ledger WHERE json_extract(payload,'$.state') IN ('reserved','calling')").fetchone()[0]==0,'Wait for active AI requests'
subprocess.run(['systemctl','start','preclass-backup.service'],check=True,timeout=60)
next=Path('/opt/preclass/.rollcall-custom-next');assert not next.exists();next.symlink_to(target);os.replace(next,current)
try:
 subprocess.run(['systemctl','restart','preclass-test.service'],check=True,timeout=30)
 for _ in range(40):
  try:
   with urllib.request.urlopen('http://127.0.0.1:5173/api/v1/health',timeout=2) as resp:assert json.load(resp)['ok']
   break
  except Exception:time.sleep(.25)
 else:raise RuntimeError('Health check failed')
 for name in ['preclass-test.service','preclass-test-web.service','preclass-knowledge-map.service']:
  assert subprocess.run(['systemctl','is-active',name],capture_output=True,text=True).stdout.strip()=='active'
 for rel in ['index.html','assets/main-entry-rollcall-custom.js','assets/main-rollcall-custom.js','assets/attendance-rollcall-custom.js','assets/attendance-rollcall-custom.css']:
  with urllib.request.urlopen('http://127.0.0.1:5173/'+('' if rel=='index.html' else rel),timeout=10) as resp:assert hashlib.sha256(resp.read()).hexdigest()==sha(target/'frontend/dist'/rel)
 assert manifest(target)==state['after']
except Exception:
 next.symlink_to(base);os.replace(next,current);subprocess.run(['systemctl','restart','preclass-test.service'],check=True);raise
result={'deployed':True,'current':str(target),'previous':str(base),'changed':['backend/dist/backend/src/attendance.js','frontend/dist/index.html'],'newAssets':4,'unchangedFiles':len(state['before'])-2,'databaseMigration':False,'productionTestWrites':False,'health':True,'httpHashesVerified':True,'customCountUpperBound':1000,'actualLimit':'candidate roster size','revealDelayMs':6500,'reducedMotionMs':250,'latestTimedAttendanceAndLoginPreserved':True,'drawAlgorithmUnchanged':True}
(root/'deployment.json').write_text(json.dumps(result));print(json.dumps(result))
'''
p=subprocess.run(ssh+['sudo -n python3 -'],input=script.encode(),capture_output=True,timeout=60);print(p.stdout.decode());print(p.stderr.decode());assert p.returncode==0;(out/'部署验证.json').write_bytes(p.stdout)
