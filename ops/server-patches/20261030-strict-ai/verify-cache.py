from pathlib import Path
import tempfile,os,json
source=Path('/opt/preclass/tools/mee-cache-worker.py').read_text();prefix,suffix=source.split('discovered={};priority=set();documents={};errors=[]',1)
with tempfile.TemporaryDirectory() as folder:
 os.environ['MEE_CACHE_DIR']=folder;path=Path(folder)/'index.json';path.write_text('{"unchanged":true}');before=path.read_bytes();namespace={};exec(compile(prefix,'cache-worker.py','exec'),namespace)
 page=namespace['Page']();page.feed('<div class="TRS_Editor">START<br/>MIDDLE<p>BODY</p>END</div><p>FOOTER</p>');assert ''.join(page.text)=='STARTMIDDLEBODYEND'
 for url in ['https://mee.gov.cn.evil.com/','http://www.mee.gov.cn/','https://user@www.mee.gov.cn/','https://www.gov.cn/']:assert not namespace['allowed'](url)
 assert namespace['allowed']('https://www.mee.gov.cn/a')
 def unavailable(*args,**kwargs):raise RuntimeError('Simulated offline')
 namespace['fetch']=unavailable
 try:exec(compile('discovered={};priority=set();documents={};errors=[]'+suffix,'cache-worker.py','exec'),namespace)
 except AssertionError as error:assert 'No fresh official document' in str(error)
 else:raise AssertionError('Failure not reported')
 assert path.read_bytes()==before
 result={'passed':True,'parserVoidTagsPreservedBody':True,'domainSpoofRejected':True,'allFetchFailedOriginalCacheUnchanged':True,'networkCalls':0,'modelCalls':0};Path('/home/ubuntu/strict-ai-stage/cache-verification.json').write_text(json.dumps(result));print(json.dumps(result))
