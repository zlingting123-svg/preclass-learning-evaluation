from pathlib import Path
import hashlib,json,os,subprocess,urllib.request
root=Path('/home/ubuntu/attendance-blur-stage');base=Path('/opt/preclass/releases/20261031-knowledge-atlas');target=Path('/opt/preclass/releases/20261031-attendance-blur');current=Path('/opt/preclass/current');assert current.resolve()==base and not target.exists();assert json.loads((root/'验证.json').read_text(encoding='utf-8-sig'))['passed']
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
def manifest(p):return {str(f.relative_to(p)):('symlink:'+os.readlink(f) if f.is_symlink() else sha(f)) for f in p.rglob('*') if f.is_symlink() or f.is_file()}
before=manifest(base);assert sha(base/'frontend/dist/assets/attendance-20261030.js')=='42cdb72a526f36769a7c8ac4d244156cbbc818f3ad64e721a26ea508fbbc0df4';subprocess.run(['cp','-a','--reflink=auto',str(base),str(target)],check=True)
a=target/'frontend/dist/assets'
for name in ['attendance-blur-1.js','attendance-blur-1.css']:(a/name).write_bytes((root/name).read_bytes())
s=(a/'main-knowledge-atlas-1.js').read_text();assert s.count('./attendance-20261030.js')==1;s=s.replace('./attendance-20261030.js','./attendance-blur-1.js');(a/'main-classroom-blur-1.js').write_text(s)
s=(a/'main-entry-knowledge-atlas-1.js').read_text().replace('main-knowledge-atlas-1.js','main-classroom-blur-1.js');(a/'main-entry-classroom-blur-1.js').write_text(s)
p=target/'frontend/dist/index.html';p.write_text(p.read_text().replace('main-entry-knowledge-atlas-1.js','main-entry-classroom-blur-1.js'));after=manifest(target);assert [p for p in before if before[p]!=after.get(p)]==['frontend/dist/index.html'];assert len(set(after)-set(before))==4
for name in ['attendance-blur-1.js','main-classroom-blur-1.js','main-entry-classroom-blur-1.js']:subprocess.run(['/opt/preclass/runtime/node/bin/node','--check',str(a/name)],check=True)
assert manifest(base)==before and current.resolve()==base
next=Path('/opt/preclass/.attendance-blur-next');assert not next.exists();next.symlink_to(target);os.replace(next,current)
try:
 for relative in ['frontend/dist/index.html',*[str((a/n).relative_to(target)) for n in ['attendance-blur-1.js','attendance-blur-1.css','main-classroom-blur-1.js']]]:
  url='http://127.0.0.1:5173/'+('' if relative.endswith('index.html') else relative.split('frontend/dist/')[1])
  with urllib.request.urlopen(url,timeout=10) as r:assert hashlib.sha256(r.read()).hexdigest()==sha(target/relative)
 with urllib.request.urlopen('http://127.0.0.1:5173/api/v1/health') as r:assert json.load(r)['ok']
except Exception:
 next.symlink_to(base);os.replace(next,current);raise
result={'deployed':True,'current':str(target),'previous':str(base),'sourceAtlasRetained':True,'backendChanged':False,'restartedServices':False,'databaseChanged':False,'imageUpload':'admin','teacherBlurRange':[0,32],'defaultBlur':14,'preferenceStorage':'browser per class','newAssets':4,'unchangedFiles':len(before)-1,'health':True};(root/'deployment.json').write_text(json.dumps(result,indent=2));print(json.dumps(result))
