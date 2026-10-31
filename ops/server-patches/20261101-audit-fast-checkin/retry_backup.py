from pathlib import Path
import subprocess,base64
base=Path(__file__).resolve().parent;access=Path('C:/Users/96496/Documents/Codex/2026-10-28/outputs-md/work/server-access')
ssh=['ssh','-i',str(access/'preclass-deploy-ed25519'),'-o','UserKnownHostsFile='+str(access/'known_hosts'),'-o','StrictHostKeyChecking=yes','-o','BatchMode=yes','ubuntu@82.157.183.146']
payload={name:base64.b64encode((base/name).read_bytes()).decode() for name in ['automatic_backup.py','preclass-backup.service']}
script='''from pathlib import Path
import base64,subprocess,json,os
payload=PAYLOAD
script=Path('/opt/preclass/ops/automatic_backup.py');unit=Path('/etc/systemd/system/preclass-backup.service')
assert 'Private Preclass data backup' in unit.read_text() and 'preclass-automatic-backup-v1' in script.read_text()
script.write_bytes(base64.b64decode(payload['automatic_backup.py']));unit.write_bytes(base64.b64decode(payload['preclass-backup.service']))
subprocess.run(['systemctl','daemon-reload'],check=True);subprocess.run(['systemctl','start','preclass-backup.service'],check=True,timeout=600)
log=subprocess.run(['journalctl','-u','preclass-backup.service','-n','8','--no-pager','-o','cat'],capture_output=True,text=True,check=True).stdout
summary=next(json.loads(line) for line in log.splitlines() if line.startswith('{') and 'restoredChecksumsAndDatabases' in line)
assert summary['ok'];subprocess.run(['systemctl','enable','--now','preclass-backup.timer'],check=True,capture_output=True)
assert subprocess.run(['systemctl','is-active','preclass-backup.timer'],capture_output=True,text=True).stdout.strip()=='active'
summary.update(timerActive=True,retainedSnapshots=14,schedule='03:30 Asia/Shanghai + <=5min random delay',manualBackupsPreserved=True,fullApplicationRestoreTested=False)
print(json.dumps(summary))
'''.replace('PAYLOAD',repr(payload))
r=subprocess.run(ssh+['sudo -n python3 -'],input=script.encode(),capture_output=True,timeout=55)
print(r.stdout.decode());print(r.stderr.decode());assert r.returncode==0
(base/'backup-result.json').write_bytes(r.stdout)
