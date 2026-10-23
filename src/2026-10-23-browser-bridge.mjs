import {validateProject} from '../2026-10-23-core.mjs';
import {validateMotion} from '../2026-10-23-motion.mjs';
const ENGINE='http://127.0.0.1:8765';
const MAX_FILE=100*1024*1024;
export function createBrowserBridge(options={}){
  const win=options.window??globalThis.window??{},doc=options.document??globalThis.document;
  const fetcher=options.fetch??globalThis.fetch?.bind(globalThis),sleep=options.sleep??(ms=>new Promise(r=>setTimeout(r,ms)));
  let code='',enabled=false,cancelVersion=0,busy=false;
  const listeners=new Set();
  const requireConnection=()=>{if(!enabled||!code)throw Error('로컬 엔진 연결 코드 입력 후 Kimodo 연결을 켜세요. 기본 편집은 연결 없이 사용할 수 있습니다.');};
  const emit=value=>{for(const fn of listeners){try{fn(value);}catch{/* Listener failures must not abort a job. */}}};
  async function request(path,init={},timeout=15000){
    requireConnection();const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeout);
    try{const response=await fetcher(ENGINE+path,{...init,headers:{'Content-Type':'application/json',Authorization:`Bearer ${code}`},signal:controller.signal});if(!response.ok)throw Error(`엔진 응답 오류 (${response.status}). 연결 코드와 엔진 상태를 확인하세요.`);return await response.json();}
    catch(error){if(error.name==='AbortError')throw Error('로컬 엔진 응답 시간이 초과되었습니다. 엔진 실행 및 브라우저의 로컬 네트워크 권한을 확인하세요.');if(error instanceof TypeError)throw Error('로컬 엔진에 연결할 수 없습니다. 127.0.0.1:8765 엔진 실행과 브라우저 로컬 네트워크 권한을 확인하세요.');throw error;}finally{clearTimeout(timer);}
  }
  async function job(kind,args,limit){
    requireConnection();if(busy)throw Error('진행 중인 엔진 작업이 있습니다. 완료 또는 취소 후 다시 시도하세요.');busy=true;const version=cancelVersion,deadline=Date.now()+limit;
    try{const created=await request('/v1/jobs',{method:'POST',body:JSON.stringify({kind,args})});args=null;if(typeof created.jobId!=='string'||!created.jobId)throw Error('엔진 작업 ID가 없습니다. 엔진을 확인하세요.');
      while(Date.now()<deadline){if(version!==cancelVersion)return {canceled:true};const value=await request(`/v1/jobs/${encodeURIComponent(created.jobId)}`,{},10000);if(value.progress)emit(value.progress);if(value.state==='completed')return value.result;if(value.state==='canceled')return {canceled:true};if(value.state==='failed')throw Error(typeof value.error==='string'?value.error:'엔진 작업에 실패했습니다. 엔진 로그를 확인하세요.');if(value.state!=='running'&&value.state!=='queued')throw Error('엔진 작업 상태가 올바르지 않습니다.');await sleep(500);}throw Error('엔진 작업 제한 시간이 초과되었습니다. 엔진 상태를 확인하고 취소 후 다시 시도하세요.');
    }finally{busy=false;}
  }
  const filename=extension=>`${new Date().toISOString().slice(0,10)}-SceneBlock-v2.6.0.${extension}`;
  function download(blob,name){if(!doc)throw Error('브라우저 다운로드 기능을 사용할 수 없습니다.');const urlApi=options.URL??globalThis.URL,url=urlApi.createObjectURL(blob),a=doc.createElement('a');a.href=url;a.download=name;a.style.display='none';doc.body.appendChild(a);a.click();a.remove();const cleanupTimer=setTimeout(()=>urlApi.revokeObjectURL(url),60000);cleanupTimer.unref?.();return {saved:true};}
  async function saveBlob(blob,name,types){
    if(win.showSaveFilePicker){let handle;try{handle=await win.showSaveFilePicker({suggestedName:name,types});}catch(error){if(error.name==='AbortError')return {saved:false,canceled:true};if(error.name!=='SecurityError'&&error.name!=='NotAllowedError')throw error;return download(blob,name);}const stream=await handle.createWritable();try{await stream.write(blob);await stream.close();}catch(error){await stream.abort?.().catch(()=>{});throw error;}return {saved:true};}return download(blob,name);
  }
  async function readProject(file){if(!file||file.size>MAX_FILE)throw Error('프로젝트 파일은 100MB 이하만 열 수 있습니다.');return {project:validateProject(JSON.parse(await file.text()))};}
  function inputFile(){return new Promise((resolve,reject)=>{if(!doc){reject(Error('브라우저 파일 선택 기능을 사용할 수 없습니다.'));return;}const input=doc.createElement('input');input.type='file';input.accept='.json,.previs.json';input.style.display='none';let settled=false;const done=(value,error)=>{if(settled)return;settled=true;win.removeEventListener?.('focus',focus);input.remove();error?reject(error):resolve(value);};const focus=()=>setTimeout(()=>{if(!settled&&!input.files?.length)done({canceled:true});},500);input.addEventListener('change',()=>{const file=input.files?.[0];if(!file)done({canceled:true});else readProject(file).then(v=>done(v),e=>done(null,e));});input.addEventListener('cancel',()=>done({canceled:true}));win.addEventListener?.('focus',focus);doc.body.appendChild(input);input.click();});}
  return {
    async saveProject(project){const clean=validateProject(project);return saveBlob(new Blob([JSON.stringify(clean,null,2)],{type:'application/json'}),filename('previs.json'),[{description:'Previs 프로젝트',accept:{'application/json':['.json']}}]);},
    async openProject(){if(!win.showOpenFilePicker)return inputFile();try{const [handle]=await win.showOpenFilePicker({multiple:false,types:[{description:'Previs 프로젝트',accept:{'application/json':['.json']}}]});return await readProject(await handle.getFile());}catch(error){if(error.name==='AbortError')return {canceled:true};throw error;}},
    async exportVideo({bytes,extension}){if(extension!=='webm'||!(bytes instanceof ArrayBuffer))throw Error('WebM ArrayBuffer 동영상만 저장할 수 있습니다.');return saveBlob(new Blob([bytes],{type:'video/webm'}),filename('webm'),[{description:'WebM 동영상',accept:{'video/webm':['.webm']}}]);},
    async sampleMotion(){const response=await fetcher('/motions/2026-10-23-kimodo-example.json');if(!response.ok)throw Error('사전 녹화 모션 예제를 불러오지 못했습니다.');const motion=await response.json();validateMotion(motion);return {motion:{...motion,prerecorded:true}};},
    configureConnection({code:value}={}){if(typeof value!=='string'||value.trim().length<1||value.length>512||/[\r\n]/.test(value))throw Error('올바른 연결 코드를 입력하세요.');code=value.trim();enabled=false;return {configured:true};},
    disconnect(){enabled=false;code='';cancelVersion++;return {enabled:false};},
    async enableKimodo(value){if(!value){enabled=false;code='';cancelVersion++;return {enabled:false};}if(!code)throw Error('먼저 로컬 엔진 연결 코드를 입력하세요.');enabled=true;return {enabled:true};},
    async status(){if(!enabled)return {enabled:false,connected:false};return {...await request('/v1/status'),enabled:true,connected:true};},
    async setup(){return job('setup',{},30*60*1000);},
    async installModel({token}={}){if(typeof token!=='string'||!token.trim())throw Error('모델 다운로드 토큰을 입력하세요.');return job('installModel',{token},2*60*60*1000);},
    async generate({prompt,duration,seed}={}){if(typeof prompt!=='string'||!prompt.trim()||prompt.length>4000||!Number.isFinite(duration)||duration<.5||duration>60||!Number.isInteger(seed))throw Error('프롬프트(1~4000자), 시간(0.5~60초), 정수 시드를 확인하세요.');return job('generate',{prompt,duration,seed},30*60*1000);},
    async cancel(){requireConnection();cancelVersion++;return request('/v1/cancel',{method:'POST',body:'{}'});},
    onProgress(fn){if(typeof fn!=='function')throw TypeError('진행률 콜백이 필요합니다.');listeners.add(fn);return ()=>listeners.delete(fn);}
  };
}


