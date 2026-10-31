from pathlib import Path
import subprocess,json
base=Path(__file__).resolve().parent;out=Path('outputs/项目优化与快速签到-2026-11-01')
assert json.loads((out/'修复代码GitHub同步.json').read_text(encoding='utf-8'))['verified']
assert json.loads((out/'服务端验证.json').read_text(encoding='utf-8'))['passed']
assert json.loads((out/'浏览器验证.json').read_text(encoding='utf-8'))['passed']
if (out/'浏览器绑定GitHub同步.json').exists():assert json.loads((out/'浏览器绑定GitHub同步.json').read_text(encoding='utf-8'))['verified']
access=Path('C:/Users/96496/Documents/Codex/2026-10-28/outputs-md/work/server-access')
ssh=['ssh','-i',str(access/'preclass-deploy-ed25519'),'-o','UserKnownHostsFile='+str(access/'known_hosts'),'-o','StrictHostKeyChecking=yes','-o','BatchMode=yes','ubuntu@82.157.183.146']
script=r'''
from pathlib import Path
import os,json,hashlib,subprocess,sqlite3,time,urllib.request,urllib.error
root=Path('/home/ubuntu/audit-fast-checkin-stage');state=json.loads((root/'stage.json').read_text());base=Path(state['base']);target=Path(state['target']);current=Path('/opt/preclass/current')
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
def manifest(p):return {str(f.relative_to(p)):('symlink:'+os.readlink(f) if f.is_symlink() else sha(f)) for f in p.rglob('*') if f.is_file() or f.is_symlink()}
assert current.resolve()==base and manifest(base)==state['before'] and manifest(target)==state['after']
for _ in range(40):
 with sqlite3.connect('file:/var/lib/preclass/ai/metadata.sqlite?mode=ro',uri=True) as db:active=db.execute("SELECT count(*) FROM usage_ledger WHERE json_extract(payload,'$.state') IN ('reserved','calling')").fetchone()[0]
 if not active:break
 time.sleep(.5)
else:raise RuntimeError('AI requests still active; defer switch')
assert subprocess.run(['systemctl','is-active','preclass-backup.timer'],capture_output=True,text=True).stdout.strip()=='active'
snapshots=list(Path('/var/backups/preclass/automatic').glob('auto-*/manifest.json'));assert snapshots
latest=max(snapshots,key=lambda p:p.stat().st_mtime);assert json.loads(latest.read_text())['fileAndDatabaseRestoreChecked']
next=Path('/opt/preclass/.audit-fast-checkin-next');assert not next.exists();next.symlink_to(target);os.replace(next,current)
try:
 subprocess.run(['systemctl','restart','preclass-test.service'],check=True,timeout=30)
 for _ in range(40):
  try:
   with urllib.request.urlopen('http://127.0.0.1:5173/api/v1/health',timeout=2) as r:health=json.load(r)
   if health.get('ok'):break
  except Exception:pass
  time.sleep(.25)
 else:raise RuntimeError('Health check failed')
 for name in ['preclass-test.service','preclass-test-web.service','preclass-knowledge-map.service','preclass-backup.timer']:
  assert subprocess.run(['systemctl','is-active',name],capture_output=True,text=True).stdout.strip()=='active',name
 resources=['index.html']+['assets/'+name for name in ['main-entry-audit-fix.js','main-audit-fix.js','attendance-audit-fix.js','attendance-audit-fix.css','survey-draft-fix.js']]
 for rel in resources:
  with urllib.request.urlopen('http://127.0.0.1:5173/'+('' if rel=='index.html' else rel),timeout=10) as r:assert hashlib.sha256(r.read()).hexdigest()==sha(target/'frontend/dist'/rel),rel
 with urllib.request.urlopen('http://127.0.0.1:5173/knowledge-map/api/config',timeout=5) as r:assert json.load(r)=={'demo':False}
 req=urllib.request.Request('http://127.0.0.1:5173/api/v1/attendance/scan',data=json.dumps({'sessionId':'audit-nonexistent-session','ticket':'invalid'}).encode(),headers={'Content-Type':'application/json'},method='POST')
 try:urllib.request.urlopen(req,timeout=5);raise RuntimeError('Invalid scan unexpectedly accepted')
 except urllib.error.HTTPError as e:assert e.code==404 and json.load(e)['error']['code']=='NOT_FOUND'
 assert manifest(target)==state['after']
except Exception:
 next.symlink_to(base);os.replace(next,current);subprocess.run(['systemctl','restart','preclass-test.service'],check=True);raise
result={'deployed':True,'current':str(target),'previous':str(base),'changedFiles':state['changed'],'addedFiles':state['added'],'unchangedFiles':len(state['before'])-len(state['changed']),'hostRestarted':True,'caddyRestarted':False,'knowledgeMapRestarted':False,'databaseMigration':False,'productionTestWrites':False,'paidModelCalls':0,'health':health,'httpResourceHashesVerified':True,'anonymousScanRouteVerified':True,'qrRotationMs':2000,'qrValidMs':10000,'scanProofValidMs':180000,'backupTimerActive':True,'restoreChecksPassed':True,'fullApplicationRestoreTested':False,'externalBackup':False}
if target.name.endswith('-bound'):
 first=json.loads((root/'stage-first.json').read_text());overall=first['before'];now=state['after'];result.update(deviceBoundScanProof=True,overallBaseline=first['base'],overallChangedFiles=[p for p in overall if overall[p]!=now.get(p)],overallAddedFiles=list(set(now)-set(overall)),overallUnchangedFiles=sum(now.get(p)==v for p,v in overall.items()))
(root/'deployment.json').write_text(json.dumps(result,indent=2));print(json.dumps(result))
'''
r=subprocess.run(ssh+['sudo -n python3 -'],input=script.encode(),capture_output=True,timeout=55)
print(r.stdout.decode());print(r.stderr.decode());assert r.returncode==0
(out/'部署验证.json').write_bytes(r.stdout)
