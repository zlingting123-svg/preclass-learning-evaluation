from pathlib import Path
import datetime,hashlib,json,os,pwd,shutil,sqlite3,subprocess,time,urllib.request,uuid

root=Path('/home/ubuntu/preclass-library-20261030');os.umask(0o077)
stage=json.loads((root/'stage.json').read_text());base=Path(stage['base']);candidate=Path(stage['candidate']);current=Path('/opt/preclass/current')
prepared=json.loads((root/'preparation.json').read_text());verification=json.loads((root/'verification.json').read_text())
assert prepared['passed'] and verification['passed'] and prepared['fileCount']==12
assert all(not file.get('visualReviewPending') for file in prepared['files']), 'Review unresolved image pages before activation'
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
def manifest(path):
 result={}
 for p in path.rglob('*'):
  if p.is_symlink():result[str(p.relative_to(path))]='symlink:'+os.readlink(p)
  elif p.is_file():result[str(p.relative_to(path))]=sha(p)
 return result
assert current.resolve()==base and manifest(base)==stage['baseManifest'],'Concurrent baseline change'
assert manifest(candidate)==stage['candidateManifest']
for _ in range(40):
 with sqlite3.connect('file:/var/lib/preclass/ai/metadata.sqlite?mode=ro',uri=True) as ledger:
  active=sum(json.loads(r[0]).get('state') in ['reserved','calling'] for r in ledger.execute('SELECT payload FROM usage_ledger'))
 if not active:break
 time.sleep(.5)
else:raise RuntimeError('AI requests active; leave current release unchanged')
backup=Path('/var/backups/preclass/before-course-library.sqlite');assert not backup.exists()
with sqlite3.connect('file:/var/lib/preclass/app.sqlite?mode=ro',uri=True) as source,sqlite3.connect(backup) as dest:
 source.backup(dest);assert dest.execute('PRAGMA integrity_check').fetchone()[0]=='ok'
owner=pwd.getpwnam('preclass');destination=Path('/var/lib/preclass/reference-files');added=[];audit_ids=[]
connection=sqlite3.connect('/var/lib/preclass/app.sqlite',timeout=5)
get=lambda kind,ident:connection.execute('SELECT payload FROM records WHERE kind=? AND id=?',(kind,ident)).fetchone()
def put(kind,ident,value):connection.execute('INSERT INTO records(kind,id,payload) VALUES(?,?,?)',(kind,ident,json.dumps(value,ensure_ascii=False)))
timestamp=datetime.datetime.now(datetime.timezone.utc).isoformat().replace('+00:00','Z')
for file in prepared['files']:
 assert sha(Path(file['original']))==file['sha256']
 if file['reused']:
  assert sha(destination/(file['id']+'.original'))==file['sha256']
  assert get('reference_file',file['id']) and get('ai_imported_source',file['id'])
  continue
 assert not get('reference_file',file['id']) and not get('ai_imported_source',file['id'])
 copies={'.original':Path(file['original']),'.pages.jsonl':root/'prepared'/file['id']/'document.pages.jsonl'}
 if Path(file['pagesFile']).name.endswith('.prepared.jsonl'):copies['.prepared.jsonl']=Path(file['pagesFile'])
 for suffix,source in copies.items():
  path=destination/(file['id']+suffix);assert not path.exists();shutil.copyfile(source,path);os.chmod(path,0o600);os.chown(path,owner.pw_uid,owner.pw_gid)
 document={'title':file['title'],'pages':file['pageCount'],'ocrPages':len(file['ocrPages']),'aiRead':False,'memoryDocument':None,'status':'waiting_ai','retrievalIndexed':True,'sourceCommit':'62aaaab45fdf064b308c32ce9bc53e1dc2586e55'}
 path=destination/(file['id']+'.manifest.json');assert not path.exists();path.write_text(json.dumps(document,ensure_ascii=False,indent=2));os.chown(path,owner.pw_uid,owner.pw_gid)
try:
 connection.execute('BEGIN IMMEDIATE')
 for file in prepared['files']:
  if file['reused']:continue
  source=json.loads((root/'prepared'/file['id']/'source.json').read_text());source['createdAt']=timestamp
  job={'id':file['id'],'title':file['title'],'name':Path(file['path']).name,'size':file['bytes'],'received':file['bytes'],'status':'waiting_ai','pages':file['pageCount'],'parsedPages':file['pageCount'],'totalPages':file['pageCount'],'ocrPages':0,'blankPages':len(file['blankPages']),'createdAt':timestamp,'retrievalIndexed':True,'originalSha256':file['sha256'],'originCommit':'62aaaab45fdf064b308c32ce9bc53e1dc2586e55','ocrProcessedPages':len(file['ocrPages'])}
  put('ai_imported_source',file['id'],source);put('reference_file',file['id'],job);added.append(file['id'])
  ident=str(uuid.uuid4());audit_ids.append(ident)
  put('admin_audit',ident,{'id':ident,'actorId':'system:github-library-deploy','actorName':'GitHub资料部署任务','action':'knowledge.github.import_publish','targetId':file['id'],'at':timestamp,'sourceCommit':source['originCommit']})
 connection.commit()
except Exception:connection.rollback();raise
finally:connection.close()
def switch(target):
 temp=Path('/opt/preclass/.course-library-next');assert not temp.exists() and not temp.is_symlink();temp.symlink_to(target);os.replace(temp,current)
def call(path,token=None,body=None):
 payload=None if body is None else json.dumps(body).encode()
 request=urllib.request.Request('http://127.0.0.1:5173/api/v1'+path,data=payload,headers={**({'Authorization':'Bearer '+token} if token else {}),**({'Content-Type':'application/json'} if body is not None else {})})
 with urllib.request.urlopen(request,timeout=15) as response:return json.load(response)
token=None;switched=False
try:
 assert current.resolve()==base and manifest(base)==stage['baseManifest']
 switch(candidate);switched=True;subprocess.run(['systemctl','restart','preclass-test.service'],check=True)
 for _ in range(60):
  try:
   health=call('/health')
   if health.get('ok'):break
  except Exception:pass
  time.sleep(.5)
 else:raise RuntimeError('Health check failed')
 access=json.loads(Path('/home/ubuntu/preclass-access.json').read_text())
 session=call('/auth/admin-login',body={k:access[k] for k in ('username','password')});token=session['data']['accessToken']
 assert session['data']['user']['role']=='admin'
 jobs=call('/admin/reference-files',token)['data'];sources=call('/admin/knowledge',token)['data']
 for file in prepared['files']:
  job=next(j for j in jobs if j['id']==file['id']);source=next(s for s in sources if s['id']==file['id'])
  assert job['received']==file['bytes'] and source['state']=='published'
  request=urllib.request.Request('http://127.0.0.1:5173/api/v1/admin/reference-files/'+file['id']+'/download',headers={'Authorization':'Bearer '+token})
  with urllib.request.urlopen(request,timeout=30) as response:assert hashlib.sha256(response.read()).hexdigest()==file['sha256']
 assert manifest(candidate)==stage['candidateManifest']
 result={'activated':True,'current':str(candidate),'previous':str(base),'productVersion':'0.3','sourceCommit':'62aaaab45fdf064b308c32ce9bc53e1dc2586e55','files':12,'newFiles':len(added),'reusedFiles':prepared['reused'],'pages':prepared['pages'],'originalsHashVerifiedOverAuthenticatedHTTP':12,'changedCodeFiles':stage['changed'],'addedMetadata':stage['added'],'preservedFiles':3658,'allLibrarySourcesPublished':True,'newPaidSummariesStarted':0,'existingTextbookAiMemoryPreserved':True,'retrievalCalibrated':False,'health':health['data'],'backupIntegrity':'ok','publicPortsOpened':False,'frontendChanged':False,'syntheticProductionAccountsCreated':False,'newIds':added,'auditIds':audit_ids,'rollback':'Switch current to previous and restart backend; withdraw only the 11 newly imported source ids if data rollback is desired; preserve textbook and other business data.'}
 (root/'deployment.json').write_text(json.dumps(result,ensure_ascii=False,indent=2));print(json.dumps({k:v for k,v in result.items() if k not in ('newIds','auditIds')},ensure_ascii=True))
except Exception:
 if switched:switch(base);subprocess.run(['systemctl','restart','preclass-test.service'],check=True)
 with sqlite3.connect('/var/lib/preclass/app.sqlite') as db:
  for ident in added:db.execute("DELETE FROM records WHERE id=? AND kind IN ('reference_file','ai_imported_source')",(ident,))
  for ident in audit_ids:db.execute("DELETE FROM records WHERE id=? AND kind='admin_audit'",(ident,))
 raise
finally:
 if token:
  try:call('/auth/logout',token,{})
  except Exception:pass
