from pathlib import Path
import json, urllib.request, concurrent.futures
root=Path(__file__).resolve().parent
repos=['BerriAI/litellm','langchain-ai/langchainjs','run-llama/LlamaIndexTS','infiniflow/ragflow','langgenius/dify','labring/FastGPT']
def get(url):
 req=urllib.request.Request(url,headers={'User-Agent':'course-ai-module-source-review','Accept':'application/vnd.github+json'})
 with urllib.request.urlopen(req,timeout=30) as r:return json.load(r)
def review(repo):
 try:
  meta=get('https://api.github.com/repos/'+repo);branch=get('https://api.github.com/repos/'+repo+'/commits/'+meta['default_branch'])
  sha=branch['sha'];license=get('https://api.github.com/repos/'+repo+'/license?ref='+sha)
  import base64
  text=base64.b64decode(license['content']).decode()
  slug=repo.replace('/','--');(root/(slug+'--LICENSE.txt')).write_text(text)
  return {'repository':repo,'url':meta['html_url'],'defaultBranch':meta['default_branch'],'commit':sha,'commitDate':branch['commit']['committer']['date'],'licenseSpdx':meta.get('license',{}).get('spdx_id'),'licenseUrl':license['html_url'],'description':meta['description'],'reviewDate':'2026-10-28','runtimeVerified':False}
 except Exception as e:return {'repository':repo,'error':str(e)}
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:rows=list(pool.map(review,repos))
(root/'source-manifest.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2))
for row in rows:print(json.dumps(row,ensure_ascii=False))
