import {Vector3,Raycaster,Box3,PerspectiveCamera} from 'three';
import {createPropModel} from './2026-10-23-props.mjs';
import {evaluateActor} from '../2026-10-23-core.mjs';
const surface={bench:.52,chair:.52,sofa:.56};
const point=a=>a.path?.length>1?a.path.at(-1):a.position;
const yawTo=(a,b)=>Math.atan2(b[0]-a[0],b[2]-a[2]);
const wantsRelation=(text,actors)=>{
 if(/(?:카메라|창밖|바다|정면)(?:를|을|쪽을)?\s*바라|look(?:s|ing)?\s+at\s+(?:the\s+)?camera/i.test(text))return false;
 if(/서로|마주|대화|다가가|다가간|다가오|접근|건네|전달|face each|approach|conversation/i.test(text))return true;
 return actors.some(a=>{const alias=a.name.split(/[ ·]/)[0].replace(/[.*+?^${}()|[\]\\]/g,'\\$&');return alias&&new RegExp(alias+'(?:를|을)\\s*바라','i').test(text)});
};
const deliberateRear=text=>/뒷모습|후면|등 뒤|뒤에서|rear view|back view|from behind/i.test(text);
export function orientInteractionSeats(project,text,report){
 const relations=[];if(!wantsRelation(text,project.actors)||deliberateRear(text))return relations;
 if(project.actors.length!==2){if(project.actors.length>2)report.warnings.push('인물이 여러 명이어서 서로 바라볼 대상을 자동 결정하지 않았습니다. 구도와 방향을 확인하세요.');return relations}
 const seated=project.actors.filter(a=>a.action==='sit'&&(a.clips??[]).every(c=>c.action==='sit'));
 if(seated.length!==1){report.warnings.push('좌석 방향 자동 보정은 두 사람 중 한 명이 앉은 장면에 적용됩니다. 인물 방향을 확인하세요.');return relations}
 const sitter=seated[0],partner=project.actors.find(a=>a!==sitter),destination=point(partner);
 const seats=project.props.filter(p=>surface[p.kind]&&Math.hypot(p.position[0]-sitter.position[0],p.position[2]-sitter.position[2])<Math.max(.8,1.6*p.scale[0]/2+.3)).sort((a,b)=>Math.hypot(a.position[0]-sitter.position[0],a.position[2]-sitter.position[2])-Math.hypot(b.position[0]-sitter.position[0],b.position[2]-sitter.position[2]));
 const seat=seats[0];if(!seat)return relations;
 const front=[-Math.sin(seat.rotation??0),0,-Math.cos(seat.rotation??0)],delta=[destination[0]-sitter.position[0],0,destination[2]-sitter.position[2]];
 if(front[0]*delta[0]+front[2]*delta[2]<0){seat.rotation=(seat.rotation??0)+Math.PI;delete seat.rotation3D;report.corrections.push(`${seat.name}: 상대 인물이 등받이 뒤쪽에 있어 좌석을 180도 돌렸습니다.`)}
 relations.push({sitterId:sitter.id,partnerId:partner.id,seatId:seat.id});return relations;
}
export function actorShotPoints(project,actor,time,upper=false){
 const p=evaluateActor(actor,time).position,seat=project.props.find(s=>s.id===actor.seatPropId),size=actor.sizeScale??1;
 const hip=seat?seat.position[1]+surface[seat.kind]*seat.scale[1]+.08*size:p[1]+.95*size;
 const head=seat?hip+.65*size:p[1]+1.75*size,low=upper?hip:Math.min(p[1]+.05,hip);
 return [[p[0]-.28*size,low,p[2]],[p[0]+.28*size,low,p[2]],[p[0],head+.08*size,p[2]]];
}
function obstacles(project){const models=project.props.map(p=>{const m=createPropModel(p.kind,p.color);m.position.fromArray(p.position);m.rotation.set(...(p.rotation3D??[0,p.rotation??0,0]));m.scale.fromArray(p.scale);m.updateMatrixWorld(true);return m});return {models,dispose(){const materials=new Set();for(const m of models)m.traverse(o=>{o.geometry?.dispose();for(const mat of o.material?(Array.isArray(o.material)?o.material:[o.material]):[])materials.add(mat)});materials.forEach(m=>m.dispose())}}}
function cutTimes(project,cut){
 const times=[cut.start,cut.end];const n=Math.max(1,Math.ceil((cut.end-cut.start)*4));for(let i=0;i<=n;i++)times.push(cut.start+(cut.end-cut.start)*i/n);
 for(const a of project.actors){const moves=(a.clips??[{action:a.action,start:a.start,end:a.end}]).filter(c=>['walk','run'].includes(c.action)).sort((a,b)=>a.start-b.start);for(const c of a.clips??[])times.push(c.start,c.end);const lengths=(a.path??[]).slice(1).map((p,i)=>Math.hypot(...p.map((v,k)=>v-a.path[i][k]))),total=lengths.reduce((n,v)=>n+v,0),duration=moves.reduce((n,c)=>n+c.end-c.start,0);let travelled=0;for(const length of lengths){travelled+=length;let elapsed=total?travelled/total*duration:0;for(const c of moves){if(elapsed<=c.end-c.start){times.push(c.start+elapsed);break}elapsed-=c.end-c.start}}}
 return [...new Set(times.filter(t=>t>=cut.start&&t<=cut.end))].sort((a,b)=>a-b);
}
function targets(project,cut){const times=cutTimes(project,cut);return times.flatMap(time=>project.actors.flatMap(a=>{const pts=actorShotPoints(project,a,time,true),head=pts[2],torso=[head[0],(head[1]+pts[0][1])/2,head[2]];return [head,torso]}))}
function visible(position,points,models){const origin=new Vector3(...position);if(models.some(m=>new Box3().setFromObject(m).containsPoint(origin)))return false;const ray=new Raycaster();for(const point of points){const delta=new Vector3(...point).sub(origin),length=delta.length();if(length<.1)return false;ray.set(origin,delta.normalize());ray.far=length-.04;ray.near=.02;if(models.some(m=>ray.intersectObject(m,true).length))return false}return true}
export function inspectShotCoverage(project,camera,cut,upper=false){const cam=new PerspectiveCamera(camera.fov,16/9,.01,1000);cam.position.fromArray(camera.position);cam.lookAt(...camera.target);cam.updateMatrixWorld(true);const points=cutTimes(project,cut).flatMap(t=>project.actors.flatMap(a=>actorShotPoints(project,a,t,upper)));return points.map(p=>new Vector3(...p).project(cam).toArray())}
export function shotHasClearSubjects(project,camera,cut){const scene=obstacles(project);try{return visible(camera.position,targets(project,cut),scene.models)}finally{scene.dispose()}}
function fittedCamera(camera,points,direction){const center=new Vector3();const bounds=new Box3().setFromPoints(points.map(p=>new Vector3(...p)));bounds.getCenter(center);const back=direction.clone().normalize();if(Math.hypot(back.x,back.z)<.1)back.z=1;back.normalize();const forward=back.clone().negate(),right=new Vector3().crossVectors(forward,new Vector3(0,1,0)).normalize(),up=new Vector3().crossVectors(right,forward).normalize(),tan=Math.tan(camera.fov*Math.PI/360);let distance=1.5;for(const p of points){const q=new Vector3(...p).sub(center);distance=Math.max(distance,q.dot(back)+Math.abs(q.dot(up))/tan,q.dot(back)+Math.abs(q.dot(right))/(tan*16/9))}return {...camera,position:center.clone().addScaledVector(back,distance*1.15+.15).toArray(),target:center.toArray()}}
export function finishInteractionFraming(project,text,relations,report){
 for(const {sitterId,partnerId} of relations){const sitter=project.actors.find(a=>a.id===sitterId),partner=project.actors.find(a=>a.id===partnerId);if(!sitter.seatPropId)continue;sitter.rotation=yawTo(sitter.position,point(partner));delete sitter.rotation3D;partner.arrivalRotation=yawTo(point(partner),sitter.position);if(partner.path.length<2){partner.rotation=partner.arrivalRotation;delete partner.rotation3D}for(const l of sitter.layers??[])if(l.mask==='head'&&l.clips.some(c=>c.action==='turn')){l.enabled=false;report.warnings.push(`${sitter.name}: 대상이 지정되지 않은 고개 돌리기를 껐습니다. 몸 방향을 상대에게 맞추며 정확한 눈맞춤은 지원하지 않습니다.`)}report.corrections.push(`${sitter.name}와 ${partner.name}: 도착 후 서로를 향하도록 몸 방향을 맞췄습니다.`)}
 const handText=/봉투|주머니|소품.*전달|envelope|handoff/i.test(text);
 for(const camera of project.cameras){if(handText&&/손|봉투|hand|envelope/i.test(camera.name)){camera.name=camera.name.replace(/손동작|손과.*봉투|손.*봉투|봉투|손|hands?|envelope/gi,'두 사람 상반신').slice(0,120);report.corrections.push(`${camera.name}: 구현되지 않은 전달 동작 대신 인물 상반신 구도로 바꿨습니다.`)}}
 if(!relations.length)return;
 const scene=obstacles(project);
 try{for(const camera of project.cameras){const cuts=project.cuts.filter(c=>c.cameraId===camera.id);if(!cuts.length)continue;if(camera.motion&&camera.motion.type!=='static'){report.warnings.push(`${camera.name}: 움직이는 카메라는 관계 구도를 자동 보정하지 않습니다. 가림과 프레이밍을 확인하세요.`);continue}
  const upper=/상반신|미디엄|클로즈|medium|close/i.test(camera.name),points=cuts.flatMap(c=>cutTimes(project,c).flatMap(t=>project.actors.flatMap(a=>actorShotPoints(project,a,t,upper)))),center=new Box3().setFromPoints(points.map(p=>new Vector3(...p))).getCenter(new Vector3()),seat=project.props.find(p=>p.id===relations[0].seatId),front=new Vector3(-Math.sin(seat.rotation),0,-Math.cos(seat.rotation));let direction=new Vector3(...camera.position).sub(center);
  if(direction.dot(front)<0)direction.addScaledVector(front,-2*direction.dot(front));
  const originalDirection=direction.clone(),candidates=[0,.45,-.45,.9,-.9,1.35,-1.35];let chosen=null;
  for(const angle of candidates){const dir=originalDirection.clone().applyAxisAngle(new Vector3(0,1,0),angle);if(dir.dot(front)<0)continue;const candidate=fittedCamera(camera,points,dir),sitter=project.actors.find(a=>a.id===relations[0].sitterId),view=new Vector3(...candidate.position).sub(new Vector3(...sitter.position)),face=new Vector3(Math.sin(sitter.rotation),0,Math.cos(sitter.rotation));if(view.dot(face)<=.15*Math.hypot(view.x,view.z))continue;if(cuts.every(c=>visible(candidate.position,targets(project,c),scene.models))){chosen=candidate;break}}
  if(chosen){camera.position=chosen.position;camera.target=chosen.target;report.corrections.push(`${camera.name}: 상대가 보이는 좌석 앞쪽에서 인물을 화면에 맞추고 소품 가림을 확인했습니다.`)}else report.blockers.push(`${camera.name}: 두 인물이 소품에 가리지 않는 구도를 찾지 못했습니다. 소품·카메라 위치를 바꿔 다시 구성하세요.`);
 }}finally{scene.dispose()}
}
export function auditMissingSceneElements(project,text,report){
 const groups=[[/여행\s*가방|캐리어|suitcase/i,/여행\s*가방|캐리어|suitcase/i,'여행 가방'],[/봉투|envelope/i,/봉투|envelope/i,'봉투'],[/스마트폰|휴대폰|smartphone/i,/스마트폰|휴대폰|smartphone/i,'스마트폰'],[/벤치|bench/i,/벤치|bench/i,'벤치'],[/테이블|table/i,/테이블|table/i,'테이블'],[/의자|chair/i,/의자|chair/i,'의자']];
 for(const [requested,found,label] of groups)if(requested.test(text)&&!project.props.some(p=>found.test(p.name+' '+p.kind)))report.warnings.push(`요청 요소 확인: ${label} 이름의 소품이 구성안에 없습니다. 미반영 여부를 확인하세요.`);
}
