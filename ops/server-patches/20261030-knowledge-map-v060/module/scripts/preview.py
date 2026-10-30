import os,sys,subprocess,tempfile,shutil,io
from pathlib import Path
from PIL import Image
Image.MAX_IMAGE_PIXELS=40000000
OFFICE={'.doc','.docx','.ppt','.pptx'}
def convert(source,target):
 source,target=Path(source),Path(target)
 if source.suffix.lower() in OFFICE:
  exe=os.environ.get('KM_LIBREOFFICE') or shutil.which('libreoffice') or '/Applications/LibreOffice.app/Contents/MacOS/soffice'
  if not Path(exe).exists():raise RuntimeError('Office预览需要LibreOffice')
  with tempfile.TemporaryDirectory(prefix='map-office-') as folder:
   folder=Path(folder);profile=(folder/'profile').as_uri()
   r=subprocess.run([exe,'-env:UserInstallation='+profile,'--headless','--norestore','--convert-to','pdf','--outdir',str(folder),str(source)],capture_output=True,timeout=120)
   result=folder/(source.stem+'.pdf')
   if r.returncode or not result.exists() or not result.read_bytes().startswith(b'%PDF-'):raise RuntimeError('Office文件预览转换失败')
   shutil.copyfile(result,target)
 else:
  with Image.open(source) as img:
   img.seek(0);img.convert('RGB').save(target,format='PNG')
 os.chmod(target,0o600)
if __name__=='__main__':convert(sys.argv[1],sys.argv[2])
