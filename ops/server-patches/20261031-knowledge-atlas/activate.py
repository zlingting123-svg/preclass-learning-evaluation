from pathlib import Path
import hashlib,json,os,shutil,sqlite3,subprocess,time,urllib.request,urllib.error
root=Path('/home/ubuntu/km-atlas-stage');state=json.loads((root/'stage.json').read_text());base=Path(state['base']);target=Path(state['target']);module=Path(state['module']);current=Path('/opt/preclass/current');unit=Path('/etc/systemd/system/preclass-knowledge-map.service');old_unit=unit.read_bytes();assert os.geteuid()==0 and current.resolve()==base
for name in ['editor-api-verification.json','浏览器验证.json']:assert json.loads((root/name).read_text())['passed']
log=(root/'regression.log').read_text();assert 'Ran 16 tests' in log and '\nOK\n' in log
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
def manifest(path):return {str(p.relative_to(path)):('symlink:'+os.readlink(p) if p.is_symlink() else sha(p)) for p in path.rglob('*') if p.is_symlink() or p.is_file()}
assert manifest(base)==state['before'] and manifest(target)==state['after']
for name in ['server.py','public/app.js','public/index.html','public/style.css','public/atlas.bundle.js','public/atlas.css','scripts/graph_data.py']:
 assert sha(module/name)==sha(root/'module-patch'/name),name
backup=Path('/var/backups/preclass/knowledge-map-before-atlas1');assert not backup.exists();backup.mkdir(mode=0o700)
(backup/'preclass-knowledge-map.service').write_bytes(old_unit);(backup/'preclass-knowledge-map.service').chmod(0o600)
for _ in range(30):
 active=subprocess.check_output(['ss','-Htn','state','established','(','sport','=',':3216',')'],text=True).strip()
 if not active:break
 time.sleep(.5)
else:raise RuntimeError('Module requests active; not changing service')
new_unit=old_unit.decode().replace('/opt/preclass/modules/knowledge-map-v060',str(module)).replace('module v0.6.0 with teacher editing','module v0.6.0 source atlas')
assert new_unit!=old_unit.decode() and '127.0.0.1:3001' in new_unit and 'KM_PORT=3216' in new_unit
switched=False;stopped=False
try:
 subprocess.run(['systemctl','stop','preclass-knowledge-map.service'],check=True);stopped=True
 data=Path('/var/lib/preclass/knowledge-map');shutil.copytree(data,backup/'data')
 with sqlite3.connect(backup/'data/maps.sqlite') as db:assert db.execute('PRAGMA integrity_check').fetchone()[0]=='ok';before_records=dict(db.execute('SELECT id,payload FROM maps'))
 original_files={p.name:sha(p) for p in data.iterdir() if p.is_file() and p.name!='maps.sqlite' and not p.name.startswith('maps.sqlite-')}
 assert current.resolve()==base and manifest(base)==state['before']
 temp=Path('/opt/preclass/.knowledge-atlas-next');assert not temp.exists() and not temp.is_symlink();temp.symlink_to(target);os.replace(temp,current);switched=True
 unit.write_text(new_unit);subprocess.run(['systemctl','daemon-reload'],check=True);subprocess.run(['systemctl','start','preclass-knowledge-map.service'],check=True)
 for _ in range(60):
  try:
   with urllib.request.urlopen('http://127.0.0.1:5173/knowledge-map/api/config',timeout=2) as response:config=json.load(response)
   if config=={'demo':False}:break
  except Exception:pass
  time.sleep(.5)
 else:raise RuntimeError('Knowledge map module health failed')
 for path,local in [('','frontend/dist/index.html'),('assets/main-knowledge-atlas-1.js','frontend/dist/assets/main-knowledge-atlas-1.js')]:
  with urllib.request.urlopen('http://127.0.0.1:5173/'+path,timeout=5) as response:assert hashlib.sha256(response.read()).hexdigest()==sha(target/local)
 for path in ['app.js','style.css','atlas.bundle.js','atlas.css','']:
  with urllib.request.urlopen('http://127.0.0.1:5173/knowledge-map/'+path,timeout=5) as response:assert hashlib.sha256(response.read()).hexdigest()==sha(module/'public'/(path or 'index.html'))
 with urllib.request.urlopen('http://127.0.0.1:5173/api/v1/health',timeout=5) as response:assert json.load(response)['ok']
 try:urllib.request.urlopen('http://127.0.0.1:5173/knowledge-map/api/maps',timeout=5);raise RuntimeError('Anonymous maps unexpectedly allowed')
 except urllib.error.HTTPError as e:assert e.code==401
 with sqlite3.connect('file:/var/lib/preclass/knowledge-map/maps.sqlite?mode=ro',uri=True) as db:after_records=dict(db.execute('SELECT id,payload FROM maps'))
 assert all(after_records.get(key)==payload for key,payload in before_records.items())
 assert all(sha(data/name)==expected for name,expected in original_files.items())
 assert manifest(target)==state['after']
 install={'current':str(target),'previous':str(base),'module':str(module),'backup':str(backup),'unitSha256':sha(unit),'originalUnitSha256':hashlib.sha256(old_unit).hexdigest()};(root/'install-state.json').write_text(json.dumps(install,indent=2))
 result={'deployed':True,'productVersion':'0.3','moduleVersion':'0.6.0','current':str(target),'previous':str(base),'module':str(module),'interactive3D':True,'sourceTopics':362,'sourceRelationships':361,'teacherStudentMenu':'知识图谱','hostRoute':'/knowledge-maps','moduleRoute':'/knowledge-map/','teacherEditableHierarchy':True,'studentReadOnly':True,'ssoSameOrigin':True,'unchangedHostFiles':len(state['before'])-1,'changedHostFiles':['frontend/dist/index.html'],'newHostAssets':2,'hostBackendChanged':False,'hostBackendRestarted':False,'caddyChanged':False,'existingMapCountPreserved':len(before_records),'originalFilesPreserved':True,'backupIntegrity':'ok','anonymousMapsHTTP':401,'httpAssetsHashesVerified':True,'realModelCalls':0,'productionTestRecordsCreated':False,'newDependenciesInstalled':False,'publicPortsOpened':False,'health':True}
 (root/'deployment.json').write_text(json.dumps(result,ensure_ascii=False,indent=2));print(json.dumps(result,ensure_ascii=True))
except Exception:
 if switched:
  temp=Path('/opt/preclass/.knowledge-atlas-next');temp.symlink_to(base);os.replace(temp,current)
 unit.write_bytes(old_unit);subprocess.run(['systemctl','daemon-reload'],check=True)
 if stopped:subprocess.run(['systemctl','start','preclass-knowledge-map.service'],check=True)
 raise
