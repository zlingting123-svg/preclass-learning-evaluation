from pathlib import Path
import hashlib,json,os,shutil,subprocess
root=Path('/home/ubuntu/km-atlas-stage');base=Path('/opt/preclass/releases/20261030-knowledge-map-v060');target=Path('/opt/preclass/releases/20261031-knowledge-atlas');module=Path('/opt/preclass/modules/knowledge-map-atlas1');assert Path('/opt/preclass/current').resolve()==base
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
def manifest(p):return {str(f.relative_to(p)):('symlink:'+os.readlink(f) if f.is_symlink() else sha(f)) for f in p.rglob('*') if f.is_symlink() or f.is_file()}
assert not target.exists() and not module.exists()
shutil.copytree('/opt/preclass/modules/knowledge-map-v060',module,symlinks=True,ignore=shutil.ignore_patterns('__pycache__','*.pyc','work'))
for f in (root/'module-patch').rglob('*'):
 if f.is_file():dest=module/f.relative_to(root/'module-patch');dest.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(f,dest)
for f in module.rglob('*'):
 if not f.is_symlink():f.chmod(0o755 if f.is_dir() else 0o644)
module.chmod(0o755)
before=manifest(base);subprocess.run(['cp','-a','--reflink=auto',str(base),str(target)],check=True)
a=target/'frontend/dist/assets';s=(a/'main-knowledge-map-060.js').read_text();anchor='title:"课程知识图谱",onLoad:send';assert s.count(anchor)==1;s=s.replace(anchor,'title:"课程知识图谱",allowFullScreen:!0,onLoad:send');(a/'main-knowledge-atlas-1.js').write_text(s)
s=(a/'main-entry-knowledge-map-060.js').read_text().replace('main-knowledge-map-060.js','main-knowledge-atlas-1.js');(a/'main-entry-knowledge-atlas-1.js').write_text(s)
p=target/'frontend/dist/index.html';p.write_text(p.read_text().replace('main-entry-knowledge-map-060.js','main-entry-knowledge-atlas-1.js'))
after=manifest(target);assert [p for p in before if before[p]!=after.get(p)]==['frontend/dist/index.html'];assert len(set(after)-set(before))==2
(root/'stage.json').write_text(json.dumps({'base':str(base),'target':str(target),'module':str(module),'before':before,'after':after}))
tools=Path('/opt/preclass/testing/km-atlas');tools.mkdir(parents=True,exist_ok=True)
s=(root/'test-host.mjs').read_text().replace(str(base),str(target)).replace('km-v060-test-host','km-atlas-test-host');(tools/'test-host.mjs').write_text(s)
s=(root/'Caddyfile-stage').read_text().replace(str(base),str(target));(tools/'Caddyfile-stage').write_text(s)
for folder in ['host','module']:subprocess.run(['install','-d','-o','preclass','-g','preclass','-m','700','/var/lib/preclass/km-atlas-test-'+folder],check=True)
common=['--property=User=preclass','--property=NoNewPrivileges=true','--property=PrivateTmp=true','--property=ProtectSystem=strict','--property=ProtectHome=true']
subprocess.run(['systemd-run','--unit=km-atlas-test-host',*common,'--property=ReadWritePaths=/var/lib/preclass/km-atlas-test-host','/opt/preclass/runtime/node/bin/node',str(tools/'test-host.mjs')],check=True)
subprocess.run(['systemd-run','--unit=km-atlas-test-module',*common,'--property=ReadWritePaths=/var/lib/preclass/km-atlas-test-module','--property=WorkingDirectory='+str(module),'--setenv=KM_DATA=/var/lib/preclass/km-atlas-test-module','--setenv=KM_HOST_API=http://127.0.0.1:3022/api/v1','--setenv=KM_PORT=3218','--setenv=OMP_THREAD_LIMIT=1',str(module/'venv/bin/python'),'server.py'],check=True)
subprocess.run(['systemd-run','--unit=km-atlas-test-web',*common,'/opt/preclass/runtime/caddy/caddy','run','--config',str(tools/'Caddyfile-stage'),'--adapter','caddyfile'],check=True)
print('Staged source atlas; production unchanged; isolated test services started')
