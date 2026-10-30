from pathlib import Path
import sys,datetime,shutil,subprocess,os,json
app=Path('/opt/preclass/current/backend/dist/backend/src/app.js');caddy=Path('/etc/preclass/Caddyfile-test');s=app.read_text();c=caddy.read_text();anchor='    referenceFileRoutes(app, service);'
assert s.count(anchor)==1 and 'knowledgeMapBridge' not in s,'应用结构不兼容或已安装'
assert c.count('  handle /api/* {')==1 and '/knowledge-map/' not in c,'网关结构不兼容或已安装'
if '--check' in sys.argv:sys.exit(0)
previous=Path('/opt/preclass/current').resolve();release=Path('/opt/preclass/releases')/('knowledge-map-'+datetime.datetime.now().strftime('%Y%m%d%H%M%S'))
shutil.copytree(previous,release,symlinks=True)
target=release/'backend/dist/backend/src/app.js';bridge=target.parent/'knowledge-map-bridge.js';shutil.copyfile(Path(__file__).resolve().parents[1]/'bridge.js',bridge)
target.write_text("import { knowledgeMapBridge } from './knowledge-map-bridge.js';\n"+s.replace(anchor,'    knowledgeMapBridge(app, service, ai);\n'+anchor))
subprocess.run(['/opt/preclass/runtime/node/bin/node','--check',str(target)],check=True)
new=c.replace('  handle /api/* {','  handle_path /knowledge-map/* {\n    reverse_proxy 127.0.0.1:3216\n  }\n  handle /api/* {')
staged=caddy.with_name('Caddyfile-knowledge-map-staged');staged.write_text(new)
subprocess.run(['/opt/preclass/runtime/caddy/caddy','validate','--config',str(staged),'--adapter','caddyfile'],check=True)
backup=caddy.with_name('Caddyfile-before-knowledge-map');assert not backup.exists(),'备份已存在，请人工检查';shutil.copyfile(caddy,backup)
manifest={'previousRelease':str(previous),'moduleRelease':str(release),'caddyBackup':str(backup)}
Path('/opt/preclass/modules/knowledge-map-v1/install-state.json').write_text(json.dumps(manifest,indent=2))
os.symlink(str(release),'/opt/preclass/current.knowledge-map-next');os.replace('/opt/preclass/current.knowledge-map-next','/opt/preclass/current');os.replace(staged,caddy)
