#!/usr/bin/env python3
"""Local synthetic React/Node sample. Does not change Moodle or production data."""
from pathlib import Path
import argparse,json,os,signal,socket,subprocess,sys,time,shutil
ROOT=Path(__file__).resolve().parents[1]
WORK=ROOT/'backend/work/platform-sample'
API_PORT=int(os.environ.get('SAMPLE_BACKEND_PORT','3001'))
WEB_PORT=int(os.environ.get('SAMPLE_FRONTEND_PORT','5173'))
if not all(1<=v<=65535 for v in [API_PORT,WEB_PORT]) or API_PORT==WEB_PORT:raise RuntimeError('本机端口配置无效')

def listening(port):
    with socket.socket() as s:return s.connect_ex(('127.0.0.1',port))==0

def run(args,cwd):
    subprocess.run(args,cwd=cwd,check=True)

def owned(pid):
    if os.name!='posix':return False
    command=subprocess.run(['ps','-p',str(pid),'-o','command='],capture_output=True,text=True).stdout
    return str(ROOT) in command

def stop():
    state=WORK/'processes.json'
    if not state.exists():return
    for item in json.loads(state.read_text()).values():
        pid=item['pid']
        if os.name=='posix':
            if not owned(pid):continue
            try:os.killpg(pid,signal.SIGTERM)
            except ProcessLookupError:pass
    state.unlink()
    print('已停止本次样板服务，数据库及账号保留。')

def start():
    if listening(API_PORT) or listening(WEB_PORT):
        if (WORK/'processes.json').exists() and listening(API_PORT) and listening(WEB_PORT) and all(owned(v['pid']) for v in json.loads((WORK/'processes.json').read_text()).values()):
            print(f'样板服务已在运行：http://127.0.0.1:{WEB_PORT}');return
        raise RuntimeError('5173或3001被其他程序占用，请先确认并停止对应本机服务。')
    npm=shutil.which('npm');node=shutil.which('node')
    if not npm or not node:raise RuntimeError('需要Node 24.15+和npm。')
    for name in ['ai-module','backend','frontend']:
        if not (ROOT/name/'node_modules').exists():run([npm,'ci'],ROOT/name)
        run([npm,'run','build'],ROOT/name)
    run([npm,'run','sample:seed'],ROOT/'backend')
    subprocess.run([npm,'run','admin:bootstrap'],cwd=ROOT/'backend',env={**os.environ,'DB_PATH':str(WORK/'sample.sqlite')},check=True)
    processes={}
    for name,args,cwd,extra in [
        ('backend',[node,str(ROOT/'backend/dist/backend/src/server.js')],ROOT/'backend',{'DB_PATH':str(WORK/'sample.sqlite'),'HOST':'127.0.0.1','PORT':str(API_PORT),'AI_MODE':'mock','DEV_FRONTEND_ORIGIN':f'http://127.0.0.1:{WEB_PORT}'}),
        ('frontend',[node,str(ROOT/'frontend/node_modules/vite/bin/vite.js'),'--port',str(WEB_PORT)],ROOT/'frontend',{'VITE_API_MODE':'http','VITE_DEV_PROXY_TARGET':f'http://127.0.0.1:{API_PORT}'})]:
        log=(WORK/(name+'.log')).open('a')
        child=subprocess.Popen(args,cwd=cwd,env={**os.environ,**extra},stdin=subprocess.DEVNULL,stdout=log,stderr=subprocess.STDOUT,start_new_session=True)
        processes[name]={'pid':child.pid}
    (WORK/'processes.json').write_text(json.dumps(processes))
    for _ in range(50):
        if listening(API_PORT) and listening(WEB_PORT):
            print(f'学习平台：http://127.0.0.1:{WEB_PORT}；商业预览：/design-preview.html；模拟AI已启用；账号：backend/work/platform-sample/测试账号.txt');return
        time.sleep(.2)
    raise RuntimeError('服务未就绪，查看backend/work/platform-sample中的日志。')

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('action',choices=['start','stop','status'],default='start',nargs='?');a=p.parse_args()
    try:
        if os.name!='posix' and a.action!='status':raise RuntimeError('便捷启动/停止仅在macOS验证；其他系统请按integration/LOCAL_RUN.md手动运行。')
        if a.action=='start':start()
        elif a.action=='stop':stop()
        else:print(json.dumps({'frontend':listening(WEB_PORT),'backend':listening(API_PORT),'url':f'http://127.0.0.1:{WEB_PORT}'}))
    except Exception as e:print(str(e),file=sys.stderr);sys.exit(1)
