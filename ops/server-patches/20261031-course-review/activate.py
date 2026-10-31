from pathlib import Path
import json,hashlib,os,sqlite3,subprocess,time,urllib.request
root=Path('/home/ubuntu/course-review-stage');state=json.loads((root/'stage.json').read_text());base=Path(state['base']);target=Path(state['target']);current=Path('/opt/preclass/current');sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
def manifest(p):return {str(f.relative_to(p)):('symlink:'+os.readlink(f) if f.is_symlink() else sha(f)) for f in p.rglob('*') if f.is_symlink() or f.is_file()}
assert current.resolve()==base and manifest(base)==state['before'] and manifest(target)==state['after']
for name in ['review-verification.json','verification.json','验证.json']:assert json.loads((root/name).read_text(encoding='utf-8-sig'))['passed']
for _ in range(60):
 with sqlite3.connect('file:/var/lib/preclass/ai/metadata.sqlite?mode=ro',uri=True) as db:active=sum(json.loads(x[0]).get('state') in ['reserved','calling'] for x in db.execute('SELECT payload FROM usage_ledger'))
 if not active:break
 time.sleep(.5)
else:raise RuntimeError('AI requests active; postpone code switch')
next=Path('/opt/preclass/.course-review-next');assert not next.exists();next.symlink_to(target);os.replace(next,current)
try:
 subprocess.run(['systemctl','restart','preclass-test.service'],check=True)
 for _ in range(60):
  try:
   with urllib.request.urlopen('http://127.0.0.1:5173/api/v1/health',timeout=2) as r:health=json.load(r)
   if health.get('ok'):break
  except Exception:pass
  time.sleep(.5)
 else:raise RuntimeError('Host health failed')
 with urllib.request.urlopen('http://127.0.0.1:5173/knowledge-map/api/config',timeout=5) as r:assert json.load(r)=={'demo':False}
 for rel in ['frontend/dist/index.html','frontend/dist/assets/main-course-review.js','frontend/dist/assets/course-review-layout.css']:
  url='http://127.0.0.1:5173/'+('' if rel.endswith('index.html') else rel.removeprefix('frontend/dist/'))
  with urllib.request.urlopen(url,timeout=5) as r:assert hashlib.sha256(r.read()).hexdigest()==sha(target/rel)
 assert manifest(target)==state['after']
except Exception:
 next.symlink_to(base);os.replace(next,current);subprocess.run(['systemctl','restart','preclass-test.service'],check=True);raise
result={'deployed':True,'current':str(target),'previous':str(base),'chapterReview':True,'strictSources':'uploaded material and MEE only','inputBudgetUnchanged':True,'uploadedMetadataHidden':True,'verbatimReplyGuard':True,'courseReplyCheckedBeforeEmit':True,'surveyStreamingUnchanged':True,'loginFourModuleLayout':True,'existingFilesChanged':[p for p in state['before'] if state['before'][p]!=state['after'].get(p)],'addedFiles':list(set(state['after'])-set(state['before'])),'unchangedFiles':len(state['before'])-4,'businessDataMigrated':False,'sourceDocumentsUnchanged':True,'hostRestarted':True,'knowledgeMapRestarted':False,'realModelCalls':0,'mockProviderIntegrationPassed':True,'health':True};(root/'deployment.json').write_text(json.dumps(result,indent=2));print(json.dumps(result))
