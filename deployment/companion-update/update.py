#!/usr/bin/env python3
"""Offline static-web update. Never executes application code or reads environment/DB files."""
import argparse, contextlib, ctypes, datetime, hashlib, json, os, pathlib, re, shutil, stat, sys, tempfile
BUNDLE=pathlib.Path(__file__).resolve().parent

def fail(message): raise RuntimeError(message)
def files(root):
    root=pathlib.Path(root)
    if not root.is_dir() or root.is_symlink(): fail('Expected a real directory: '+str(root))
    result={}
    for p in sorted(root.rglob('*')):
        if p.is_symlink(): fail('Symlinks are not supported inside static files')
        if p.is_file(): result[p.relative_to(root).as_posix()]=hashlib.sha256(p.read_bytes()).hexdigest()
        elif not p.is_dir(): fail('Unsupported file type')
    return result

def fingerprint(root):
    return hashlib.sha256(json.dumps(files(root),sort_keys=True,separators=(',',':')).encode()).hexdigest()

def manifest():
    m=json.loads((BUNDLE/'manifest.json').read_text())
    if m.get('format')!=1 or m.get('scope')!='companion-module-only': fail('Unsupported update format')
    expected=m['files']; actual=files(BUNDLE);actual.pop('manifest.json',None)
    if actual!=expected: fail('Package checksum/file-list mismatch; extract into a clean directory')
    payload_names=set(files(BUNDLE/'payload'))
    if payload_names!={'module.js','poses.png','walk.png','assets.json','UPSTREAM-LICENSE.txt'}:fail('Only standalone module resources are permitted; no HTML or application files')
    if fingerprint(BUNDLE/'payload')!=m['payloadFingerprint']: fail('Invalid payload')
    return m

def exchange(a,b):
    libc=ctypes.CDLL(None,use_errno=True);a=os.fsencode(a);b=os.fsencode(b)
    if sys.platform=='linux':
        fn=getattr(libc,'renameat2',None)
        if fn is None: fail('Atomic directory exchange is not supported')
        fn.argtypes=[ctypes.c_int,ctypes.c_char_p,ctypes.c_int,ctypes.c_char_p,ctypes.c_uint]
        result=fn(-100,a,-100,b,2)
    elif sys.platform=='darwin':
        fn=getattr(libc,'renamex_np',None)
        if fn is None: fail('Atomic directory exchange is not supported')
        fn.argtypes=[ctypes.c_char_p,ctypes.c_char_p,ctypes.c_uint];result=fn(a,b,2)
    else: fail('Supported update hosts: Linux and macOS')
    if result!=0: raise OSError(ctypes.get_errno(),'Atomic directory exchange failed')

def probe(parent):
    with tempfile.TemporaryDirectory(prefix='.companion-probe-',dir=parent) as tmp:
        a=pathlib.Path(tmp)/'a';b=pathlib.Path(tmp)/'b';a.mkdir();b.mkdir();(a/'a').write_text('a');(b/'b').write_text('b');exchange(a,b)
        if not (a/'b').is_file() or not (b/'a').is_file(): fail('Atomic exchange probe failed')

@contextlib.contextmanager
def locked(parent):
    p=parent/'.companion-update.lock'
    try: p.mkdir(mode=0o700)
    except FileExistsError: fail('Another update or interrupted update lock exists; inspect '+str(p))
    try: yield
    finally: p.rmdir()

def json_write(path,data):
    tmp=path.with_name(path.name+'.tmp');tmp.write_text(json.dumps(data,indent=2)+'\n');tmp.chmod(0o600);os.replace(tmp,path)

def target_path(value):
    p=pathlib.Path(value).absolute()
    if p.is_symlink(): fail('Module target itself cannot be a symlink')
    p=p.parent.resolve()/p.name
    if p.name!='ai-companion' or p.parent.name not in ['dist','public'] or not p.parent.is_dir(): fail('Target must be existing web-root/dist or public plus /ai-companion')
    return p

def current_fingerprint(target): return fingerprint(target) if target.exists() else None
def private_root(target): return target.parent.parent
def receipt_path(target): return private_root(target)/('.ai-companion-state-'+target.parent.name+'.json')

def install(target,m,expected=None,dry=False):
    with locked(private_root(target)):
        current=current_fingerprint(target);receipt=receipt_path(target)
        if receipt.exists():
            r=json.loads(receipt.read_text())
            if r.get('packageId')==m['packageId'] and r.get('afterFingerprint')==current:
                print(json.dumps({'status':'already_installed','packageId':m['packageId'],'target':str(target)}));return
        allowed={None,m['payloadFingerprint']}
        if receipt.exists() and r.get('target')==str(target) and r.get('afterFingerprint')==current:allowed.add(current)
        if expected:
            if not re.fullmatch('[a-f0-9]{64}',expected): fail('Invalid expected fingerprint')
            allowed.add(expected)
        if current not in allowed: fail('Existing module was modified or is unrecognized. Review before replacing. Current fingerprint: '+current)
        probe(target.parent)
        if dry:
            print(json.dumps({'status':'ready','beforeFingerprint':current,'target':str(target)}));return
        parent=private_root(target)/'.ai-companion-backups';parent.mkdir(mode=0o700,exist_ok=True)
        if parent.is_symlink(): fail('Backup directory cannot be a symlink')
        parent.chmod(0o700)
        backup_id=datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')+'-'+m['packageId']
        backup=parent/backup_id;backup.mkdir(mode=0o700);stage=pathlib.Path(tempfile.mkdtemp(prefix='.companion-stage-',dir=target.parent))
        swapped=False
        try:
            if current is not None:
                shutil.copytree(target,backup/'before')
                if fingerprint(backup/'before')!=current: fail('Backup validation failed')
            shutil.copytree(BUNDLE/'payload',stage,dirs_exist_ok=True)
            for p in [stage,*stage.rglob('*')]:p.chmod(0o755 if p.is_dir() else 0o644)
            after=fingerprint(stage)
            record={'packageId':m['packageId'],'target':str(target),'beforeFingerprint':current,'afterFingerprint':after,'backupId':backup_id}
            json_write(backup/'metadata.json',record)
            if current_fingerprint(target)!=current: fail('Web files changed during preparation; update cancelled')
            if current is None: os.rename(stage,target)
            else: exchange(target,stage)
            swapped=True
            if fingerprint(target)!=after: fail('Post-install checksum failed')
            json_write(receipt,record)
            print(json.dumps({'status':'installed',**record}))
        except BaseException:
            if swapped:
                if current is None: os.rename(target,stage)
                else: exchange(target,stage)
            raise
        finally:
            shutil.rmtree(stage,ignore_errors=True)

def rollback(target,backup_id):
    if not re.fullmatch(r'[A-Za-z0-9_.-]+',backup_id): fail('Invalid backup identifier')
    with locked(private_root(target)):
        backup=private_root(target)/'.ai-companion-backups'/backup_id
        if backup.is_symlink(): fail('Backup cannot be a symlink')
        r=json.loads((backup/'metadata.json').read_text())
        if r['target']!=str(target): fail('Backup belongs to another target')
        if fingerprint(target)!=r['afterFingerprint']: fail('Web files changed after installation; refusing rollback over newer work')
        if r['beforeFingerprint'] is not None and fingerprint(backup/'before')!=r['beforeFingerprint']: fail('Backup checksum mismatch')
        probe(target.parent);stage=pathlib.Path(tempfile.mkdtemp(prefix='.companion-rollback-',dir=target.parent));swapped=False
        try:
            if r['beforeFingerprint'] is not None: shutil.copytree(backup/'before',stage,dirs_exist_ok=True)
            for p in [stage,*stage.rglob('*')]:p.chmod(0o755 if p.is_dir() else 0o644)
            if r['beforeFingerprint'] is not None and fingerprint(stage)!=r['beforeFingerprint']: fail('Restore checksum mismatch')
            if r['beforeFingerprint'] is None: os.rename(target,stage/'removed-module')
            else: exchange(target,stage)
            swapped=True
            json_write(receipt_path(target),{'status':'rolled_back','backupId':backup_id,'target':str(target)})
            print(json.dumps({'status':'rolled_back','backupId':backup_id,'fingerprint':current_fingerprint(target)}))
        except BaseException:
            if swapped:
                if r['beforeFingerprint'] is None: os.rename(stage/'removed-module',target)
                else: exchange(target,stage)
            raise
        finally:shutil.rmtree(stage,ignore_errors=True)

def main():
    parser=argparse.ArgumentParser();parser.add_argument('action',choices=['check','fingerprint','install','rollback'],nargs='?',default='install');parser.add_argument('--target',default='/opt/preclass/current/frontend/dist/ai-companion');parser.add_argument('--expected-current-sha256');parser.add_argument('--backup-id');parser.add_argument('--dry-run',action='store_true');a=parser.parse_args()
    if a.action=='check':m=manifest();print(json.dumps({'status':'package_verified','packageId':m['packageId']}));return
    target=target_path(a.target)
    if a.action=='fingerprint':print(fingerprint(target));return
    m=manifest()
    if a.action=='rollback':
        if not a.backup_id:fail('Provide --backup-id from the installation receipt')
        rollback(target,a.backup_id)
    else:install(target,m,a.expected_current_sha256,a.dry_run)

if __name__=='__main__':
    try:main()
    except Exception as e:print('Update refused: '+str(e),file=sys.stderr);sys.exit(1)
