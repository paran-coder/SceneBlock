const BASE='http://127.0.0.1:8768';
export function createAIClient(fetcher=(...args)=>fetch(...args)){
 let token=null,epoch=0,connectorInfo=null;
 async function request(path,{body,auth=true,timeout=12000,signal}={}){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeout),abort=()=>controller.abort();signal?.addEventListener('abort',abort,{once:true});
  try{const response=await fetcher(BASE+path,{method:body?'POST':'GET',headers:{...(body?{'Content-Type':'application/json'}:{}),...(auth&&token?{Authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:controller.signal,credentials:'omit',cache:'no-store'});const result=await response.json();if(!response.ok){if(response.status===401)token=null;throw Error(result.error||'연결 요청을 처리하지 못했습니다.')}return result}
  catch(error){if(error.name==='AbortError')throw Error(signal?.aborted?'요청을 취소했습니다.':'연결 응답 시간이 초과되었습니다. 연결 프로그램과 AI 상태를 확인하세요.');if(error instanceof TypeError)throw Error('AI 연결에 접속하지 못했습니다. 웹의 AI 연결을 누르고 앱 열기·사이트 승인·브라우저 로컬 네트워크 권한을 확인하세요.');throw error}
  finally{clearTimeout(timer);signal?.removeEventListener('abort',abort)}
 }
 return {
  async probe(){const h=await request('/health',{auth:false,timeout:2500});if(h.service!=='sceneblock-ai'||h.protocol!==2)throw Error('호환되지 않는 AI 연결 기능입니다. 설치 프로그램에서 연결 복구를 실행하세요.');connectorInfo={service:h.service,protocol:h.protocol,version:typeof h.version==='string'?h.version:null};return h},
  async authorize(nonce){const current=epoch;const result=await request('/connect',{body:{nonce},auth:false,timeout:4000});if(typeof result.token!=='string'||!result.token)throw Error('사이트 승인에 실패했습니다.');if(current!==epoch){try{await fetcher(BASE+'/release',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+result.token},body:'{}',credentials:'omit'})}catch{}throw Error('연결을 취소했습니다.')}token=result.token;return result},
  status:()=>request('/status',{timeout:40000}),lease:()=>request('/lease',{body:{},timeout:5000}),
  generate:(provider,prompt,context,signal)=>request('/generate',{body:{provider,prompt,context},timeout:190000,signal}),
  async disconnect(){epoch++;const current=token;token=null;if(current)try{await fetcher(BASE+'/release',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+current},body:'{}',credentials:'omit',keepalive:true})}catch{}},connectorInfo:()=>connectorInfo?{...connectorInfo}:null,connected:()=>Boolean(token)
 };
}
