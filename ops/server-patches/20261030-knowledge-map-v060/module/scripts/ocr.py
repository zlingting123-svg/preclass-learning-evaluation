import sys,platform,tempfile,subprocess
from pathlib import Path

def recognize(path):
 if platform.system()=='Darwin':
  from rapidocr_onnxruntime import RapidOCR
  result,_=RapidOCR()(str(path))
  return '\n'.join(x[1] for x in (result or []))
 r=subprocess.run(['tesseract',str(path),'stdout','-l','chi_sim+eng'],stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=90,check=True)
 return r.stdout.decode('utf8')
if __name__=='__main__': print(recognize(Path(sys.argv[1])))
