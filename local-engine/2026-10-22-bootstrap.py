"""Create project-local Python runtime; never modifies the invoking Python environment.

Run with --install to install CUDA PyTorch and minimal Kimodo inference dependencies.
Model weights are a separate explicit worker install-model operation.
"""
import argparse
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import tarfile
import urllib.request

ROOT=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('previs_worker',ROOT/'2026-10-22-worker.py')
worker=importlib.util.module_from_spec(spec); spec.loader.exec_module(worker)

def run(args,cwd=ROOT):
    worker.emit('progress',stage='bootstrap',command=args)
    subprocess.run(args,cwd=cwd,env=os.environ.copy(),shell=False,check=True,stdout=sys.stderr,stderr=sys.stderr)

def install_antlr(python):
    """Build this source-only dependency at a shallow project-local path on Windows."""
    check=subprocess.run([str(python),'-c',
        "import importlib.metadata; assert importlib.metadata.version('antlr4-python3-runtime') == '4.9.3'"],
        cwd=ROOT,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,shell=False)
    if check.returncode==0: return
    run([str(python),'-m','pip','install','--upgrade','pip','setuptools','wheel'])
    build=worker.RUNTIME/'a'
    build.mkdir(parents=True,exist_ok=True)
    archive=build/'a.tar.gz'
    with urllib.request.urlopen('https://pypi.org/pypi/antlr4-python3-runtime/4.9.3/json',timeout=60) as response:
        metadata=json.load(response)
    source=next(item for item in metadata['urls'] if item['packagetype']=='sdist')
    if not source['url'].startswith('https://files.pythonhosted.org/'):
        raise ValueError('Unexpected antlr source host')
    if not archive.exists():
        with urllib.request.urlopen(source['url'],timeout=60) as response:
            payload=response.read(10_000_001)
        if len(payload)>10_000_000 or hashlib.sha256(payload).hexdigest()!=source['digests']['sha256']:
            raise ValueError('Invalid antlr source archive')
        with archive.open('xb') as stream: stream.write(payload)
    if hashlib.sha256(archive.read_bytes()).hexdigest()!=source['digests']['sha256']:
        raise ValueError('Cached antlr source archive checksum mismatch')
    with tarfile.open(archive,'r:gz') as package:
        for member in package.getmembers():
            # Strip only the top-level archive folder. Never follow links.
            parts=Path(member.name).parts[1:]
            if not parts: continue
            target=(build/Path(*parts)).resolve()
            if not target.is_relative_to(build.resolve()) or member.issym() or member.islnk():
                raise ValueError('Unsafe antlr archive entry')
            if member.isdir(): target.mkdir(parents=True,exist_ok=True)
            elif member.isfile() and not target.exists():
                target.parent.mkdir(parents=True,exist_ok=True)
                with package.extractfile(member) as input_stream,target.open('xb') as output_stream:
                    output_stream.write(input_stream.read())
    run([str(python),'setup.py','build','--build-base','c','bdist_wheel','--dist-dir','w','--bdist-dir','b'],cwd=build)
    wheels=list((build/'w').glob('antlr4_python3_runtime-4.9.3-*.whl'))
    if len(wheels)!=1: raise RuntimeError('Expected one built antlr wheel')
    run([str(python),'-m','pip','install','--no-deps',str(wheels[0])])

def main():
    parser=argparse.ArgumentParser(); parser.add_argument('--install',action='store_true'); args=parser.parse_args()
    worker.configure(False)
    env=worker.RUNTIME/'.venv'
    python=env/('Scripts/python.exe' if os.name=='nt' else 'bin/python')
    try:
        if not python.exists(): run([sys.executable,'-m','venv',str(env)])
        if args.install:
            run([str(python),'-m','pip','install','torch==2.10.0','--index-url','https://download.pytorch.org/whl/cu128'])
            install_antlr(python)
            run([str(python),'-m','pip','install','-r',str(ROOT/'2026-10-23-python-lock.txt')])
            # Source is used via sys.path. Do not mutate upstream or compile native post-processing.
            run([str(python),'-c',
                 'import sys; sys.path.insert(0,sys.argv[1]); import torch, transformers, peft, kimodo; '
                 'from kimodo.skeleton.registry import build_skeleton; '
                 'print(torch.__version__); print(torch.cuda.is_available()); '
                 'print(build_skeleton(77).neutral_joints.shape)',str(worker.SOURCE)])
        worker.emit('result',python=str(python),installed=args.install,modelsDownloaded=False,
                    postProcessing=False,runtime=str(worker.RUNTIME))
    except Exception as exc:
        worker.emit('error',message=str(exc),code=type(exc).__name__); return 1
    return 0

if __name__=='__main__': sys.exit(main())
