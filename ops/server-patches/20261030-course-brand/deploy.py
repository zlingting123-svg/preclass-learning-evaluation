from pathlib import Path
import hashlib,json,os,subprocess,urllib.request
base=Path('/opt/preclass/releases/20261030-strict-evidence');target=Path('/opt/preclass/releases/20261030-course-brand');current=Path('/opt/preclass/current');root=Path('/home/ubuntu/course-brand-stage');root.mkdir(exist_ok=True)
assert os.geteuid()==0 and current.resolve()==base and not target.exists()
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
def manifest(path):return {str(p.relative_to(path)):('symlink:'+os.readlink(p) if p.is_symlink() else sha(p)) for p in path.rglob('*') if p.is_symlink() or p.is_file()}
before=manifest(base);main=base/'frontend/dist/assets/main-attendance-20261030.js';text=main.read_text(encoding='utf-8');assert text.count('学习空间')==8
replacements={'"学习空间"':'"环境评价与管理"','欢迎回到学习空间':'欢迎来到环境评价与管理','进入学习空间':'进入环境评价与管理','学生学习空间':'学生课程空间','欢迎回到你的学习空间':'欢迎回到环境评价与管理','学习空间 · 外观方案预览':'环境评价与管理 · 外观方案预览'}
for a,b in replacements.items():assert a in text;text=text.replace(a,b)
assert '学习空间' not in text
entry=(base/'frontend/dist/assets/main-entry-attendance-20261030.js').read_text();assert entry.count('main-attendance-20261030.js')==2;entry=entry.replace('main-attendance-20261030.js','main-course-brand-20261030.js')
index=(base/'frontend/dist/index.html').read_text();assert index.count('main-entry-attendance-20261030.js')==1;index=index.replace('main-entry-attendance-20261030.js','main-entry-course-brand-20261030.js').replace('<title>学习平台</title>','<title>环境评价与管理</title>')
subprocess.run(['cp','-a','--reflink=auto',str(base),str(target)],check=True)
files={'frontend/dist/assets/main-course-brand-20261030.js':text,'frontend/dist/assets/main-entry-course-brand-20261030.js':entry,'frontend/dist/index.html':index}
for relative,value in files.items():
 (target/relative).write_text(value,encoding='utf-8',newline='\n')
 if relative.endswith('.js'):subprocess.run(['/opt/preclass/runtime/node/bin/node','--check',str(target/relative)],check=True)
after=manifest(target);assert [p for p in before if before[p]!=after.get(p)]==['frontend/dist/index.html'];assert all(before[p]==after.get(p) for p in before if p!='frontend/dist/index.html');assert len(after.keys()-before.keys())==2
assert current.resolve()==base and manifest(base)==before
next=Path('/opt/preclass/.course-brand-next');assert not next.exists() and not next.is_symlink();next.symlink_to(target);os.replace(next,current)
try:
 for relative in files:
  url='http://127.0.0.1:5173/'+('' if relative.endswith('index.html') else relative.removeprefix('frontend/dist/'))
  with urllib.request.urlopen(url,timeout=8) as response:assert hashlib.sha256(response.read()).hexdigest()==sha(target/relative)
 with urllib.request.urlopen('http://127.0.0.1:5173/api/v1/health',timeout=8) as response:assert json.load(response)['ok']
except Exception:
 next.symlink_to(base);os.replace(next,current);raise
result={'deployed':True,'previous':str(base),'current':str(target),'title':'环境评价与管理','learningSpaceOccurrencesReplaced':8,'browserTitleUpdated':True,'cacheBusting':True,'changedExistingFiles':['frontend/dist/index.html'],'addedAssets':sorted(after.keys()-before.keys()),'unchangedFiles':len(before)-1,'backendRestarted':False,'databaseWritten':False,'httpAssetHashesVerified':True,'health':True,'replacements':replacements}
(root/'deployment.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8');print(json.dumps(result,ensure_ascii=True))
