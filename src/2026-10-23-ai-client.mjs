const BASE='http://127.0.0.1:8766';
export function createAIClient(fetcher=(...args)=>fetch(...args)){
 let token=null;
 async function request(path,{body,auth=true,timeout=12000,signal}={}){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeout),abort=()=>controller.abort();signal?.addEventListener('abort',abort,{once:true});
  try{const response=await fetcher(BASE+path,{method:body?'POST':'GET',headers:{...(body?{'Content-Type':'application/json'}:{}),...(auth&&token?{Authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:controller.signal,credentials:'omit',cache:'no-store'});const result=await response.json();if(!response.ok){if(response.status===401)token=null;throw Error(result.error||'연결 요청을 처리하지 못했습니다.')}return result}
  catch(error){if(error.name==='AbortError')throw Error(signal?.aborted?'요청을 취소했습니다.':'연결 응답 시간이 초과되었습니다. 연결 프로그램과 AI 상태를 확인하세요.');if(error instanceof TypeError)throw Error('PC 연결 프로그램에 접속하지 못했습니다. 실행 창을 열어두고 브라우저의 로컬 네트워크 접근을 허용하세요.');throw error}
  finally{clearTimeout(timer);signal?.removeEventListener('abort',abort)}
 }
 return {async connect(code){token=null;const health=await request('/health',{auth:false});if(health.service!=='sceneblock-ai')throw Error('SceneBlock 연결 프로그램이 아닙니다.');const paired=await request('/pair',{body:{code:code.trim()},auth:false});if(typeof paired.token!=='string'||!paired.token)throw Error('연결 코드 확인에 실패했습니다.');token=paired.token;return request('/status',{timeout:40000})},status:()=>request('/status',{timeout:40000}),generate:(provider,prompt,context,signal)=>request('/generate',{body:{provider,prompt,context},timeout:190000,signal}),disconnect(){token=null},connected:()=>Boolean(token)};
}
