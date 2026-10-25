const BASE='http://127.0.0.1:8768';
export function createAIClient(fetcher=(...args)=>fetch(...args),options={}){
 let token=null,epoch=0,connectorInfo=null;
 const key='sceneblock.ai.session.v1',now=options.now||Date.now,maxAge=options.maxSessionAge??30*60*1000;
 let storage=options.storage,origin=options.origin;
 try{if(storage===undefined)storage=globalThis.sessionStorage;if(origin===undefined)origin=globalThis.location?.origin}catch{}
 const clearSaved=()=>{try{storage?.removeItem(key)}catch{}};
 const save=()=>{if(token&&origin)try{storage?.setItem(key,JSON.stringify({version:1,token,origin,savedAt:now()}))}catch{}};
 const saved=()=>{try{const raw=storage?.getItem(key);if(!raw)return null;const v=JSON.parse(raw);if(v.version!==1||typeof v.token!=='string'||!v.token||v.token.length>4096||!origin||v.origin!==origin||!Number.isFinite(v.savedAt)||v.savedAt>now()+5000||now()-v.savedAt>maxAge){clearSaved();return null}return v}catch{clearSaved();return null}};
 const invalidate=()=>{token=null;connectorInfo=null;epoch++;clearSaved()};
 const cancelled=()=>Error('연결을 취소했습니다.');
 async function request(path,{body,auth=true,timeout=12000,signal}={}){
  const requestToken=token,requestEpoch=epoch;const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeout),abort=()=>controller.abort();signal?.addEventListener('abort',abort,{once:true});
  try{const response=await fetcher(BASE+path,{method:body?'POST':'GET',headers:{...(body?{'Content-Type':'application/json'}:{}),...(auth&&requestToken?{Authorization:'Bearer '+requestToken}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:controller.signal,credentials:'omit',cache:'no-store'});const result=await response.json();if(!response.ok){if(auth&&response.status===401&&token===requestToken&&epoch===requestEpoch)invalidate();throw Object.assign(Error(response.status===401?(result.error?result.error+' · ':'')+'AI 연결이 만료되었습니다. AI 연결을 눌러 다시 승인하세요.':result.error||'연결 요청을 처리하지 못했습니다.'),{status:response.status})}return result}
  catch(error){if(error.name==='AbortError')throw Error(signal?.aborted?'요청을 취소했습니다.':'연결 응답 시간이 초과되었습니다. 연결 프로그램과 AI 상태를 확인하세요.');if(error instanceof TypeError)throw Error('AI 연결에 접속하지 못했습니다. 웹의 AI 연결을 누르고 앱 열기·사이트 승인·브라우저 로컬 네트워크 권한을 확인하세요.');throw error}
  finally{clearTimeout(timer);signal?.removeEventListener('abort',abort)}
 }
 const api={
  async probe(){const current=epoch,h=await request('/health',{auth:false,timeout:2500});if(current!==epoch)throw cancelled();if(h.service!=='sceneblock-ai'||h.protocol!==2){invalidate();throw Object.assign(Error('호환되지 않는 AI 연결 기능입니다. 설치 프로그램에서 연결 복구를 실행하세요.'),{code:'INCOMPATIBLE'})}connectorInfo={service:h.service,protocol:h.protocol,version:typeof h.version==='string'?h.version:null,responseFormats:Array.isArray(h.responseFormats)?h.responseFormats.filter(x=>typeof x==='string'):[]};return h},
  async authorize(nonce){const current=++epoch;const result=await request('/connect',{body:{nonce},auth:false,timeout:4000});if(typeof result.token!=='string'||!result.token)throw Error('사이트 승인에 실패했습니다.');if(current!==epoch){try{await fetcher(BASE+'/release',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+result.token},body:'{}',credentials:'omit'})}catch{}throw cancelled()}token=result.token;save();return result},
  status:()=>request('/status',{timeout:40000}),async lease(){const current=epoch,result=await request('/lease',{body:{},timeout:5000});if(current!==epoch)throw cancelled();save();return result},
  hasSavedSession:()=>Boolean(saved()),
  async restore(){const entry=saved();if(!entry)throw Object.assign(Error('저장된 AI 연결이 없습니다. AI 연결을 눌러 다시 승인하세요.'),{code:'NO_SAVED_SESSION'});const current=++epoch;token=entry.token;const result=await api.lease();if(current!==epoch)throw cancelled();if(result?.connected!==true)throw Object.assign(Error('AI 연결 상태를 확인하지 못했습니다. 다시 시도하세요.'),{code:'INVALID_LEASE'});await api.probe();if(current!==epoch)throw cancelled();return result},
  preserveForNavigation:()=>save(),
  generateIntent:(provider,prompt,context,signal)=>request('/generate-intent',{body:{provider,prompt,context},timeout:190000,signal}),
  generate:(provider,prompt,context,signal)=>request('/generate',{body:{provider,prompt,context},timeout:190000,signal}),
  async disconnect(){const current=token;invalidate();if(current)try{await fetcher(BASE+'/release',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+current},body:'{}',credentials:'omit',keepalive:true})}catch{}},connectorInfo:()=>connectorInfo?{...connectorInfo}:null,connected:()=>Boolean(token)
 };
 return api;
}
