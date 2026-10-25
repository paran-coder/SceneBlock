import http from 'node:http';
import {randomBytes,randomInt,timingSafeEqual} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {consumeGrant,createLeases} from './2026-10-23-sessions.mjs';
import {createProviders} from './2026-10-23-providers.mjs';
export function allowedOrigin(origin){try{const u=new URL(origin);if(u.origin!==origin)return false;return origin==='https://scene-block.vercel.app'||u.protocol==='http:'&&['localhost','127.0.0.1'].includes(u.hostname)&&['4173','4174','5173','5174','8767'].includes(u.port)}catch{return false}}
const safeEqual=(a,b)=>{if(typeof a!=='string'||typeof b!=='string')return false;const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y)};
export function createConnector({providers=createProviders(),code=String(randomInt(100000,1000000)),port=8766,grantDir=null,idleMs=90000,onIdle=()=>{},installation=null}={}){
 let token=null,busy=false,failures=0,windowStart=Date.now(),lastActive=Date.now();const leases=createLeases();
 const server=http.createServer(async(req,res)=>{
 const origin=req.headers.origin,host=req.headers.host;
 const reply=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...(allowedOrigin(origin)?{'Access-Control-Allow-Origin':origin,'Vary':'Origin'}:{})});res.end(JSON.stringify(data))};
 if(host!==`127.0.0.1:${port}`&&host!==`localhost:${port}`)return reply(403,{error:'허용되지 않은 Host입니다.'});
 if(grantDir&&req.method==='GET'&&req.url==='/health'&&!origin)return reply(200,{service:'sceneblock-ai',version:'2.10.0',responseFormats:['scene-plan-v1','scene-intent-v1','scene-previs-v1'],protocol:2,installation});
 if(!allowedOrigin(origin))return reply(403,{error:'허용되지 않은 사이트입니다. 공식 SceneBlock에서 연결하세요.'});
 if(req.method==='OPTIONS'){res.writeHead(204,{'Access-Control-Allow-Origin':origin,'Vary':'Origin','Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type, Authorization','Access-Control-Max-Age':'600',...(req.headers['access-control-request-private-network']==='true'?{'Access-Control-Allow-Private-Network':'true'}:{})});return res.end()}
 if(req.method==='GET'&&req.url==='/health')return reply(200,{service:'sceneblock-ai',version:'2.10.0',responseFormats:['scene-plan-v1','scene-intent-v1','scene-previs-v1'],protocol:2,installation});
 try{
 if(grantDir&&req.method==='POST'&&req.url==='/connect'){const body=await readJSON(req);if(!await consumeGrant(grantDir,body.nonce,origin))return reply(403,{error:'웹에서 AI 연결을 누르고 로컬 승인 창에서 허용하세요.'});lastActive=Date.now();return reply(200,{token:leases.issue(origin)})}
 if(req.method==='POST'&&req.url==='/pair'){
 if(grantDir)return reply(404,{error:'웹의 AI 연결 버튼을 사용하세요.'});
 if(Date.now()-windowStart>60000){windowStart=Date.now();failures=0}if(failures>=5)return reply(429,{error:'연결 시도가 많습니다. 1분 뒤 다시 시도하세요.'});const body=await readJSON(req);if(!safeEqual(body.code,code)){failures++;return reply(401,{error:'연결 코드가 일치하지 않습니다.'})}token=randomBytes(32).toString('hex');failures=0;return reply(200,{token})}
 const bearer=req.headers.authorization?.startsWith('Bearer ')?req.headers.authorization.slice(7):null;
 if(grantDir?!leases.check(bearer,origin,true):!token||!safeEqual(req.headers.authorization,`Bearer ${token}`))return reply(401,{error:'연결 코드를 입력해 먼저 연결하세요.'});
 lastActive=Date.now();if(grantDir&&req.method==='POST'&&req.url==='/lease')return reply(200,{connected:true});if(grantDir&&req.method==='POST'&&req.url==='/release'){leases.release(bearer,origin);return reply(200,{released:true})}
 if(req.method==='GET'&&req.url==='/status')return reply(200,{providers:await providers.status()});
 if(req.method==='POST'&&['/generate','/generate-intent'].includes(req.url)){
 if(busy)return reply(409,{error:'AI가 장면을 구성 중입니다. 완료 후 다시 요청하세요.'});const body=await readJSON(req,req.url==='/generate-intent'?65536:32768);if(!['codex','claude'].includes(body.provider)||typeof body.prompt!=='string'||!body.prompt.trim()||body.prompt.length>12000||body.context!==undefined&&JSON.stringify(body.context).length>8000)return reply(400,{error:'AI 종류 또는 장면 설명을 확인하세요. 설명은 최대 12,000자입니다.'});if(busy)return reply(409,{error:'AI가 장면을 구성 중입니다. 완료 후 다시 요청하세요.'});busy=true;const controller=new AbortController(),cancel=()=>{if(!res.writableEnded)controller.abort()};res.on('close',cancel);try{const intentRoute=req.url==='/generate-intent';const result=await providers[intentRoute?'generateIntent':'generate']({provider:body.provider,prompt:body.prompt,context:body.context,signal:controller.signal});return reply(200,intentRoute?{intent:result}:{plan:result})}finally{busy=false;res.removeListener('close',cancel)}}
 return reply(404,{error:'지원하지 않는 요청입니다.'});
 }catch(error){return reply(error.status??500,{error:error.status?error.message:'AI 요청을 완료하지 못했습니다. 연결 프로그램과 공식 CLI의 로그인·사용 한도를 확인하세요.'})}
 });if(grantDir){const timer=setInterval(()=>{if(!busy&&!leases.count()&&Date.now()-lastActive>idleMs){clearInterval(timer);server.close(onIdle)}},1000);timer.unref();server.on('close',()=>clearInterval(timer))}server.requestTimeout=15000;server.headersTimeout=10000;return {server,code};
}
async function readJSON(req,maxBytes=32768){if(!String(req.headers['content-type']??'').startsWith('application/json'))throw Object.assign(Error('JSON 요청이 필요합니다.'),{status:415});let size=0,chunks=[];for await(const chunk of req){size+=chunk.length;if(size>maxBytes)throw Object.assign(Error('요청이 너무 큽니다.'),{status:413});chunks.push(chunk)}try{return JSON.parse(Buffer.concat(chunks))}catch{throw Object.assign(Error('JSON 형식이 잘못되었습니다.'),{status:400})}}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){if(Number(process.versions.node.split('.')[0])<22){console.error('Node.js 22 이상이 필요합니다.');process.exit(1)}const {server,code}=createConnector();server.on('error',error=>{console.error(error.code==='EADDRINUSE'?'이미 연결 프로그램이 실행 중이거나 8766 포트를 사용 중입니다.':'연결 프로그램을 시작하지 못했습니다.');process.exitCode=1});server.listen(8766,'127.0.0.1',()=>{console.log(`SceneBlock AI 연결 프로그램 v2.10.0\n공식 사이트: https://scene-block.vercel.app\n연결 코드: ${code}\n이 창을 켜둔 상태로 사이트의 AI 연결에 코드를 입력하세요.\n설치·로그인은 자동 실행하지 않습니다. 종료: Ctrl+C`)});for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>process.exit(0)))}
