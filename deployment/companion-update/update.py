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
    if m.get('format')!=1 or m.get('scope')!='frontend-only': fail('Unsupported update format')
    expected=m['files']; actual=files(BUNDLE);actual.pop('manifest.json',None)
    if actual!=expected: fail('Package checksum/file-list mismatch; extract into a clean directory')
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
    if p.is_symlink(): fail('Static target itself must be a real directory')
    p=p.resolve()
    if not (p/'design-preview.html').is_file() or not (p/'index.html').is_file(): fail('Target is not an existing learning-space dist directory')
    if p.name!='dist': fail('Target must be the existing frontend/dist directory')
    return p

def install(target,m,expected=None,dry=False):
    with locked(target.parent):
        current=fingerprint(target);receipt=target.parent/'.companion-update-state.json'
        if receipt.exists():
            r=json.loads(receipt.read_text())
            if r.get('packageId')==m['packageId'] and r.get('afterFingerprint')==current:
                print(json.dumps({'status':'already_installed','packageId':m['packageId'],'target':str(target)}));return
        allowed=set(m['baseFingerprints']+[m['payloadFingerprint']])
        if expected:
            if not re.fullmatch('[a-f0-9]{64}',expected): fail('Invalid expected fingerprint')
            allowed.add(expected)
        if current not in allowed: fail('Current web files differ from the supported base. STOP and compare server changes. Current fingerprint: '+current)
        probe(target.parent)
        if dry:
            print(json.dumps({'status':'ready','beforeFingerprint':current,'target':str(target)}));return
        parent=target.parent/'.companion-update-backups';parent.mkdir(mode=0o700,exist_ok=True)
        if parent.is_symlink(): fail('Backup directory cannot be a symlink')
        parent.chmod(0o700)
        backup_id=datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')+'-'+m['packageId']
        backup=parent/backup_id;backup.mkdir(mode=0o700);stage=pathlib.Path(tempfile.mkdtemp(prefix='.companion-stage-',dir=target.parent))
        swapped=False
        try:
            shutil.copytree(target,backup/'before')
            if fingerprint(backup/'before')!=current: fail('Backup validation failed')
            shutil.copytree(BUNDLE/'payload',stage,dirs_exist_ok=True)
            # Keep fingerprint-named assets needed by already-open browser tabs.
            for p in (target/'assets').rglob('*') if (target/'assets').is_dir() else []:
                if p.is_file():
                    dest=stage/'assets'/p.relative_to(target/'assets')
                    if not dest.exists(): dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(p,dest)
            for p in [stage,*stage.rglob('*')]:p.chmod(0o755 if p.is_dir() else 0o644)
            after=fingerprint(stage)
            record={'packageId':m['packageId'],'target':str(target),'beforeFingerprint':current,'afterFingerprint':after,'backupId':backup_id}
            json_write(backup/'metadata.json',record)
            if fingerprint(target)!=current: fail('Web files changed during preparation; update cancelled')
            exchange(target,stage);swapped=True
            if fingerprint(target)!=after: fail('Post-install checksum failed')
            json_write(receipt,record)
            print(json.dumps({'status':'installed',**record}))
        except BaseException:
            if swapped: exchange(target,stage)
            raise
        finally:
            shutil.rmtree(stage,ignore_errors=True)

def rollback(target,backup_id):
    if not re.fullmatch(r'[A-Za-z0-9_.-]+',backup_id): fail('Invalid backup identifier')
    with locked(target.parent):
        backup=target.parent/'.companion-update-backups'/backup_id
        if backup.is_symlink(): fail('Backup cannot be a symlink')
        r=json.loads((backup/'metadata.json').read_text())
        if r['target']!=str(target): fail('Backup belongs to another target')
        if fingerprint(target)!=r['afterFingerprint']: fail('Web files changed after installation; refusing rollback over newer work')
        if fingerprint(backup/'before')!=r['beforeFingerprint']: fail('Backup checksum mismatch')
        probe(target.parent);stage=pathlib.Path(tempfile.mkdtemp(prefix='.companion-rollback-',dir=target.parent));swapped=False
        try:
            shutil.copytree(backup/'before',stage,dirs_exist_ok=True)
            for p in [stage,*stage.rglob('*')]:p.chmod(0o755 if p.is_dir() else 0o644)
            if fingerprint(stage)!=r['beforeFingerprint']: fail('Restore checksum mismatch')
            exchange(target,stage);swapped=True
            json_write(target.parent/'.companion-update-state.json',{'status':'rolled_back','backupId':backup_id,'target':str(target)})
            print(json.dumps({'status':'rolled_back','backupId':backup_id,'fingerprint':fingerprint(target)}))
        except BaseException:
            if swapped:exchange(target,stage)
            raise
        finally:shutil.rmtree(stage,ignore_errors=True)

def main():
    parser=argparse.ArgumentParser();parser.add_argument('action',choices=['check','fingerprint','install','rollback'],nargs='?',default='install');parser.add_argument('--target',default='/opt/preclass/current/frontend/dist');parser.add_argument('--expected-current-sha256');parser.add_argument('--backup-id');parser.add_argument('--dry-run',action='store_true');a=parser.parse_args()
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
