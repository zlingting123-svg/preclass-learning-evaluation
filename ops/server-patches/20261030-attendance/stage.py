from pathlib import Path
import subprocess
root=Path('/home/ubuntu/preclass-attendance-stage');base=Path('/opt/preclass/current').resolve()
assert base==Path('/opt/preclass/releases/20261030-course-library')
if not (root/'frontend').exists():subprocess.run(['cp','-a',str(base/'frontend'),str(root/'frontend')],check=True)
if not (root/'ai-module').exists():subprocess.run(['cp','-a',str(base/'ai-module'),str(root/'ai-module')],check=True)
p=root/'backend/dist/backend/src/app.js';s=p.read_text();needle='questionnaireRoutes(app, service, ok);';assert s.count(needle)==1 and 'attendanceRoutes' not in s;s="import {attendanceRoutes} from './attendance.js';\n"+s.replace(needle,needle+'\n    attendanceRoutes(app, service);');p.write_text(s)
assets=root/'frontend/dist/assets'
for p in (root/'patch').iterdir():
    if p.suffix in ['.js','.css']:(assets/p.name).write_bytes(p.read_bytes())
entry=(base/'frontend/dist/assets/main-entry-insights-followup-20261030.js').read_text().replace('main-insights-followup-20261030.js','main-attendance-20261030.js')
(assets/'main-entry-attendance-20261030.js').write_text(entry)
p=root/'frontend/dist/index.html';p.write_text(p.read_text().replace('main-entry-insights-followup-20261030.js','main-entry-attendance-20261030.js'))
print('Staged actual server page with additive attendance routes only')
