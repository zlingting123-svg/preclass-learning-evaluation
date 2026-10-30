from pathlib import Path
import json,sqlite3,subprocess,os
root=Path('/home/ubuntu/strict-ai-stage');state=json.loads((root/'activation-state.json').read_text());current=Path('/opt/preclass/current');assert os.geteuid()==0 and str(current.resolve())==state['current']
with sqlite3.connect('/var/lib/preclass/app.sqlite') as db:
 actual=db.execute("SELECT id,payload FROM records WHERE kind='ai_web_policy' ORDER BY id").fetchall();assert sorted(actual)==sorted(tuple(row) for row in state['installedPolicy']),'Policy changed after install; inspect before restoring'
 subprocess.run(['systemctl','stop','preclass-test.service'],check=True)
 try:
  old=json.loads(Path(state['policyBackup']).read_text());db.execute("DELETE FROM records WHERE kind='ai_web_policy'");db.executemany('INSERT INTO records(kind,id,payload) VALUES(?,?,?)',[('ai_web_policy',key,payload) for key,payload in old]);db.commit()
  temporary=Path('/opt/preclass/.strict-ai-rollback');assert not temporary.exists();temporary.symlink_to(state['previous']);os.replace(temporary,current)
 finally:subprocess.run(['systemctl','start','preclass-test.service'],check=True)
subprocess.run(['systemctl','disable','--now','preclass-mee-cache.timer'],check=True)
print('Code and reference policy restored; all course data and cached files preserved; no full database restore performed')
