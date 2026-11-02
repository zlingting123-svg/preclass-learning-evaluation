import os
from pathlib import Path
import subprocess,base64,json,sys
r=Path(__file__).resolve().parent
local='--local' in sys.argv
out=Path('outputs/小组评分弹窗精简-2026-11-02')
if local:
    snapshot=Path('C:/Users/96496/Documents/Codex/2026-10-28/outputs-md/work/deepseek-live-source/preclass-learning-evaluation-ddc55257eccf2aba137f4e38ce3f645393eb54a1/backend')
    stage=r/'backend-local';stage.mkdir(exist_ok=True)
    (stage/'package.json').write_text('{"type":"module"}',encoding='utf-8')
    for n in ['store.js','errors.js']:(stage/n).write_bytes((snapshot/'dist/backend/src'/n).read_bytes())
    for src,dst in [('groups.after.js','groups.js'),('group-board.after.js','group-board.js'),('group-transfer.after.js','group-transfer.js'),('backend-test.mjs','backend-test.mjs')]: (stage/dst).write_bytes((r/src).read_bytes())
    for n in ['group-activities.js','group-export.js']:(stage/n).write_bytes((Path('work/group-display')/n).read_bytes())
    assert (stage/'node_modules').exists(),'Use a junction to the already installed backend node_modules'
    proc=subprocess.run(['node',str(stage/'backend-test.mjs')],capture_output=True,text=True,timeout=20)
else:
    a=Path('C:/Users/96496/Documents/Codex/2026-10-28/outputs-md/work/server-access')
    ssh=['ssh','-i',str(a/'preclass-deploy-ed25519'),'-o','UserKnownHostsFile='+str(a/'known_hosts'),'-o','StrictHostKeyChecking=yes','-o','BatchMode=yes','-o','ConnectTimeout=10','ubuntu@82.157.183.146']
    if os.environ.get('PRECLASS_SSH_BIND'):ssh[1:1]=['-b',os.environ['PRECLASS_SSH_BIND']]
    files={n:base64.b64encode((r/n).read_bytes()).decode() for n in ['groups.after.js','group-board.after.js','group-transfer.after.js','backend-test.mjs']}
    script='''from pathlib import Path
import tempfile,shutil,base64,subprocess
files=FILES
with tempfile.TemporaryDirectory(prefix='group-ui-test-') as d:
 root=Path(d);base=Path('/opt/preclass/current/backend');shutil.copytree(base/'dist',root/'dist');shutil.copy(base/'package.json',root/'package.json');(root/'node_modules').symlink_to(base/'node_modules',target_is_directory=True);p=root/'dist/backend/src'
 for src,dst in [('groups.after.js','groups.js'),('group-board.after.js','group-board.js'),('group-transfer.after.js','group-transfer.js'),('backend-test.mjs','backend-test.mjs')]: (p/dst).write_bytes(base64.b64decode(files[src]))
 x=subprocess.run(['/opt/preclass/runtime/node/bin/node',str(p/'backend-test.mjs')],cwd=d,capture_output=True,text=True);assert x.returncode==0,x.stderr;print(x.stdout)
'''.replace('FILES',repr(files))
    proc=subprocess.run(ssh+['python3 -'],input=script,capture_output=True,text=True,encoding='utf-8',timeout=30)
assert proc.returncode==0,proc.stderr
result=json.loads(proc.stdout.strip());assert result['passed'];result.update(environment='local-backend-snapshot' if local else 'cloud-backend-snapshot',productionWrites=False)
(out/('后台本地验证.json' if local else '后台隔离验证.json')).write_text(json.dumps(result,indent=2),encoding='utf-8');print(json.dumps(result))
