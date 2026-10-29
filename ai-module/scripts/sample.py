#!/usr/bin/env python3
from pathlib import Path
import os,subprocess,json,signal,socket,sys
ROOT=Path(__file__).resolve().parents[1]
WORK=ROOT/'work/sample'
def listening():
 with socket.socket() as s:return s.connect_ex(('127.0.0.1',8891))==0
def owned(pid):
 return str(ROOT) in subprocess.run(['ps','-p',str(pid),'-o','command='],capture_output=True,text=True).stdout
try:
 action=sys.argv[1] if len(sys.argv)>1 else 'status'
 if action=='start':
  if listening():raise RuntimeError('8891端口已占用；请核对已有AI模块，不能覆盖其他程序。')
  if not (ROOT/'node_modules').exists():subprocess.run(['npm','ci'],cwd=ROOT,check=True)
  subprocess.run(['npm','run','build'],cwd=ROOT,check=True)
  subprocess.run(['npm','run','sample:setup'],cwd=ROOT,check=True)
  env={**os.environ,'AI_CONFIG':str(WORK/'config.json'),'AI_AUTH_SECRET_FILE':str(WORK/'auth.secret'),'AI_FINGERPRINT_SECRET_FILE':str(WORK/'fingerprint.secret'),'AI_DB_PATH':str(WORK/'metadata.sqlite'),'AI_PORT':'8891'}
  # Enforce local fake-only sample even if inherited environment includes live keys.
  if json.loads((WORK/'config.json').read_text())['mode']!='mock':raise RuntimeError('便捷启动只允许mock；真实API请按README独立配置。')
  log=(WORK/'server.log').open('a');p=subprocess.Popen(['node',str(ROOT/'dist/src/server.js')],cwd=ROOT,env=env,stdin=subprocess.DEVNULL,stdout=log,stderr=subprocess.STDOUT,start_new_session=True)
  (WORK/'process.json').write_text(json.dumps({'pid':p.pid}))
  print('本地API启动中：http://127.0.0.1:8891/health；使用scripts/client.mjs测试，无前端。')
 elif action=='stop':
  path=WORK/'process.json'
  if path.exists():
   pid=json.loads(path.read_text())['pid']
   if owned(pid):os.killpg(pid,signal.SIGTERM)
   path.unlink()
  print('已停止本次AI模块进程；元数据与配置保留。')
 elif action=='status':print(json.dumps({'apiPort8891':listening(),'url':'http://127.0.0.1:8891/health'}))
 else:raise RuntimeError('用法：sample.py start|stop|status')
except Exception as e:print(str(e),file=sys.stderr);sys.exit(1)
