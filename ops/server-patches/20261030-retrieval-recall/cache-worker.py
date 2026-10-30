"""Bounded MEE-only prefetch; no model calls and no third-party search results as evidence."""
from pathlib import Path
from urllib.parse import urljoin,urlsplit
from html.parser import HTMLParser
import concurrent.futures,datetime,hashlib,html,ipaddress,json,os,re,socket,subprocess,tempfile
ROOT=Path(os.environ.get('MEE_CACHE_DIR','/var/lib/preclass/official-cache'));ROOT.mkdir(parents=True,exist_ok=True);os.umask(0o077)
NOW=datetime.datetime.now(datetime.timezone.utc).isoformat()
TOPICS=re.compile('环境影响|评价技术|排污许可|水环境|大气|土壤|声环境|噪声|生态|规划|建设项目')
SEEDS=['https://www.mee.gov.cn/ywgz/fgbz/bz/bzwb/other/pjjsdz/','https://www.mee.gov.cn/ywgz/fgbz/bz/bzwb/shjbh/shjzlbz/','https://www.mee.gov.cn/ywgz/fgbz/bz/bzwb/dqhjbh/dqhjzlbz/','https://www.mee.gov.cn/ywgz/fgbz/fl/','https://www.mee.gov.cn/ywgz/fgbz/xzfg/','https://www.mee.gov.cn/ywgz/fgbz/bz/','https://www.mee.gov.cn/ywgz/fgbz/bz/bzwb/other/pjjsdz/201612/t20161214_369043.shtml']
def allowed(url):
 try:
  u=urlsplit(url);return u.scheme=='https' and not u.username and not u.password and u.port in [None,443] and (u.hostname=='mee.gov.cn' or u.hostname.endswith('.mee.gov.cn'))
 except Exception:return False
def fetch(url,limit=24000000):
 assert allowed(url)
 for _ in range(4):
  addresses=socket.getaddrinfo(urlsplit(url).hostname,443,type=socket.SOCK_STREAM)
  if not addresses or any(not ipaddress.ip_address(a[4][0]).is_global for a in addresses):raise ValueError('non-public DNS')
  with tempfile.TemporaryDirectory() as temporary:
   body=Path(temporary)/'body';headers=Path(temporary)/'headers'
   subprocess.run(['curl','-4','-fsS','--connect-timeout','5','--max-time','18','--max-filesize',str(limit),'-D',str(headers),'-o',str(body),url],check=True,capture_output=True)
   h=headers.read_text(errors='replace');locations=re.findall(r'^location:\s*(.+)$',h,re.I|re.M)
   if locations:
    url=urljoin(url,locations[-1].strip());assert allowed(url);continue
   data=body.read_bytes();assert len(data)<=limit;return url,data
 raise ValueError('redirect limit')
def decode(raw):
 for encoding in ['utf-8','gb18030']:
  try:return raw.decode(encoding)
  except UnicodeError:pass
 return raw.decode('utf-8',errors='replace')
class Page(HTMLParser):
 def __init__(self):super().__init__();self.links=[];self.anchor=None;self.depth=0;self.capture=0;self.text=[];self.skip=0;self.title='';self.in_title=False;self.meta={}
 def handle_starttag(self,tag,attrs):
  a=dict(attrs)
  if tag not in ['br','hr','img','meta','link','input','source','wbr']:self.depth+=1
  if tag in ['script','style']:self.skip+=1
  if tag=='title':self.in_title=True
  if tag=='meta':self.meta[(a.get('name')or a.get('property')or'').lower()]=a.get('content','')
  if tag=='a':self.anchor=[a.get('href',''),'']
  if not self.capture and any(x in a.get('class','').lower() for x in ['trs_editor','trs_ueditor','article-content','content_body']):self.capture=self.depth
 def handle_endtag(self,tag):
  if tag in ['br','hr','img','meta','link','input','source','wbr']:return
  if tag=='a' and self.anchor:self.links.append(tuple(self.anchor));self.anchor=None
  if tag=='title':self.in_title=False
  if tag in ['script','style']:self.skip=max(0,self.skip-1)
  if self.capture==self.depth:self.capture=0
  self.depth=max(0,self.depth-1)
 def handle_data(self,text):
  if self.in_title:self.title+=text
  if self.anchor:self.anchor[1]+=text
  if self.capture and not self.skip:self.text.append(text)
def parse(url,raw):
 p=Page();p.feed(decode(raw));return p
def normalize_date(value):
 nums=re.findall(r'\d+',value)
 try:return datetime.date(*map(int,nums[:3])).isoformat()
 except Exception:return None

def document_dates(content):
 header=content[:16000]
 published=re.findall(r'(?:发布日期|发布时间|印发日期)[：:\s]*(\d{4}[-年]\d{1,2}[-月]\d{1,2})|(\d{4}-\d{1,2}-\d{1,2})\s*发\s*布',header)
 effective=re.findall(r'(?:实施日期|实施时间)[：:\s]*(\d{4}[-年]\d{1,2}[-月]\d{1,2})|(?:本标准自|自)\s*(\d{4}年\d{1,2}月\d{1,2}日)\s*起?实施|(\d{4}-\d{1,2}-\d{1,2})\s*实\s*施',header)
 first=lambda matches:normalize_date(next((v for v in matches[0] if v),'')) if matches else None
 return first(published),first(effective)

EXTRA_REFERENCE_PAGES=['https://www.mee.gov.cn/ywdt/dfnews/202610/t20261015_1183021.shtml','https://www.mee.gov.cn/ywdt/xwfb/202609/t20260923_1174551.shtml']
SEEDS+=EXTRA_REFERENCE_PAGES+['https://www.mee.gov.cn/ywgz/fgbz/bz/bzwb/stzl/202601/t20260121_1142339.shtml']
discovered={};priority=set();documents={};errors=[]
def page_job(url):
 try:
  final,raw=fetch(url,3000000);return final,raw,parse(final,raw)
 except Exception as e:return url,None,type(e).__name__
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
 for url,raw,page in executor.map(page_job,SEEDS):
  if raw is None:errors.append({'url':url,'error':page});continue
  if url in EXTRA_REFERENCE_PAGES:
   if page.text:documents[url]=(raw,page)
   continue
  category=[]
  for href,title in page.links:
   link=urljoin(url,html.unescape(href))
   if allowed(link) and re.search(r'/t\d+_\d+\.s?html$',urlsplit(link).path) and TOPICS.search(title):discovered[link]=title.strip();category.append(link)
  priority.update(sorted(category,key=lambda u:re.findall(r'/t(\d+)_',u)[-1],reverse=True)[:6])
  if page.text:documents[url]=(raw,page)
candidates=sorted(priority,key=lambda u:re.findall(r'/t(\d+)_',u)[-1],reverse=True)
candidates=list(dict.fromkeys(candidates+sorted(discovered,key=lambda u:re.findall(r'/t(\d+)_',u)[-1],reverse=True)[:16]))[:48]
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
 for url,raw,page in executor.map(page_job,candidates):
  if raw is None:errors.append({'url':url,'error':page});continue
  if page.text:documents[url]=(raw,page)
result=[]
for url,(raw,page) in documents.items():
 title=page.meta.get('articletitle') or page.title.split('_')[0].strip()
 date=None # MEE standard pages may use meta pubdate for implementation date: never relabel as publication.
 meta_date=next((page.meta[k] for k in ['pubdate','publishtime','publishdate','publishedtime','date'] if page.meta.get(k)),None)
 content='\n'.join(t.strip() for t in page.text if t.strip())
 pdf_links=[urljoin(url,href) for href,label in page.links if href.lower().split('?')[0].endswith('.pdf') and allowed(urljoin(url,href)) and (TOPICS.search(label) or re.search('HJ|GB|技术|标准',label,re.I))]
 for pdf_url in pdf_links[:1]:
  try:
   resolved,pdf=fetch(pdf_url);import pymupdf
   with pymupdf.open(stream=pdf,filetype='pdf') as doc:
    content+='\n'+'\n'.join(f'[官方PDF第{i+1}页]\n'+doc[i].get_text() for i in range(min(len(doc),100)))
  except Exception as e:errors.append({'url':pdf_url,'error':type(e).__name__})
 if len(content.strip())<100:continue
 date,effective_date=document_dates(content)
 result.append({'url':url,'title':title,'publishedAt':date,'retrievedAt':NOW,'effectiveDate':effective_date,'metadataDateCandidate':meta_date,'documentStatus':'draft' if '征求意见' in title else 'unverified','version':hashlib.sha256(content.encode()).hexdigest(),'text':content[:250000]})
assert result,'No fresh official document fetched; old cache left unchanged'
old=[]
if (ROOT/'index.json').exists():
 try:old=json.loads((ROOT/'index.json').read_text()).get('documents',[])
 except Exception:pass
for d in old:
 if 'metadataDateCandidate' not in d:d['metadataDateCandidate']=d.get('publishedAt');d['publishedAt']=None
 publication,effective=document_dates(d.get('text',''))
 if publication:d['publishedAt']=publication
 if effective:d['effectiveDate']=effective
merged={d['url']:d for d in old if allowed(d.get('url',''))};merged.update({d['url']:d for d in result})
assert merged,'No verified official document body fetched; old index preserved'
index={'schemaVersion':2,'website':'https://www.mee.gov.cn/','refreshedAt':NOW,'documents':list(merged.values()),'discovered':len(discovered),'refreshedDocuments':len(result),'errors':errors,'coverage':'bounded prefetched subset, not the complete MEE website; publication date is not an effective-status verification','realModelCalls':0}
temp=ROOT/'index.json.next';temp.write_text(json.dumps(index,ensure_ascii=False),encoding='utf-8');os.replace(temp,ROOT/'index.json')
print(json.dumps({k:v for k,v in index.items() if k not in ['documents','errors']},ensure_ascii=True),flush=True)
