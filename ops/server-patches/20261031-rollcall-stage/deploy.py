from pathlib import Path
import hashlib,json,os,subprocess,urllib.request
root=Path('/home/ubuntu/rollcall-stage');base=Path('/opt/preclass/releases/20261031-course-review');target=Path('/opt/preclass/releases/20261031-rollcall-stage');current=Path('/opt/preclass/current');assert current.resolve()==base and not target.exists();assert json.loads((root/'验证.json').read_text(encoding='utf-8-sig'))['passed'];sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
def manifest(p):return {str(f.relative_to(p)):('symlink:'+os.readlink(f) if f.is_symlink() else sha(f)) for f in p.rglob('*') if f.is_symlink() or f.is_file()}
assert sha(base/'frontend/dist/assets/attendance-blur-1.js')=='8c97180202e8784bdc17f722a82f0f1fc8b098966b88a8c41905706338d2fe19';before=manifest(base);subprocess.run(['cp','-a','--reflink=auto',str(base),str(target)],check=True);a=target/'frontend/dist/assets'
for name in ['attendance-rollcall-stage.js','attendance-rollcall-stage.css']:(a/name).write_bytes((root/name).read_bytes())
s=(a/'main-course-review.js').read_text();assert s.count('./attendance-blur-1.js')==1;s=s.replace('./attendance-blur-1.js','./attendance-rollcall-stage.js');(a/'main-rollcall-stage.js').write_text(s)
s=(a/'main-entry-course-review.js').read_text().replace('main-course-review.js','main-rollcall-stage.js');(a/'main-entry-rollcall-stage.js').write_text(s);p=target/'frontend/dist/index.html';p.write_text(p.read_text().replace('main-entry-course-review.js','main-entry-rollcall-stage.js'));after=manifest(target);assert [p for p in before if before[p]!=after.get(p)]==['frontend/dist/index.html'];assert len(set(after)-set(before))==4
for name in ['attendance-rollcall-stage.js','main-rollcall-stage.js','main-entry-rollcall-stage.js']:subprocess.run(['/opt/preclass/runtime/node/bin/node','--check',str(a/name)],check=True)
assert manifest(base)==before and current.resolve()==base;next=Path('/opt/preclass/.rollcall-stage-next');assert not next.exists();next.symlink_to(target);os.replace(next,current)
try:
 for rel in ['frontend/dist/index.html',*['frontend/dist/assets/'+n for n in ['attendance-rollcall-stage.js','attendance-rollcall-stage.css','main-rollcall-stage.js']]]:
  url='http://127.0.0.1:5173/'+('' if rel.endswith('index.html') else rel.removeprefix('frontend/dist/'))
  with urllib.request.urlopen(url,timeout=10) as r:assert hashlib.sha256(r.read()).hexdigest()==sha(target/rel)
 with urllib.request.urlopen('http://127.0.0.1:5173/api/v1/health') as r:assert json.load(r)['ok']
except Exception:
 next.symlink_to(base);os.replace(next,current);raise
result={'deployed':True,'current':str(target),'previous':str(base),'backendChanged':False,'databaseChanged':False,'servicesRestarted':False,'newAssets':4,'unchangedFiles':len(before)-1,'scope':'teacher rollcall left stage; settings/backend selection rules preserved','actualServerDrawUnchanged':True,'themesInherited':True,'singleThreeFiveSupported':True,'fullscreen':True,'reducedMotion':True,'attendanceBlurRetained':True,'health':True,'httpHashesVerified':True};(root/'deployment.json').write_text(json.dumps(result,indent=2));print(json.dumps(result))
