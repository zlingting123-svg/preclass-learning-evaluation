from pathlib import Path
import hashlib,json,os,sqlite3,subprocess,time,urllib.request
base=Path('/opt/preclass/releases/20261030-course-library');target=Path('/opt/preclass/releases/20261030-attendance');stage=Path('/home/ubuntu/preclass-attendance-stage');current=Path('/opt/preclass/current')
assert os.geteuid()==0 and current.resolve()==base and not target.exists()
assert json.loads((stage/'verification.json').read_text())['passed']
assert json.loads((stage/'browser-verification.json').read_text())['passed']
staged_app=(stage/'backend/dist/backend/src/app.js').read_text().replace("import {attendanceRoutes} from './attendance.js';\n",'',1).replace('questionnaireRoutes(app, service, ok);\n    attendanceRoutes(app, service);','questionnaireRoutes(app, service, ok);',1)
assert staged_app==(base/'backend/dist/backend/src/app.js').read_text(),'Backend source changed since staging'
assert (stage/'frontend/dist/index.html').read_text().replace('main-entry-attendance-20261030.js','main-entry-insights-followup-20261030.js')==(base/'frontend/dist/index.html').read_text()
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
def manifest(path):
 result={}
 for p in path.rglob('*'):
  if p.is_symlink():result[str(p.relative_to(path))]='symlink:'+os.readlink(p)
  elif p.is_file():result[str(p.relative_to(path))]=sha(p)
 return result
before=manifest(base)
subprocess.run(['cp','-a','--reflink=auto',str(base),str(target)],check=True)
files=['backend/dist/backend/src/attendance.js','backend/dist/backend/src/app.js','frontend/dist/index.html','frontend/dist/assets/attendance-20261030.js','frontend/dist/assets/attendance-20261030.css','frontend/dist/assets/main-attendance-20261030.js','frontend/dist/assets/main-entry-attendance-20261030.js']
for relative in files:(target/relative).write_bytes((stage/relative).read_bytes())
after=manifest(target);changed=sorted(k for k in before if before[k]!=after[k]);added=sorted(after.keys()-before.keys())
assert changed==['backend/dist/backend/src/app.js','frontend/dist/index.html']
assert set(added)==set(files)-set(changed)
for _ in range(40):
 with sqlite3.connect('file:/var/lib/preclass/ai/metadata.sqlite?mode=ro',uri=True) as ledger:active=sum(json.loads(r[0]).get('state') in ['reserved','calling'] for r in ledger.execute('SELECT payload FROM usage_ledger'))
 if not active:break
 time.sleep(.5)
else:raise RuntimeError('AI requests are active; leave current unchanged')
backup=Path('/var/backups/preclass/before-attendance.sqlite');assert not backup.exists()
os.umask(0o077)
with sqlite3.connect('file:/var/lib/preclass/app.sqlite?mode=ro',uri=True) as source,sqlite3.connect(backup) as destination:
 source.backup(destination);assert destination.execute('PRAGMA integrity_check').fetchone()[0]=='ok'
def switch(path):
 temp=Path('/opt/preclass/.attendance-next');assert not temp.exists() and not temp.is_symlink();temp.symlink_to(path);os.replace(temp,current)
assert current.resolve()==base and manifest(base)==before
image_id=None;switched=False;token=None
try:
 # Seed only the user-authorized trial image; no simulated classes, sessions or people.
 seed=stage/'seed.mjs'
 seed.write_text("import{readFileSync}from'node:fs';import{SqliteStore}from'/opt/preclass/releases/20261030-attendance/backend/dist/backend/src/store.js';import{Service}from'/opt/preclass/releases/20261030-attendance/backend/dist/backend/src/service.js';import{AttendanceService}from'/opt/preclass/releases/20261030-attendance/backend/dist/backend/src/attendance.js';const store=new SqliteStore('/var/lib/preclass/app.sqlite');const core=new Service(store),service=new AttendanceService(core),user=store.all('user').find(u=>u.role==='admin');const result=service.upload(user,{title:'雪山与花海 · 试用图',mime:'image/jpeg',base64:readFileSync('/home/ubuntu/preclass-attendance-stage/mountain.jpg').toString('base64')});console.log(JSON.stringify({id:result.id,sha256:result.sha256}));store.close();")
 seeded=json.loads(subprocess.check_output(['/opt/preclass/runtime/node/bin/node',str(seed)],text=True));image_id=seeded['id']
 switch(target);switched=True;subprocess.run(['systemctl','restart','preclass-test.service'],check=True)
 def call(path,body=None):
  req=urllib.request.Request('http://127.0.0.1:5173/api/v1'+path,data=None if body is None else json.dumps(body).encode(),headers={**({'Authorization':'Bearer '+token} if token else {}),**({'Content-Type':'application/json'} if body is not None else {})})
  with urllib.request.urlopen(req,timeout=15) as response:return json.load(response)
 for _ in range(60):
  try:
   health=call('/health')
   if health.get('ok'):break
  except Exception:pass
  time.sleep(.5)
 else:raise RuntimeError('Health check failed')
 access=json.loads(Path('/home/ubuntu/preclass-access.json').read_text());session=call('/auth/admin-login',{k:access[k] for k in ('username','password')});token=session['data']['accessToken'];assert session['data']['user']['role']=='admin'
 pictures=call('/admin/attendance/images')['data'];assert any(p['id']==image_id and p['sha256']==seeded['sha256'] for p in pictures)
 for relative in files:
  if relative.startswith('frontend/dist/'):
   with urllib.request.urlopen('http://127.0.0.1:5173/'+relative.removeprefix('frontend/dist/'),timeout=10) as response:assert hashlib.sha256(response.read()).hexdigest()==after[relative]
 result={'activated':True,'current':str(target),'previous':str(base),'files':files,'changed':changed,'added':added,'unchanged':len(before)-len(changed),'seedImageId':image_id,'imageSHA256':seeded['sha256'],'health':health['data'],'authenticatedAdminImageList':True,'httpAssetsHashVerified':True,'syntheticProductionUsers':False,'productionAttendanceSessionsCreated':False,'realModelCalls':0,'publicPortsOpened':False,'productVersion':'0.3','backupIntegrity':'ok','rollback':'Switch current to previous and restart backend; do not restore the whole database or delete real attendance data.'}
 (stage/'deployment.json').write_text(json.dumps(result,ensure_ascii=False,indent=2));print(json.dumps(result,ensure_ascii=True))
except Exception:
 if switched:switch(base);subprocess.run(['systemctl','restart','preclass-test.service'],check=True)
 if image_id:
  with sqlite3.connect('/var/lib/preclass/app.sqlite') as db:db.execute("DELETE FROM records WHERE kind='attendance_image' AND id=?",(image_id,))
 raise
finally:
 if token:
  try:call('/auth/logout',{})
  except Exception:pass
