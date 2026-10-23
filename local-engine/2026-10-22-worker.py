"""Previs Desktop v1.0.0: isolated JSON-lines Kimodo command worker."""
import argparse
import contextlib
import json
import importlib.util
import math
import os
import re
from pathlib import Path
import sys
import tempfile
import zipfile

ROOT = Path(__file__).resolve().parent
RUNTIME = ROOT / '2026-10-22-runtime'
SOURCE = ROOT / '2026-10-22-kimodo-source'
MODEL = 'nvidia/Kimodo-SOMA-RP-v1.2'
REPOS = [MODEL, 'meta-llama/Meta-Llama-3-8B-Instruct', 'McGill-NLP/LLM2Vec-Meta-Llama-3-8B-Instruct-mntp',
         'McGill-NLP/LLM2Vec-Meta-Llama-3-8B-Instruct-mntp-supervised']

def emit(kind, **data):
    print(json.dumps({'type':kind, **data}, ensure_ascii=False, allow_nan=False), flush=True)

def local_path(value):
    p = Path(value)
    p = (ROOT / p).resolve() if not p.is_absolute() else p.resolve()
    if not p.is_relative_to(ROOT): raise ValueError('Path must remain inside project directory')
    return p

def new_output(value):
    p = local_path(value)
    if p.exists(): raise FileExistsError('Refusing to overwrite existing file: '+str(p))
    return p

def configure(offline=True):
    mapping={'HF_HOME':'huggingface','HF_HUB_CACHE':'huggingface/hub','TORCH_HOME':'torch',
             'PIP_CACHE_DIR':'pip-cache','TEMP':'temp','TMP':'temp','TMPDIR':'temp',
             'XDG_CACHE_HOME':'cache','MPLCONFIGDIR':'matplotlib','NUMBA_CACHE_DIR':'numba'}
    for key, suffix in mapping.items():
        p=RUNTIME/suffix; p.mkdir(parents=True,exist_ok=True); os.environ[key]=str(p)
    os.environ['PYTHONDONTWRITEBYTECODE']='1'
    sys.dont_write_bytecode=True
    os.environ['HF_HUB_OFFLINE']='1' if offline else '0'
    os.environ['TRANSFORMERS_OFFLINE']='1' if offline else '0'
    os.environ['LOCAL_CACHE']='True'
    os.environ['TEXT_ENCODER_MODE']='local'
    os.environ['TEXT_ENCODER_DEVICE']='cpu'
    sys.path.insert(0,str(SOURCE))

def status():
    marker=RUNTIME/'2026-10-22-model-install.json'
    installed=False
    if marker.exists():
        try:
            data=json.loads(marker.read_text(encoding='utf-8'))
            files=data['files']
            installed=(data.get('repositories')==REPOS and isinstance(files,list) and bool(files)
                       and all(isinstance(p,str) and local_path(p).is_file() and local_path(p).stat().st_size>0
                               for p in files))
        except (ValueError,KeyError,OSError,TypeError): pass
    deps=['torch','numpy','transformers','peft','hydra','omegaconf','einops','huggingface_hub']
    missing=[name for name in deps if importlib.util.find_spec(name) is None]
    return {'installed':installed,'model':MODEL,'repositories':REPOS,'runtime':str(RUNTIME),
            'python':sys.executable,'sourcePresent':SOURCE.is_dir(),
            'textEncoderDevice':'cpu','offlineGeneration':True,'runtimeReady':not missing,
            'missingDependencies':missing,'cudaProbe':'not-run','gatedBase':True}

def matrix_quaternion(m):
    if not all(math.isfinite(float(v)) for row in m for v in row): raise ValueError('Nonfinite rotation')
    trace=m[0][0]+m[1][1]+m[2][2]
    if trace>0:
        s=math.sqrt(trace+1)*2
        q=[(m[2][1]-m[1][2])/s,(m[0][2]-m[2][0])/s,(m[1][0]-m[0][1])/s,s/4]
    else:
        i=max(range(3), key=lambda k:m[k][k]); j=(i+1)%3; k=(i+2)%3
        s=math.sqrt(max(0,1+m[i][i]-m[j][j]-m[k][k]))*2
        if s<1e-10: raise ValueError('Invalid rotation matrix')
        q=[0.,0.,0.,0.]; q[i]=s/4; q[j]=(m[i][j]+m[j][i])/s
        q[k]=(m[i][k]+m[k][i])/s; q[3]=(m[k][j]-m[j][k])/s
    norm=math.sqrt(sum(v*v for v in q))
    return [float(v/norm) for v in q]

def motion_document(rot, roots, skeleton, prompt=None):
    import numpy as np
    rot=np.asarray(rot); roots=np.asarray(roots)
    if rot.ndim==5 and rot.shape[0]==1: rot=rot[0]
    if roots.ndim==3 and roots.shape[0]==1: roots=roots[0]
    if rot.ndim!=4 or rot.shape[-2:]!=(3,3): raise ValueError('Expected (T,J,3,3) rotations')
    t,j=rot.shape[:2]
    if not 1<=t<=1800 or roots.shape!=(t,3): raise ValueError('Invalid frame count/root shape')
    if j!=len(skeleton.bone_order_names): raise ValueError('Skeleton joint count mismatch')
    if not np.isfinite(rot).all() or not np.isfinite(roots).all(): raise ValueError('Nonfinite motion')
    if not np.allclose(rot@np.swapaxes(rot,-1,-2),np.eye(3),atol=.02) or not np.allclose(np.linalg.det(rot),1,atol=.02):
        raise ValueError('Rotations must be orthonormal with determinant +1')
    return {'version':1,'source':'kimodo','fps':30,'frames':t,
      'jointNames':list(skeleton.bone_order_names),'parents':skeleton.joint_parents.cpu().tolist(),
      'restPositions':skeleton.neutral_joints.detach().cpu().tolist(),
      'localRotations':[[matrix_quaternion(m) for m in frame] for frame in rot],
      'rootPositions':roots.tolist(),'prompt':prompt,'duration':t/30,'model':MODEL}

def write_document(output, doc):
    payload=json.dumps(doc,ensure_ascii=False,allow_nan=False)
    output.parent.mkdir(parents=True,exist_ok=True)
    with output.open('x',encoding='utf-8') as f: f.write(payload)

def model_entries(info):
    return [s for s in info.siblings if s.rfilename.endswith(('.json','.yaml','.safetensors','.model','.txt'))
            and not s.rfilename.startswith(('original/','onnx/'))]

def catalog():
    configure(False)
    from huggingface_hub import HfApi, get_hf_file_metadata, hf_hub_url
    token=os.environ.get('PREVIS_HF_TOKEN') or False
    api=HfApi(); plan=[]
    for repo in REPOS:
        try:
            info=api.model_info(repo,files_metadata=True,token=token)
        except Exception as exc:
            raise PermissionError('Model metadata access failed: '+repo+' ('+type(exc).__name__+').') from None
        entries=model_entries(info)
        for s in entries:
            try:
                get_hf_file_metadata(hf_hub_url(repo,s.rfilename,revision=info.sha),token=token)
            except Exception as exc:
                raise PermissionError('Model access preflight failed before downloads: '+repo+'/'+s.rfilename+
                  '. Llama base requires approved Hugging Face access via PREVIS_HF_TOKEN; '
                  'no credentials are read from external caches. ('+type(exc).__name__+').') from None
        plan.append((repo,info.sha,entries))
    return plan

def install_model():
    if status()['installed']:
        return {**status(),'alreadyInstalled':True}
    configure(False)
    from huggingface_hub import hf_hub_download
    plan=catalog()  # All repositories/files must pass access before downloading any model.
    files=[]
    for repo,revision,entries in plan:
        if not entries: raise RuntimeError('No model files found: '+repo)
        emit('progress',stage='download',repository=repo,totalBytes=sum(s.size or 0 for s in entries))
        for i,s in enumerate(entries):
            emit('progress',stage='download',repository=repo,file=s.rfilename,index=i+1,total=len(entries))
            try:
                files.append(hf_hub_download(repo,s.rfilename,revision=revision,token=os.environ.get('PREVIS_HF_TOKEN') or False))
            except Exception as exc:
                raise RuntimeError('Model file download failed: '+repo+'/'+s.rfilename+' ('+type(exc).__name__+').') from None
    # Downloads pinned by SHA do not necessarily create refs/main. Upstream loaders
    # resolve the repository default revision offline, so record the verified SHA.
    for repo,revision,_entries in plan:
        write_cache_reference(repo,revision)
    write_install_marker(files)
    return status()

def write_cache_reference(repo,revision):
    if repo not in REPOS or not re.fullmatch('[0-9a-f]{40}',revision):
        raise ValueError('Invalid model cache reference')
    reference=RUNTIME/'huggingface'/'hub'/('models--'+repo.replace('/','--'))/'refs'/'main'
    reference.parent.mkdir(parents=True,exist_ok=True)
    with tempfile.NamedTemporaryFile(mode='w',encoding='utf-8',dir=reference.parent,
         prefix='2026-10-22-reference-',suffix='.tmp',delete=False) as stream:
        temporary=Path(stream.name)
        stream.write(revision)
        stream.flush()
        os.fsync(stream.fileno())
    try: os.replace(temporary,reference)
    finally:
        if temporary.exists(): temporary.unlink()

def write_install_marker(files):
    """Keep relocatable cache references; replace stale state only after complete download."""
    relative=[local_path(p).relative_to(ROOT).as_posix() for p in files]
    if not relative or not all(local_path(p).is_file() and local_path(p).stat().st_size>0 for p in relative):
        raise ValueError('Cannot mark missing or empty model files as installed')
    RUNTIME.mkdir(parents=True,exist_ok=True)
    marker=RUNTIME/'2026-10-22-model-install.json'
    temporary=None
    try:
        with tempfile.NamedTemporaryFile(mode='w',encoding='utf-8',dir=RUNTIME,
             prefix='2026-10-22-install-',suffix='.tmp',delete=False) as stream:
            temporary=Path(stream.name)
            json.dump({'version':1,'files':relative,'repositories':REPOS},stream)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary,marker)
    finally:
        if temporary is not None and temporary.exists(): temporary.unlink()

def convert(args):
    output=new_output(args.output); source=local_path(args.input)
    configure()
    import numpy as np
    from kimodo.skeleton.registry import build_skeleton
    if source.stat().st_size>300_000_000: raise ValueError('Input exceeds 300 MB')
    with zipfile.ZipFile(source) as archive:
        if sum(i.file_size for i in archive.infolist())>300_000_000: raise ValueError('Expanded NPZ exceeds 300 MB')
    with np.load(source,allow_pickle=False) as z:
        if 'local_rot_mats' in z.files:
            rot=z['local_rot_mats']; roots=z['root_positions']
            if rot.ndim not in (4,5): raise ValueError('Invalid rotation dimensions')
            skeleton=build_skeleton(int(rot.shape[-3]))
        elif 'global_rot_mats' in z.files and 'posed_joints' in z.files:
            global_rots=z['global_rot_mats']; posed=z['posed_joints']
            if global_rots.ndim==5 and global_rots.shape[0]==1: global_rots=global_rots[0]
            if posed.ndim==4 and posed.shape[0]==1: posed=posed[0]
            if global_rots.ndim!=4 or posed.shape!=global_rots.shape[:2]+(3,):
                raise ValueError('Invalid global rotation/posed joint shape')
            if not 1<=global_rots.shape[0]<=1800: raise ValueError('Invalid frame count')
            skeleton=build_skeleton(int(global_rots.shape[-3]))
            rot=global_to_local(global_rots,skeleton.joint_parents.cpu().tolist(),skeleton.root_idx)
            roots=posed[:,skeleton.root_idx]
        else: raise ValueError('NPZ requires local_rot_mats/root_positions or global_rot_mats/posed_joints')
        prompt=None
        metadata=source.with_name('meta.json')
        if metadata.is_file() and metadata.stat().st_size<100_000:
            try:
                value=json.loads(metadata.read_text(encoding='utf-8')).get('text')
                if isinstance(value,str): prompt=value[:4000]
            except (ValueError,OSError): pass
        doc=motion_document(rot,roots,skeleton,prompt)
        doc['model']=None  # Existing files do not establish which model/version generated them.
        doc['provenance']='imported-npz'
    write_document(output,doc)
    return {'output':str(output),'frames':doc['frames']}

def global_to_local(global_rots,parents,root_idx):
    import numpy as np
    global_rots=np.asarray(global_rots)
    parent_rots=global_rots[:,parents].copy()
    parent_rots[:,root_idx]=np.eye(3)
    return np.swapaxes(parent_rots,-1,-2)@global_rots

def generate(args):
    output=new_output(args.output)
    if not args.prompt.strip() or len(args.prompt)>4000: raise ValueError('Prompt must contain 1-4000 characters')
    if not math.isfinite(args.duration) or not .5<=args.duration<=60: raise ValueError('Duration must be 0.5-60 seconds')
    if not status()['installed']: raise RuntimeError('Models are not installed. Run install-model first.')
    configure()
    import torch
    from kimodo import load_model
    from kimodo.tools import seed_everything
    if not torch.cuda.is_available(): raise RuntimeError('CUDA PyTorch and a supported GPU are required')
    emit('progress',stage='loading',message='Loading Kimodo GPU model and CPU text encoder')
    with contextlib.redirect_stdout(sys.stderr):
        seed_everything(args.seed)
        model=load_model('Kimodo-SOMA-RP-v1.2',device='cuda')
        if float(model.fps)!=30: raise ValueError('Only 30 fps models are supported')
    emit('progress',stage='generating',message='Generating motion; CPU text encoding can take several minutes')
    with contextlib.redirect_stdout(sys.stderr), torch.inference_mode():
        result=model([args.prompt],[round(args.duration*30)],constraint_lst=[],num_samples=1,
          num_denoising_steps=100,multi_prompt=True,num_transition_frames=5,
          post_processing=False,return_numpy=True)
        doc=motion_document(result['local_rot_mats'],result['root_positions'],model.output_skeleton,args.prompt)
    write_document(output,doc)
    return {'output':str(output),'frames':doc['frames'],'model':MODEL,'postProcessing':False}

def main():
    parser=argparse.ArgumentParser(); sub=parser.add_subparsers(dest='command',required=True)
    for cmd in ('status','catalog','install-model'): sub.add_parser(cmd)
    c=sub.add_parser('convert'); c.add_argument('--input',required=True); c.add_argument('--output',required=True)
    g=sub.add_parser('generate'); g.add_argument('--prompt',required=True); g.add_argument('--duration',type=float,default=3)
    g.add_argument('--output',required=True); g.add_argument('--seed',type=int,default=42)
    args=parser.parse_args()
    try:
        if args.command=='status': result=status()
        elif args.command=='catalog':
            result={'repositories':REPOS,'textEncoder':'LLM2Vec Llama-3 8B + two PEFT adapters',
              'knownBaseWeightBytes':16060556376,'gatedBase':True,'access':'Hugging Face manual approval required',
              'metadataChecked':'2026-10-22','sizeBytes':17547694835}
        elif args.command=='install-model': result=install_model()
        elif args.command=='convert':
            with contextlib.redirect_stdout(sys.stderr): result=convert(args)
        else: result=generate(args)
        emit('result',**result)
    except Exception as exc:
        # Never serialize library tracebacks or environment credentials to the renderer.
        message=str(exc)
        secret=os.environ.get('PREVIS_HF_TOKEN')
        if secret: message=message.replace(secret,'[redacted]')
        emit('error',message=message,code=type(exc).__name__); return 1
    return 0

if __name__=='__main__': sys.exit(main())
