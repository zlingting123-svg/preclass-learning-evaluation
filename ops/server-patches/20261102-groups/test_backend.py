from pathlib import Path
import subprocess,base64,json
p=Path('C:/Users/96496/Documents/Codex/2026-10-28/outputs-md/work/server-access')
ssh=['ssh','-i',str(p/'preclass-deploy-ed25519'),'-o','UserKnownHostsFile='+str(p/'known_hosts'),'-o','StrictHostKeyChecking=yes','-o','BatchMode=yes','ubuntu@82.157.183.146']
root=Path(__file__).resolve().parent
files={x:base64.b64encode((root/x).read_bytes()).decode() for x in ['groups.js','group-export.js','backend-test.mjs']}
script='''from pathlib import Path
import tempfile,shutil,base64,subprocess
files=FILES
with tempfile.TemporaryDirectory(prefix='survey-delete-test-') as d:
 root=Path(d);base=Path('/opt/preclass/current/backend');shutil.copytree(base/'dist',root/'dist');shutil.copy(base/'package.json',root/'package.json');(root/'node_modules').symlink_to(base/'node_modules',target_is_directory=True);p=root/'dist/backend/src'
 for src,dst in [('groups.js','groups.js'),('group-export.js','group-export.js'),('backend-test.mjs','backend-test.mjs')]: (p/dst).write_bytes(base64.b64decode(files[src]))
 r=subprocess.run(['/opt/preclass/runtime/node/bin/node',str(p/'backend-test.mjs')],cwd=d,capture_output=True,text=True);print(r.stdout);print(r.stderr);assert r.returncode==0
 import zipfile,xml.etree.ElementTree as ET
 with zipfile.ZipFile(root/'groups-test.docx') as z: assert z.testzip() is None;ET.fromstring(z.read('word/document.xml'))
'''.replace('FILES',repr(files))
r=subprocess.run(ssh+['python3','-'],input=script.encode(),capture_output=True,timeout=30);print(r.stdout.decode());print(r.stderr.decode());assert r.returncode==0
result=json.loads(r.stdout.decode().strip());assert result['passed'];Path('outputs/分组与展示评分-2026-11-02/后台隔离验证.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
