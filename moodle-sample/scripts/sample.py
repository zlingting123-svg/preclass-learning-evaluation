#!/usr/bin/env python3
"""Project-local macOS arm64 Moodle lifecycle; never installs global packages or resets data."""
from pathlib import Path
import argparse, hashlib, json, os, platform, secrets, shutil, signal, socket
import subprocess, sys, tarfile, tempfile, time, urllib.request, zipfile

ROOT = Path(__file__).resolve().parents[1]
WORK = ROOT/'work'
PHP = WORK/'runtime/php'
PG = WORK/'runtime/postgres/package/native/bin'
MOODLE = WORK/'moodle'
PRIVATE = WORK/'private'
WEBPORT, DBPORT = 8873, 55439

def run(args, **kw):
    return subprocess.run([str(a) for a in args], check=True, **kw)

def php(script, *args, **kw):
    return run([PHP, '-d', 'max_input_vars=5000', '-d', 'memory_limit=512M', script, *args], **kw)

def phpcode(code, **kw):
    env = {**os.environ, 'PCS_WORK': str(WORK)}
    return php('-r', code, env=env, **kw)

def prepare():
    if platform.system() != 'Darwin' or platform.machine() != 'arm64':
        raise RuntimeError('This tested portable runner requires macOS arm64. The Moodle plugin itself is platform independent.')
    WORK.mkdir(exist_ok=True); (WORK/'runtime').mkdir(exist_ok=True)
    PRIVATE.mkdir(exist_ok=True); PRIVATE.chmod(0o700)
    manifest = json.loads((ROOT/'source.lock.json').read_text())
    for item in manifest['files']:
        target = WORK/item['path']; target.parent.mkdir(parents=True, exist_ok=True)
        if not target.exists():
            print('Downloading', item['version'], flush=True)
            part = target.with_suffix(target.suffix+'.part')
            with urllib.request.urlopen(item['url'], timeout=120) as response, part.open('wb') as out:
                shutil.copyfileobj(response, out)
            if hashlib.sha256(part.read_bytes()).hexdigest() != item['sha256']:
                raise RuntimeError('Upstream artifact differs from source.lock.json. Keep the file for review; do not silently use a different build.')
            part.replace(target)
        if hashlib.sha256(target.read_bytes()).hexdigest() != item['sha256']:
            raise RuntimeError('Local runtime integrity mismatch: '+item['path'])
    PHP.chmod(0o700)
    if not MOODLE.exists():
        with tarfile.open(WORK/'moodle.tgz') as archive: archive.extractall(WORK, filter='data')
    package = WORK/'runtime/postgres/package'
    if not package.exists():
        package.parent.mkdir(parents=True, exist_ok=True)
        with tarfile.open(WORK/'postgres.tgz') as archive: archive.extractall(package.parent, filter='data')
    run(['node', 'scripts/hydrate-symlinks.js'], cwd=package)
    data = WORK/'moodledata'; data.mkdir(exist_ok=True); data.chmod(0o700)
    lang = data/'lang'; lang.mkdir(exist_ok=True)
    if not (lang/'zh_cn').exists():
        with zipfile.ZipFile(WORK/'zh_cn.zip') as archive: archive.extractall(lang)
    shutil.copytree(ROOT/'plugin', MOODLE/'public/local/preclass_sample', dirs_exist_ok=True)
    credfile = PRIVATE/'credentials.json'
    if not credfile.exists():
        credentials = {'admin':{'username':'sample_admin','password':'S!'+secrets.token_urlsafe(20)+'9a'},'database':secrets.token_urlsafe(28)}
        credfile.write_text(json.dumps(credentials,indent=2)+'\n'); credfile.chmod(0o600)

def start_database():
    data = WORK/'pgdata'
    if not (data/'PG_VERSION').exists():
        with (WORK/'initdb.log').open('w') as log:
            run([PG/'initdb','-D',data,'-U','moodle_sample','--auth-local=trust','--auth-host=scram-sha-256','--encoding=UTF8','--locale=C','--no-instructions'],stdout=log,stderr=subprocess.STDOUT)
    if subprocess.run([str(PG/'pg_ctl'),'-D',str(data),'status'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL).returncode == 0:
        return
    # A private short socket path avoids macOS UNIX socket path-length limits.
    socketdir = tempfile.mkdtemp(prefix='pcs-pg-')
    runtime = {'socket':socketdir,'dbport':DBPORT,'webport':WEBPORT}
    (PRIVATE/'runtime.json').write_text(json.dumps(runtime)+'\n')
    run([PG/'pg_ctl','-D',data,'-l',WORK/'postgres.log','-o',f'-h 127.0.0.1 -p {DBPORT} -k {socketdir}','-w','start'])

def configure():
    # The Unix socket is private to this OS user. TCP always uses a random SCRAM password.
    phpcode("""$w=getenv('PCS_WORK');$c=json_decode(file_get_contents($w.'/private/credentials.json'),true);
        $m=json_decode(file_get_contents($w.'/private/runtime.json'),true);
        $db=pg_connect('host='.$m['socket'].' port=55439 user=moodle_sample dbname=postgres');
        if(!$db)exit(1);if(!pg_query($db,\"ALTER ROLE moodle_sample PASSWORD '\".pg_escape_string($db,$c['database']).\"'\"))exit(2);
        $exists=pg_fetch_result(pg_query($db,\"SELECT COUNT(1) FROM pg_database WHERE datname='preclass_moodle'\"),0,0);
        if(!$exists&&!pg_query($db,\"CREATE DATABASE preclass_moodle ENCODING 'UTF8'\"))exit(3);""")
    config = '''<?php
unset($CFG); global $CFG; $CFG = new stdClass();
$private=json_decode(file_get_contents(__DIR__.'/../private/credentials.json'),true);
$CFG->dbtype='pgsql'; $CFG->dblibrary='native'; $CFG->dbhost='127.0.0.1';
$CFG->dbname='preclass_moodle'; $CFG->dbuser='moodle_sample'; $CFG->dbpass=$private['database'];
$CFG->prefix='mdl_'; $CFG->dboptions=['dbpersist'=>false,'dbport'=>'55439','dbsocket'=>false];
$CFG->wwwroot='http://127.0.0.1:8873'; $CFG->dataroot=__DIR__.'/../moodledata';
$CFG->admin='admin'; $CFG->directorypermissions=0700;
$CFG->noemailever=true; $CFG->noreplyaddress='noreply@example.invalid';
$CFG->disableupdateautodeploy=true;
require_once(__DIR__.'/lib/setup.php');
'''
    (MOODLE/'config.php').write_text(config); (MOODLE/'config.php').chmod(0o600)
    installed = phpcode("""$w=getenv('PCS_WORK');$c=json_decode(file_get_contents($w.'/private/credentials.json'),true);
        $db=pg_connect('host=127.0.0.1 port=55439 user=moodle_sample dbname=preclass_moodle password='.$c['database']);
        if(!$db)exit(2);echo pg_fetch_result(pg_query($db,\"SELECT COUNT(1) FROM pg_tables WHERE schemaname='public' AND tablename='mdl_config'\"),0,0);""",capture_output=True,text=True).stdout.strip()
    if installed == '0':
        print('Installing actual Moodle database (see work/install.log)',flush=True)
        with (WORK/'install.log').open('w') as log: php(ROOT/'scripts/install_database.php',stdout=log,stderr=subprocess.STDOUT)
    with (WORK/'upgrade.log').open('w') as log: php(MOODLE/'admin/cli/upgrade.php','--non-interactive',stdout=log,stderr=subprocess.STDOUT)
    with (WORK/'seed.log').open('w') as log: php(ROOT/'scripts/seed.php',stdout=log,stderr=subprocess.STDOUT)
    accounts=json.loads((PRIVATE/'demo-accounts.json').read_text())
    lines=['Moodle本机模拟账号','仅供本地样板；请勿提交或上传此文件。','']
    for account in accounts.values():
        lines.extend([account['displayName'], '用户名：'+account['username'], '口令：'+account['password'], ''])
    human=PRIVATE/'演示账号.txt';human.write_text('\n'.join(lines));human.chmod(0o600)

def web_alive():
    try:
        with socket.create_connection(('127.0.0.1',WEBPORT),timeout=1): return True
    except OSError: return False

def start_web():
    if web_alive():
        # Refuse to assume that an unrelated service on this port is our sample.
        with urllib.request.urlopen(f'http://127.0.0.1:{WEBPORT}/login/index.php',timeout=5) as response:
            if '课前学习样板' not in response.read().decode(): raise RuntimeError('Port 8873 belongs to another service')
        return
    with (WORK/'http.log').open('a') as log:
        child=subprocess.Popen([str(PHP),'-d','max_input_vars=5000','-d','memory_limit=512M','-d','display_errors=0','-S',f'127.0.0.1:{WEBPORT}','-t',str(MOODLE/'public')],stdout=log,stderr=log,start_new_session=True)
    (PRIVATE/'web.pid').write_text(str(child.pid))
    for _ in range(50):
        if child.poll() is not None: raise RuntimeError('PHP server exited; inspect work/http.log')
        if web_alive(): break
        time.sleep(.1)

def stop():
    pidfile=PRIVATE/'web.pid'
    if pidfile.exists():
        pid=int(pidfile.read_text()); result=subprocess.run(['ps','-p',str(pid),'-o','command='],capture_output=True,text=True)
        if str(PHP) in result.stdout and f'127.0.0.1:{WEBPORT}' in result.stdout:
            os.kill(pid,signal.SIGTERM)
        pidfile.unlink()
    if (PG/'pg_ctl').exists() and (WORK/'pgdata/PG_VERSION').exists():
        if subprocess.run([str(PG/'pg_ctl'),'-D',str(WORK/'pgdata'),'status'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL).returncode==0:
            run([PG/'pg_ctl','-D',WORK/'pgdata','-m','fast','-w','stop'])
    print('Sample processes stopped; database and all saved work retained.')

def verify():
    out=ROOT/'verification';out.mkdir(exist_ok=True)
    with (out/'schema.json').open('w') as f:php(ROOT/'tests/schema_test.php',stdout=f)
    run([sys.executable,ROOT/'tests/http_test.py'])
    with (out/'database.json').open('w') as f:php(ROOT/'scripts/database_state.php',stdout=f)
    print('Verification evidence:',out)

def main():
    parser=argparse.ArgumentParser();parser.add_argument('action',choices=['start','stop','verify','status']);args=parser.parse_args()
    if args.action=='stop':stop();return
    if args.action=='verify':verify();return
    if args.action=='status':
        print(json.dumps({'url':f'http://127.0.0.1:{WEBPORT}/local/preclass_sample/index.php','webListening':web_alive(),'work':str(WORK)},ensure_ascii=False));return
    prepare();start_database();configure();start_web()
    print(f'本地样板：http://127.0.0.1:{WEBPORT}/local/preclass_sample/index.php')
    print('模拟师生账号：',PRIVATE/'演示账号.txt')
    print('管理员账号：',PRIVATE/'credentials.json')
    print('仅监听本机；未发布到公网。')

if __name__=='__main__':
    try:main()
    except (RuntimeError,subprocess.CalledProcessError) as error:
        print('Sample action failed:',error,file=sys.stderr)
        print('Inspect project-local work/*.log. No database reset was performed.',file=sys.stderr);sys.exit(1)
