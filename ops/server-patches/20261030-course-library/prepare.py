import concurrent.futures,hashlib,json,logging,os,shutil,subprocess,uuid
from pathlib import Path
from pypdf import PdfReader

root=Path('/home/ubuntu/preclass-library-20261030')
logging.getLogger('pypdf').setLevel(logging.ERROR)
manifest=json.loads((root/'manifest.json').read_text(encoding='utf-8-sig'))
assert json.loads((root/'download-verification.json').read_text())['verified']
inventory=json.loads((root/'baseline-inventory.json').read_text())
existing={j.get('sha256'):j for j in inventory['referenceFiles']}
os.umask(0o077)
def process(entry):
    source=root/'originals'/entry['path'];assert hashlib.sha256(source.read_bytes()).hexdigest()==entry['sha256']
    old=existing.get(entry['sha256'])
    ident=old['id'] if old else str(uuid.uuid5(uuid.NAMESPACE_URL,'preclass-course-library:'+entry['sha256']))
    folder=root/'prepared'/ident;folder.mkdir(parents=True,exist_ok=True)
    if old:
        prefix=Path('/var/lib/preclass/reference-files')/ident
        for suffix in ['.pages.jsonl','.prepared.jsonl','.memory.json','.manifest.json']:
            p=Path(str(prefix)+suffix)
            if p.exists():shutil.copyfile(p,folder/('document'+suffix))
    raw=folder/'document.pages.jsonl';prepared=folder/'document.prepared.jsonl'
    if not raw.exists():
        reader=PdfReader(source)
        assert not reader.is_encrypted
        assert len(reader.pages)==entry['pages']
        pages=[]
        for i,page in enumerate(reader.pages):
            text=page.extract_text() or ''
            pages.append({'page':i+1,'text':text,'needsOcr':not text.strip()})
        raw.write_text(''.join(json.dumps(p,ensure_ascii=False)+'\n' for p in pages),encoding='utf-8')
    pages=[json.loads(line) for line in raw.read_text(encoding='utf-8').splitlines()]
    assert len(pages)==entry['pages']
    if any(p['needsOcr'] for p in pages) and not prepared.exists():
        print(json.dumps({'ocrStarted':entry['path'],'pages':sum(p['needsOcr'] for p in pages)}),flush=True)
        subprocess.run(['/opt/preclass/python/bin/python',str(root/'ocr-pages.py'),str(source),str(raw),str(prepared)],check=True,timeout=1200)
    final=prepared if prepared.exists() else raw
    pages=[json.loads(line) for line in final.read_text(encoding='utf-8').splitlines()]
    assert len(pages)==entry['pages'] and all(not p['needsOcr'] or p.get('visualReviewPending') for p in pages)
    text=''.join(f"\n[第{p['page']}页{' 空白页' if p.get('blankPage') else ' OCR识别' if p.get('ocrUsed') else ''}]\n{p['text']}" for p in pages)
    assert text.strip()
    # Page-aware segments preserve provenance even before any paid summary generation.
    chunks=[]
    for p in pages:
        body=p['text'].strip()
        if body:
            for i in range(0,len(body),650):chunks.append(f"[第{p['page']}页]\n"+body[i:i+650])
    result={**entry,'id':ident,'title':old['title'] if old else source.stem,'reused':bool(old),'aiReadAlreadyComplete':bool(old and old.get('status')=='ai_read_complete'),'pageCount':len(pages),'textCharacters':sum(len(p['text']) for p in pages),'blankPages':[p['page'] for p in pages if p.get('blankPage')],'ocrPages':[p['page'] for p in pages if p.get('ocrUsed')],'visualReviewPending':[p['page'] for p in pages if p.get('visualReviewPending')],'shortTextPages':[p['page'] for p in pages if not p.get('blankPage') and len(p['text'].strip())<20],'chunks':len(chunks),'sourceVersion':hashlib.sha256(text.encode()).hexdigest(),'original':str(source),'pagesFile':str(final)}
    (folder/'source.json').write_text(json.dumps({'id':ident,'classId':'__all_classes__','title':result['title'],'name':source.name,'version':result['sourceVersion'],'state':'published','chunks':chunks,'createdAt':'2026-10-30T00:00:00.000Z','originCommit':'62aaaab45fdf064b308c32ce9bc53e1dc2586e55','originalSha256':entry['sha256'],'extraction':'page-aware PDF text with OCR where empty'},ensure_ascii=False),encoding='utf-8')
    (folder/'result.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps({'prepared':entry['path'],'pages':len(pages),'characters':result['textCharacters'],'ocrPages':len(result['ocrPages']),'reused':bool(old)}),flush=True)
    return result
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:results=list(executor.map(process,manifest['files']))
result={'passed':True,'files':results,'fileCount':len(results),'pages':sum(r['pageCount'] for r in results),'reused':sum(r['reused'] for r in results),'new':sum(not r['reused'] for r in results),'realModelCalls':0}
(root/'preparation.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'passed':True,'files':result['fileCount'],'pages':result['pages'],'reused':result['reused'],'new':result['new'],'realModelCalls':0}),flush=True)
