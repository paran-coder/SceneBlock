"""Create source-only upload folder/ZIP. Never touch previous releases."""
from pathlib import Path
import csv,hashlib,json,shutil,zipfile
ROOT=Path(__file__).resolve().parent.parent
UPLOAD=ROOT/'2026-10-23-github-upload'
VERSION=json.loads((ROOT/'package.json').read_text(encoding='utf-8'))['version']
ARCHIVE=ROOT/f'2026-10-23-SceneBlock-v{VERSION}-github-upload.zip'
if UPLOAD.exists() or ARCHIVE.exists():
    raise SystemExit('Release output exists; refusing overwrite')
ITEMS=['src','public','ai-connector','local-engine','docs','scripts','tests','.gitignore','.vercelignore',
       '2026-10-23-core.mjs','2026-10-23-motion.mjs','2026-10-23-vite.config.mjs',
       'index.html','package.json','package-lock.json','vercel.json','README.md']
UPLOAD.mkdir()
for name in ITEMS:
    source=ROOT/name;dest=UPLOAD/name
    if source.is_dir():shutil.copytree(source,dest,ignore=shutil.ignore_patterns('__pycache__','*.pyc','.git','2026-10-23-runtime'))
    else:shutil.copy2(source,dest)
manifest=UPLOAD/'2026-10-23-file-manifest.csv'
with manifest.open('w',encoding='utf-8-sig',newline='') as f:
    writer=csv.writer(f);writer.writerow(['Path','Bytes','SHA256'])
    for p in sorted(UPLOAD.rglob('*')):
        if p.is_file() and p!=manifest:writer.writerow([p.relative_to(UPLOAD).as_posix(),p.stat().st_size,hashlib.sha256(p.read_bytes()).hexdigest()])
with zipfile.ZipFile(ARCHIVE,'w',zipfile.ZIP_DEFLATED) as z:
    for p in sorted(UPLOAD.rglob('*')):
        if p.is_file():z.write(p,p.relative_to(ROOT).as_posix())
with zipfile.ZipFile(ARCHIVE) as z:
    forbidden=[n for n in z.namelist() if any(x in n.split('/') for x in ['node_modules','dist','.git','__pycache__','2026-10-23-runtime','2026-10-22-runtime']) or n.endswith(('.safetensors','.pth','.pyc')) or n.endswith('.exe') and not n.endswith('/public/downloads/2026-10-23-SceneBlock-AI-Setup-v2.6.0.exe')]
    if forbidden:raise RuntimeError(forbidden)
    print(json.dumps({'files':len(z.namelist()),'zipBytes':ARCHIVE.stat().st_size,'forbidden':forbidden}))
