import hashlib,json,os,sys
from pathlib import Path
root=Path(sys.argv[1]).resolve();m=json.loads((root/'manifest.json').read_text())
if m.get('format')!=1 or not m.get('commit'): raise ValueError('Invalid package manifest')
expected={f['path']:f for f in m['files']}
if len(expected)!=len(m['files']): raise ValueError('Duplicate manifest entries')
actual=set()
for folder,dirs,files in os.walk(root,followlinks=False):
    for name in dirs+files:
        p=Path(folder)/name;key=p.relative_to(root).as_posix()
        if key=='manifest.json':continue
        if p.is_symlink():
            if root not in p.resolve(strict=True).parents:raise ValueError('External symlink')
            actual.add(key)
            if expected.get(key,{}).get('link')!=os.readlink(p):raise ValueError('Symlink mismatch')
        elif p.is_file():
            actual.add(key);h=hashlib.sha256()
            with p.open('rb') as src:
                for chunk in iter(lambda:src.read(1048576),b''):h.update(chunk)
            if expected.get(key,{}).get('sha256')!=h.hexdigest():raise ValueError('File hash mismatch: '+key)
        elif not p.is_dir():raise ValueError('Unsupported package entry')
if actual!=set(expected):raise ValueError('Missing or additional package files')
print('PASS package integrity: '+m['commit'])
