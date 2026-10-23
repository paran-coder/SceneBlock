import {validateMotion} from './2026-10-23-motion.mjs';
const vec = (x=0,y=0,z=0) => [x,y,z];
export const cloneProject = p => structuredClone(p);
export function createProject() {
  return {version:'1.0.0',name:'복도에서의 만남',duration:10,fps:30,
    actors:[
      {id:'actor-1',name:'인물 A',position:vec(-2,0,0),rotation:Math.PI/2,color:'#b8c3d7',action:'walk',start:0,end:5,speed:1,path:[vec(-2,0,0),vec(-0.8,0,0)],motion:null},
      {id:'actor-2',name:'인물 B',position:vec(1,0,0),rotation:-Math.PI/2,color:'#c4ad99',action:'wave',start:4,end:8,speed:1,path:[],motion:null}],
    props:[{id:'prop-1',name:'벤치',position:vec(0,0, -2),rotation:0,scale:vec(2,0.45,0.6),kind:'box',color:'#4e555e'}],
    cameras:[{id:'camera-1',name:'01 · 와이드',position:vec(5,3,7),target:vec(0,1,0),fov:45},
      {id:'camera-2',name:'02 · 인물 A',position:vec(1.3,1.65,2.2),target:vec(-0.8,1.3,0),fov:40},
      {id:'camera-3',name:'03 · 오버숄더',position:vec(-2,1.8,1),target:vec(1,1.3,0),fov:48}],
    cuts:[{cameraId:'camera-1',start:0,end:5},{cameraId:'camera-2',start:5,end:8},{cameraId:'camera-3',start:8,end:10}]};
}
const finite = (n,min,max) => typeof n==='number' && Number.isFinite(n) && n>=min && n<=max;
const vector = a => Array.isArray(a)&&a.length===3&&a.every(n=>finite(n,-10000,10000));
const text = s => typeof s==='string'&&s.length>0&&s.length<=1000;
export function validateProject(input) {
  if(!input||input.version!=='1.0.0'||!text(input.name)||!finite(input.duration,0.1,120)||!finite(input.fps,1,60)) throw Error('지원하지 않는 프로젝트 형식 또는 시간 범위입니다.');
  const ids=new Set();
  const checkId=o=>{if(!text(o.id)||!text(o.name)||ids.has(o.id))throw Error('항목 ID/이름이 잘못되었거나 중복됩니다.');ids.add(o.id);};
  for(const k of ['actors','props','cameras','cuts']) if(!Array.isArray(input[k])||input[k].length>128)throw Error('프로젝트 항목 수가 잘못되었습니다.');
  if(input.cameras.length<1)throw Error('카메라가 한 대 이상 필요합니다.');
  for(const a of input.actors){
    checkId(a);
    if(!vector(a.position)||!finite(a.rotation,-1000,1000)||!['idle','walk','wave','sit','turn'].includes(a.action)||!finite(a.start,0,input.duration)||!finite(a.end,a.start+0.01,input.duration)||!finite(a.speed,0.1,4))throw Error('인물 위치·동작·시간 설정이 잘못되었습니다.');
    if(!Array.isArray(a.path)||a.path.length>512||!a.path.every(vector))throw Error('이동 경로가 잘못되었습니다.');
    if(typeof a.color!=='string'||!/^#[a-f\d]{6}$/i.test(a.color))throw Error('인물 색상 형식이 잘못되었습니다.');
    if(a.motion!==null){
      const m=a.motion;validateMotion(m);
      if(!m||m.version!==1||m.source!=='kimodo'||!finite(m.fps,1,120)||!Number.isInteger(m.frames)||m.frames<1||m.frames>1800||!Array.isArray(m.jointNames)||m.jointNames.length<1||m.jointNames.length>128||!m.jointNames.every(text))throw Error('모션 메타데이터가 잘못되었습니다.');
      const j=m.jointNames.length;
      if(!Array.isArray(m.parents)||m.parents.length!==j||m.parents.some((p,i)=>!Number.isInteger(p)||p< -1||p>=j||p===i))throw Error('모션 골격 계층이 잘못되었습니다.');
      for(let i=0;i<j;i++){let n=i;const seen=new Set();while(n!==-1){if(seen.has(n))throw Error('모션 골격 순환 참조');seen.add(n);n=m.parents[n];}}
      if(!Array.isArray(m.restPositions)||m.restPositions.length!==j||!m.restPositions.every(vector)||!Array.isArray(m.rootPositions)||m.rootPositions.length!==m.frames||!m.rootPositions.every(vector))throw Error('모션 위치 데이터가 잘못되었습니다.');
      if(!Array.isArray(m.localRotations)||m.localRotations.length!==m.frames||!m.localRotations.every(f=>Array.isArray(f)&&f.length===j&&f.every(q=>Array.isArray(q)&&q.length===4&&q.every(x=>finite(x,-1.001,1.001))&&Math.abs(Math.hypot(...q)-1)<0.05)))throw Error('모션 회전 데이터가 잘못되었습니다.');
    }
  }
  for(const p of input.props){checkId(p);if(!vector(p.position)||!vector(p.scale)||p.scale.some(v=>v<=0)||!finite(p.rotation,-1000,1000)||!['box','table','wall'].includes(p.kind)||!/^#[a-f\d]{6}$/i.test(p.color))throw Error('소품 설정이 잘못되었습니다.');}
  const cams=new Set();
  for(const c of input.cameras){checkId(c);cams.add(c.id);if(!vector(c.position)||!vector(c.target)||!finite(c.fov,10,120)||(c.endPosition&&!vector(c.endPosition))||(c.endTarget&&!vector(c.endTarget)))throw Error('카메라 설정이 잘못되었습니다.');}
  const cuts=[...input.cuts].sort((a,b)=>a.start-b.start);
  for(let i=0;i<cuts.length;i++){const c=cuts[i];if(!cams.has(c.cameraId)||!finite(c.start,0,input.duration)||!finite(c.end,c.start+0.01,input.duration)||(i>0&&c.start<cuts[i-1].end))throw Error('컷의 카메라·시간·겹침을 확인하세요.');}
  return cloneProject(input);
}
export function evaluateActor(actor,time){
  const duration=Math.max(0.001,actor.end-actor.start),t=Math.max(0,Math.min(1,(time-actor.start)/duration));
  let position=[...actor.position],rotation=actor.rotation;
  const path=actor.path;
  if(path?.length>1){
    const lengths=path.slice(1).map((v,i)=>Math.hypot(...v.map((n,j)=>n-path[i][j]))),total=lengths.reduce((a,b)=>a+b,0);
    let remain=t*total;position=[...path.at(-1)];
    for(let i=0;i<lengths.length;i++){if(remain<=lengths[i]){const ratio=lengths[i]>0?remain/lengths[i]:0;position=path[i].map((v,j)=>v+(path[i+1][j]-v)*ratio);rotation=Math.atan2(path[i+1][0]-path[i][0],path[i+1][2]-path[i][2]);break;}remain-=lengths[i];}
  }
  const active=time>=actor.start&&time<=actor.end;
  return {position,rotation,action:active?actor.action:'idle',localTime:active?(time-actor.start)*actor.speed:0,visible:true,active};
}
export function evaluateCamera(project,time){
  const clip=project.cuts.find(c=>time>=c.start&&time<c.end)??(time>=project.duration?project.cuts.at(-1):null);
  const camera=project.cameras.find(c=>c.id===clip?.cameraId)??project.cameras[0];
  const ratio=clip?Math.max(0,Math.min(1,(time-clip.start)/(clip.end-clip.start))):Math.max(0,Math.min(1,time/project.duration));
  const lerp=(a,b)=>a.map((v,i)=>v+((b??a)[i]-v)*ratio);
  return {...camera,position:lerp(camera.position,camera.endPosition),target:lerp(camera.target,camera.endTarget)};
}
export function parseScenePrompt(text,project){
  if(typeof text!=='string'||!text.trim())throw Error('장면 설명을 입력하세요.');
  const p=createProject();p.name=text.trim().slice(0,70);
  if(project){p.duration=project.duration;p.fps=project.fps;}
  const cafe=/카페|cafe|테이블|table|앉|sit/i.test(text),one=/한\s*(사람|명)|혼자|one person|single/i.test(text);
  if(one)p.actors=p.actors.slice(0,1);
  for(let i=0;i<p.actors.length;i++){
    const a=p.actors[i];a.end=Math.min(5,p.duration);a.start=0;
    if(cafe){a.position=[i===0?-0.9:0.9,0,0];a.path=[];a.action='sit';a.rotation=i===0?Math.PI/2:-Math.PI/2;a.end=p.duration;}
    else if(/손|흔들|wave/i.test(text)){a.action='wave';a.path=[];}
    else if(/돌아|turn/i.test(text)){a.action='turn';a.path=[];}
  }
  if(cafe)p.props=[{id:'prop-table',name:'대화 테이블',kind:'table',position:[0,0,0],rotation:0,scale:[1,0.72,1.2],color:'#736354'}];
  p.cuts=[{cameraId:p.cameras[0].id,start:0,end:p.duration}];
  return validateProject(p);
}
