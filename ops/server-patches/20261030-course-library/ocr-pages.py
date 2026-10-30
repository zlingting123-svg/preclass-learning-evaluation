import json,os,subprocess,sys,tempfile
from pathlib import Path
source,pages_file,target=sys.argv[1:]
pages=[json.loads(line) for line in Path(pages_file).read_text(encoding='utf-8').splitlines()]
checkpoint=Path(target+'.checkpoint')
if checkpoint.exists():
    saved=[json.loads(line) for line in checkpoint.read_text(encoding='utf-8').splitlines()]
    if len(saved)==len(pages):pages=saved
with tempfile.TemporaryDirectory(prefix='preclass-library-ocr-') as temporary:
 for page in pages:
  if not page.get('needsOcr') or page.get('visualReviewPending'):continue
  number=page['page'];prefix=Path(temporary)/'page'
  def render(dpi):
   subprocess.run(['pdftoppm','-f',str(number),'-l',str(number),'-r',str(dpi),'-gray','-singlefile',source,str(prefix)],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,timeout=90)
   return prefix.with_suffix('.pgm')
  image=render(150);data=image.read_bytes().split(b'\n',3)
  if not any(pixel<245 for pixel in data[-1]):page.update(text='',blankPage=True,needsOcr=False)
  else:
   def recognize(psm):
    result=subprocess.run(['tesseract',str(image),'stdout','-l','chi_sim+eng','--psm',str(psm)],check=True,stdout=subprocess.PIPE,stderr=subprocess.DEVNULL,timeout=120,env={**os.environ,'OMP_THREAD_LIMIT':'1'})
    return result.stdout.decode('utf-8').strip()
   text=recognize(3)
   if not text:
    image=render(250);text=recognize(11)
   if text:page.update(text=text,needsOcr=False,ocrUsed=True)
   else:
    # Preserve and explicitly flag nonblank images; do not invent transcription or call them blank.
    page.update(text='',needsOcr=True,visualReviewPending=True)
    review=Path(target).parent/'visual-review';review.mkdir(exist_ok=True)
    subprocess.run(['pdftoppm','-f',str(number),'-l',str(number),'-scale-to','1100','-singlefile','-png',source,str(review/f'page-{number}')],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,timeout=90)
  checkpoint.write_text(''.join(json.dumps(p,ensure_ascii=False)+'\n' for p in pages),encoding='utf-8')
Path(target).write_text(''.join(json.dumps(p,ensure_ascii=False)+'\n' for p in pages),encoding='utf-8')
print(json.dumps({'ocrPrepared':Path(source).name,'ocrPages':sum(bool(p.get('ocrUsed')) for p in pages),'visualReviewPending':[p['page'] for p in pages if p.get('visualReviewPending')]}),flush=True)
