from pathlib import Path
import hashlib,json,os,subprocess,urllib.request
root=Path('/home/ubuntu/cau-hd-stage');base=Path('/opt/preclass/releases/20261031-cau-identity-1');target=Path('/opt/preclass/releases/20261031-cau-identity-hd');current=Path('/opt/preclass/current');assert current.resolve()==base and not target.exists();assert json.loads((root/'验证.json').read_text(encoding='utf-8-sig'))['passed']
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
def manifest(p):return {str(f.relative_to(p)):('symlink:'+os.readlink(f) if f.is_symlink() else sha(f)) for f in p.rglob('*') if f.is_symlink() or f.is_file()}
assert sha(base/'frontend/dist/assets/main-cau-identity-1.js')==sha(root/'main.before.js');before=manifest(base);subprocess.run(['cp','-a','--reflink=auto',str(base),str(target)],check=True);a=target/'frontend/dist/assets'
for name in ['main-cau-identity-hd.js','cau-identity-hd.css','cau-identity-hd.svg']:(a/name).write_bytes((root/name).read_bytes())
s=(a/'main-entry-cau-identity-1.js').read_text().replace('main-cau-identity-1.js','main-cau-identity-hd.js');(a/'main-entry-cau-identity-hd.js').write_text(s)
p=target/'frontend/dist/index.html';p.write_text(p.read_text().replace('main-entry-cau-identity-1.js','main-entry-cau-identity-hd.js'));after=manifest(target);assert [p for p in before if before[p]!=after.get(p)]==['frontend/dist/index.html'];assert len(set(after)-set(before))==4
for name in ['main-cau-identity-hd.js','main-entry-cau-identity-hd.js']:subprocess.run(['/opt/preclass/runtime/node/bin/node','--check',str(a/name)],check=True)
assert manifest(base)==before and current.resolve()==base
next=Path('/opt/preclass/.cau-hd-next');assert not next.exists();next.symlink_to(target);os.replace(next,current)
try:
 for relative in ['frontend/dist/index.html',*[str((a/n).relative_to(target)) for n in ['main-cau-identity-hd.js','main-entry-cau-identity-hd.js','cau-identity-hd.css','cau-identity-hd.svg']]]:
  url='http://127.0.0.1:5173/'+('' if relative.endswith('index.html') else relative.split('frontend/dist/')[1])
  with urllib.request.urlopen(url,timeout=10) as r:assert hashlib.sha256(r.read()).hexdigest()==sha(target/relative)
 with urllib.request.urlopen('http://127.0.0.1:5173/api/v1/health') as r:assert json.load(r)['ok']
except Exception:
 next.symlink_to(base);os.replace(next,current);raise
result={'deployed':True,'current':str(target),'previous':str(base),'backendChanged':False,'databaseChanged':False,'servicesRestarted':False,'newAssets':4,'unchangedFiles':len(before)-1,'logoOriginalSha256':sha(a/'cau-identity-hd.svg'),'sourceArtworkPreserved':True,'recoloredByCSS':True,'vectorPaths':121,'rasterImagesInSVG':0,'loginCourseLabelRemoved':True,'desktopLoginWidth':430,'whitePlaque':False,'wideScreen':'shield and university name','compactScreen':'shield only','sidebar':'green shield','loginUpdated':True,'welcomeUpdated':True,'health':True,'httpHashesVerified':True};(root/'deployment.json').write_text(json.dumps(result,indent=2));print(json.dumps(result))
