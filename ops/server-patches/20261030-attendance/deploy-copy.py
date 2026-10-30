from pathlib import Path
import hashlib,json,os,subprocess,urllib.request
base=Path('/opt/preclass/releases/20261030-attendance');new=Path('/opt/preclass/releases/20261030-attendance-copy');current=Path('/opt/preclass/current');source=Path('/home/ubuntu/attendance-copy.js');relative='frontend/dist/assets/attendance-20261030.js'
assert current.resolve()==base and not new.exists()
data=source.read_bytes();assert '每一位到来，都让风景更完整。'.encode() not in data and '属于全班的共同风景'.encode() not in data
sha=lambda path:hashlib.sha256(path.read_bytes()).hexdigest()
def manifest(root):return {str(p.relative_to(root)):('symlink:'+os.readlink(p) if p.is_symlink() else sha(p)) for p in root.rglob('*') if p.is_symlink() or p.is_file()}
before=manifest(base);subprocess.run(['cp','-a','--reflink=auto',str(base),str(new)],check=True);(new/relative).write_bytes(data);after=manifest(new)
assert [k for k in before if before[k]!=after.get(k)]==[relative] and before.keys()==after.keys()
assert current.resolve()==base and manifest(base)==before
temp=Path('/opt/preclass/.attendance-copy-next');assert not temp.exists() and not temp.is_symlink();temp.symlink_to(new);os.replace(temp,current)
try:
 with urllib.request.urlopen('http://127.0.0.1:5173/assets/attendance-20261030.js',timeout=10) as r:assert hashlib.sha256(r.read()).hexdigest()==after[relative]
except Exception:
 temp.symlink_to(base);os.replace(temp,current);raise
result={'verified':True,'current':str(new),'previous':str(base),'changedFiles':[relative],'unchangedFiles':len(before)-1,'backendRestarted':False,'databaseChanged':False,'marketingCopyRemoved':True}
Path('/home/ubuntu/attendance-copy-deployment.json').write_text(json.dumps(result,indent=2));print(json.dumps(result))
