from pathlib import Path
import subprocess,base64,json
p=Path('C:/Users/96496/Documents/Codex/2026-10-28/outputs-md/work/server-access')
ssh=['ssh','-i',str(p/'preclass-deploy-ed25519'),'-o','UserKnownHostsFile='+str(p/'known_hosts'),'-o','StrictHostKeyChecking=yes','-o','BatchMode=yes','ubuntu@82.157.183.146']
root=Path(__file__).resolve().parent
names=['attendance.after.js','attendance-location.after.js','provisioning.after.js','roster.after.js','questionnaires.after.js','roster-order.js','backend-test.mjs','legacy-test.mjs']
files={n:base64.b64encode((root/n).read_bytes()).decode() for n in names}
script="from pathlib import Path\nimport tempfile,shutil,base64,subprocess,json\nfiles=FILES\nwith tempfile.TemporaryDirectory(prefix='attendance-export-test-') as d:\n root=Path(d);base=Path('/opt/preclass/current/backend');shutil.copytree(base/'dist',root/'dist');shutil.copy(base/'package.json',root/'package.json');(root/'node_modules').symlink_to(base/'node_modules',target_is_directory=True);p=root/'dist/backend/src'\n for name,data in files.items():(p/name.replace('.after.js','.js')).write_bytes(base64.b64decode(data))\n for name in files:\n  if name.endswith('.js'):subprocess.run(['/opt/preclass/runtime/node/bin/node','--check',str(p/name.replace('.after.js','.js'))],check=True)\n results={}\n for name in ['legacy-test.mjs','backend-test.mjs']:\n  result=subprocess.run(['/opt/preclass/runtime/node/bin/node',str(p/name)],cwd=d,capture_output=True,text=True);assert result.returncode==0,result.stderr;results[name]=json.loads(result.stdout)\n print(json.dumps({'passed':True,'results':results,'samples':{n:base64.b64encode((root/n).read_bytes()).decode() for n in ['single.xlsx','aggregate.xlsx']}}))\n".replace('FILES',repr(files))
r=subprocess.run(ssh+['python3','-'],input=script.encode(),capture_output=True,timeout=45);assert r.returncode==0,r.stdout.decode()+r.stderr.decode()
result=json.loads(r.stdout);out=Path('outputs/签到缺勤高亮与排序-2026-11-02')
for name,content in result.pop('samples').items():(out/name).write_bytes(base64.b64decode(content))
from openpyxl import load_workbook
single=load_workbook(out/'single.xlsx');aggregate=load_workbook(out/'aggregate.xlsx')
assert single.worksheets[0]['D2'].fill.fgColor.rgb.endswith('C7CE') is False
assert single.worksheets[0]['D3'].fill.fgColor.rgb.endswith('C7CE')
assert aggregate.worksheets[0]['D3'].fill.fgColor.rgb.endswith('C7CE')
assert aggregate.worksheets[0]['B3'].fill.fgColor.rgb.endswith('C7CE')
assert aggregate.worksheets[0]['G3'].fill.fgColor.rgb.endswith('C7CE')
assert aggregate['未签到名单']['B2'].fill.fgColor.rgb.endswith('C7CE')
result['xlsxStylesVerified']=True;result['productionWrites']=False;(out/'后台隔离验证.json').write_text(json.dumps(result,indent=2),encoding='utf-8');print(json.dumps(result))
