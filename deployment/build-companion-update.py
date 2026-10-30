#!/usr/bin/env python3
import argparse,hashlib,json,pathlib,shutil,subprocess,tarfile,tempfile,sys,importlib.util
sys.dont_write_bytecode=True
ROOT=pathlib.Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('updater',ROOT/'deployment/companion-update/update.py');u=importlib.util.module_from_spec(spec);spec.loader.exec_module(u)
a=argparse.ArgumentParser();a.add_argument('--module-dir',default=str(ROOT/'work/companion-module-payload'));a.add_argument('--output',required=True);args=a.parse_args()
git=shutil.which('git');commit=subprocess.check_output([git,'rev-parse','HEAD'],cwd=ROOT,text=True).strip()
if subprocess.check_output([git,'status','--porcelain'],cwd=ROOT,text=True).strip():raise SystemExit('Build from a clean committed source tree')
module=pathlib.Path(args.module_dir).resolve();out=pathlib.Path(args.output).resolve();out.mkdir(parents=True,exist_ok=True)
with tempfile.TemporaryDirectory(dir=out,prefix='bundle-') as tmp:
 b=pathlib.Path(tmp)
 for f in ['install.sh','update.py','README.md','INTEGRATION.md']:shutil.copy2(ROOT/'deployment/companion-update'/f,b/f)
 shutil.copytree(module,b/'payload')
 if not (b/'payload/poses.png').is_file() or not (b/'payload/walk.png').is_file():raise SystemExit('Build the standalone module first')
 m={'format':1,'scope':'companion-module-only','packageId':'companion-v05-'+commit[:12],'commit':commit,'payloadFingerprint':u.fingerprint(b/'payload'),'files':u.files(b)}
 (b/'manifest.json').write_text(json.dumps(m,indent=2)+'\n')
 name='preclass-companion-module-'+commit[:12]+'.tar.gz';archive=out/name
 with tarfile.open(archive,'w:gz') as tf:
  for p in sorted(b.rglob('*')):
   def clean(info):
    info.uid=info.gid=0;info.uname=info.gname='';info.mtime=0;return info
   tf.add(p,arcname=p.relative_to(b).as_posix(),recursive=False,filter=clean)
 sha=hashlib.sha256(archive.read_bytes()).hexdigest();(out/(name+'.sha256')).write_text(sha+'  '+name+'\n')
 info={'archive':name,'sha256':sha,'bytes':archive.stat().st_size,'sourceCommit':commit,'scope':'companion-module-only','payloadFingerprint':m['payloadFingerprint'],'packageId':m['packageId']}
 (out/'update-info.json').write_text(json.dumps(info,indent=2)+'\n');shutil.copy2(b/'README.md',out/'INSTALL.md');shutil.copy2(b/'INTEGRATION.md',out/'INTEGRATION.md');print(json.dumps(info))
