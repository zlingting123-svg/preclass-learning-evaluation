import sys,json
from pathlib import Path
source,target,ext=sys.argv[1:]
with open(target,'w',encoding='utf-8') as out:
    if ext=='pdf':
        from pypdf import PdfReader
        reader=PdfReader(source)
        if reader.is_encrypted: raise ValueError('encrypted PDF')
        for i,page in enumerate(reader.pages):
            text=page.extract_text() or ''
            out.write(json.dumps({'page':i+1,'text':text,'needsOcr':not text.strip()},ensure_ascii=False)+'\n')
    elif ext in ('txt','md','csv'):
        with open(source,encoding='utf-8-sig') as src:
            for i,line in enumerate(src):out.write(json.dumps({'page':i+1,'text':line,'needsOcr':False},ensure_ascii=False)+'\n')
    else: raise ValueError('unsupported parser')
