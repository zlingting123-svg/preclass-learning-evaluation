from pathlib import Path
import os,hashlib,json,subprocess
root=Path('/home/ubuntu/course-review-stage');base=Path('/opt/preclass/releases/20261031-cau-identity-hd');target=Path('/opt/preclass/releases/20261031-course-review');assert Path('/opt/preclass/current').resolve()==base and not target.exists()
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
def manifest(p):return {str(f.relative_to(p)):('symlink:'+os.readlink(f) if f.is_symlink() else sha(f)) for f in p.rglob('*') if f.is_symlink() or f.is_file()}
for before,rel in [('strict.before.js','backend/dist/backend/src/strict-knowledge.js'),('deepseek.before.js','ai-module/dist/src/deepseek.js'),('gateway.before.js','ai-module/dist/src/gateway.js')]:assert sha(root/before)==sha(base/rel)
before=manifest(base);subprocess.run(['cp','-a','--reflink=auto',str(base),str(target)],check=True)
mapping={'strict-knowledge.js':'backend/dist/backend/src/strict-knowledge.js','course-review.js':'backend/dist/backend/src/course-review.js','deepseek.js':'ai-module/dist/src/deepseek.js','gateway.js':'ai-module/dist/src/gateway.js','main-course-review.js':'frontend/dist/assets/main-course-review.js','course-review-layout.css':'frontend/dist/assets/course-review-layout.css'}
for name,rel in mapping.items():(target/rel).write_bytes((root/name).read_bytes())
a=target/'frontend/dist/assets';s=(a/'main-entry-cau-identity-hd.js').read_text().replace('main-cau-identity-hd.js','main-course-review.js');(a/'main-entry-course-review.js').write_text(s);p=target/'frontend/dist/index.html';p.write_text(p.read_text().replace('main-entry-cau-identity-hd.js','main-entry-course-review.js'))
for rel in [*mapping.values(),'frontend/dist/assets/main-entry-course-review.js']:
 if rel.endswith('.js'):subprocess.run(['/opt/preclass/runtime/node/bin/node','--check',str(target/rel)],check=True)
after=manifest(target);assert {p for p in before if before[p]!=after.get(p)}=={'frontend/dist/index.html','backend/dist/backend/src/strict-knowledge.js','ai-module/dist/src/deepseek.js','ai-module/dist/src/gateway.js'};assert len(set(after)-set(before))==4
(root/'stage.json').write_text(json.dumps({'base':str(base),'target':str(target),'before':before,'after':after}));print('Candidate staged, production unchanged')
