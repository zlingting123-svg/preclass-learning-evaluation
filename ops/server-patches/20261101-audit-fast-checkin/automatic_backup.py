#!/usr/bin/env python3
"""Private same-host backups. External replication and full-app restore remain separate."""
from pathlib import Path
from datetime import datetime,timezone
import os,json,sqlite3,hashlib,tempfile,shutil,fcntl

ROOT=Path('/var/backups/preclass/automatic')
MARKER='preclass-automatic-backup-v1'
def sha(path):
 h=hashlib.sha256()
 with path.open('rb') as f:
  for block in iter(lambda:f.read(1024*1024),b''):h.update(block)
 return h.hexdigest()
def database(source,target):
 target.parent.mkdir(parents=True,exist_ok=True,mode=0o700)
 with sqlite3.connect(source.resolve().as_uri()+'?mode=ro',uri=True,timeout=20) as src:
  with sqlite3.connect(target) as dst:src.backup(dst,pages=256,sleep=.02)
 with sqlite3.connect(target.as_uri()+'?mode=ro',uri=True) as c:
  if c.execute('PRAGMA integrity_check').fetchone()[0]!='ok':raise RuntimeError('Database integrity check failed')
 os.chmod(target,0o600)
def run():
 ROOT.mkdir(parents=True,exist_ok=True,mode=0o700);os.chmod(ROOT,0o700)
 with (ROOT/'.backup.lock').open('a') as lock:
  fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
  stamp=datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
  target=ROOT/('auto-'+stamp);assert not target.exists()
  temp_handle=tempfile.TemporaryDirectory(prefix='.partial-',dir=ROOT)
  temp=Path(temp_handle.name);files={};skipped=[];dbs=[]
  for source_root,label in [(Path('/var/lib/preclass'),'data'),(Path('/etc/preclass'),'config')]:
   if not source_root.is_dir():raise RuntimeError('Required backup directory missing')
   for source in sorted(source_root.rglob('*')):
    if source.is_symlink():skipped.append(label+'/'+str(source.relative_to(source_root)));continue
    if not source.is_file():continue
    rel=Path(label)/source.relative_to(source_root)
    if source.name.endswith(('-wal','-shm','.owner','.tmp')):continue
    dest=temp/rel;dest.parent.mkdir(parents=True,exist_ok=True,mode=0o700)
    if source.suffix=='.sqlite':database(source,dest);dbs.append(str(rel))
    else:
     for attempt in range(3):
      before=source.stat();shutil.copyfile(source,dest);after=source.stat()
      if (before.st_size,before.st_mtime_ns)==(after.st_size,after.st_mtime_ns):break
     else:raise RuntimeError('Source changed repeatedly; retry backup later')
     os.chmod(dest,0o600)
    files[str(rel)]={'bytes':dest.stat().st_size,'sha256':sha(dest)}
  required=['data/app.sqlite','data/ai/metadata.sqlite','data/knowledge-map/maps.sqlite']
  if not all(x in files for x in required):raise RuntimeError('Required database missing from backup')
  # Restore all copied files to an isolated temporary tree and check bytes and databases.
  with tempfile.TemporaryDirectory(prefix='.restore-check-',dir=ROOT) as folder:
   restored=Path(folder)
   for rel,info in files.items():
    dst=restored/rel;dst.parent.mkdir(parents=True,exist_ok=True,mode=0o700);shutil.copyfile(temp/rel,dst)
    if sha(dst)!=info['sha256']:raise RuntimeError('Restore checksum mismatch')
   for rel in dbs:
    with sqlite3.connect((restored/rel).as_uri()+'?mode=ro',uri=True) as c:
     if c.execute('PRAGMA integrity_check').fetchone()[0]!='ok':raise RuntimeError('Restored database integrity failed')
  manifest={'managedBy':MARKER,'createdAt':datetime.now(timezone.utc).isoformat(),'release':str(Path('/opt/preclass/current').resolve()),'files':files,'databases':dbs,'skippedSymlinks':skipped,'fileAndDatabaseRestoreChecked':True,'fullApplicationRestoreChecked':False,'externalReplica':False,'inFlightUploadsMayNeedRetry':True}
  (temp/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2));os.chmod(temp/'manifest.json',0o600);temp.rename(target)
  backups=[]
  for p in ROOT.glob('auto-*'):
   if p.is_symlink() or not p.is_dir() or p.resolve().parent!=ROOT.resolve():continue
   try:
    if json.loads((p/'manifest.json').read_text()).get('managedBy')==MARKER:backups.append(p)
   except (OSError,ValueError):pass
  for old in sorted(backups,reverse=True)[14:]:
   if old.resolve().parent!=ROOT.resolve() or old.is_symlink():raise RuntimeError('Retention target outside backup root')
   shutil.rmtree(old)
  print(json.dumps({'ok':True,'snapshot':target.name,'files':len(files),'databases':len(dbs),'bytes':sum(x['bytes'] for x in files.values()),'restoredChecksumsAndDatabases':True,'externalReplica':False}))
if __name__=='__main__':run()
