from pathlib import Path
import pymupdf,json,hashlib
source=next(Path('work/cau-hd/vector').rglob('A1-1.01.ai'));page=pymupdf.open(source)[0];paths=[x for x in page.get_drawings() if pymupdf.Rect(50,25,250,100).contains(x['rect'])];bounds=pymupdf.Rect()
for p in paths:bounds|=p['rect']
f=lambda n:format(n,'.5f').rstrip('0').rstrip('.')
point=lambda p:f(p.x)+' '+f(p.y)
parts=[]
for path in paths:
 d=[];end=None
 for item in path['items']:
  if item[0]=='re':
   r=item[1];d.append('M'+point(r.tl)+'H'+f(r.x1)+'V'+f(r.y1)+'H'+f(r.x0)+'Z');end=None
  elif item[0] in ['l','c']:
   start=item[1]
   if end is None or abs(start.x-end.x)+abs(start.y-end.y)>0.0001:d.append('M'+point(start))
   if item[0]=='l':d.append('L'+point(item[2]));end=item[2]
   else:d.append('C'+' '.join(point(p) for p in item[2:]));end=item[4]
  else:raise ValueError(item[0])
 if path.get('closePath'):d.append('Z')
 parts.append('<path fill-rule="'+('evenodd' if path.get('even_odd') else 'nonzero')+'" d="'+' '.join(d)+'"/>')
svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="'+' '.join(f(n) for n in [bounds.x0,bounds.y0,bounds.width,bounds.height])+'" fill="#00873c" role="img"><title>中国农业大学 China Agricultural University</title>'+''.join(parts)+'</svg>'
Path('work/cau-hd/cau-identity-hd.svg').write_text(svg,encoding='utf-8');Path('work/cau-hd/source.json').write_text(json.dumps({'source':'https://www2023.cau.edu.cn/attach/0/3AI.rar','sourcePage':'https://www2023.cau.edu.cn/col/col10258/index.html','member':source.name,'memberSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'extraction':'121 header vector drawing paths only; no raster, no redrawing','paths':len(paths),'viewBox':list(bounds)},indent=2));print(len(svg),len(paths),bounds)
