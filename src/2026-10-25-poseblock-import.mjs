import {Quaternion,Euler} from 'three';
import {resetCharacterPose} from '../2026-10-23-motion.mjs';

// PoseBlock exports local model-frame rotations. Accumulate the source hierarchy,
// then convert the desired model-frame delta into the destination bind/parent axes.
const RIG=[['pelvis',null,'Hips'],['spineLow','pelvis','Spine'],['spineMid','spineLow','Spine1'],['spineUp','spineMid','Spine2'],['neck','spineUp','Neck'],['head','neck','Head'],...['L','R'].flatMap((s,i)=>{const t=i?'Right':'Left';return [['clavicle'+s,'spineUp',t+'Shoulder'],['shoulder'+s,'clavicle'+s,t+'Arm'],['elbow'+s,'shoulder'+s,t+'ForeArm'],['wrist'+s,'elbow'+s,t+'Hand'],['handTip'+s,'wrist'+s,null],['hip'+s,'pelvis',t+'UpLeg'],['knee'+s,'hip'+s,t+'Leg'],['ankle'+s,'knee'+s,t+'Foot'],['toe'+s,'ankle'+s,t+'ToeBase']];})];
const known=new Set(RIG.map(([name])=>name));
const norm=s=>s.replace(/^mixamorig[:_]?/i,'').toLowerCase();
const tuple=(a,n)=>Array.isArray(a)&&a.length===n&&a.every(v=>typeof v==='number'&&Number.isFinite(v)&&Math.abs(v)<=10000);
const label=(v,fallback)=>typeof v==='string'&&v.trim()?v.trim().slice(0,120):fallback;
export function validateImportedPose(pose){
 if(!pose||pose.version!==1||pose.source!=='poseblock3d'||typeof pose.name!=='string'||!pose.name.length||pose.name.length>240||!['tpose','armsDown'].includes(pose.basis)||!pose.rotations||typeof pose.rotations!=='object'||Array.isArray(pose.rotations))throw Error('가져온 포즈 형식이 잘못되었습니다.');
 const entries=Object.entries(pose.rotations);if(!entries.length||entries.length>24||entries.some(([name,q])=>!known.has(name)||!tuple(q,4)||Math.abs(Math.hypot(...q)-1)>.001))throw Error('가져온 포즈 관절 회전값이 잘못되었습니다.');
 return pose;
}
function readPose(q,name){
 if(!q||typeof q!=='object'||Array.isArray(q)||Object.keys(q).length>128)throw Error('포즈 관절 데이터가 없습니다.');
 const rotations={};for(const [joint,value]of Object.entries(q)){if(!known.has(joint))continue;if(!tuple(value,4)||Math.hypot(...value)<1e-8)throw Error('포즈 관절 회전값이 잘못되었습니다.');rotations[joint]=new Quaternion().fromArray(value).normalize().toArray();}
 return validateImportedPose({version:1,source:'poseblock3d',name,basis:'tpose',rotations});
}
export function parsePoseBlock(document){
 if(!document||document.app!=='poseblock3d'||document.version!==2||!Array.isArray(document.poses)||!Array.isArray(document.scenes)||document.poses.length>128||document.scenes.length>128)throw Error('PoseBlock 3D 버전 2 JSON을 선택하세요.');
 const result=[];for(const [i,p]of document.poses.entries()){if(!p||typeof p!=='object')throw Error('포즈 항목이 잘못되었습니다.');const name=label(p.name,'포즈 '+(i+1));result.push({key:'pose-'+i,name,pose:readPose(p.q,name)});}
 for(const [i,scene]of document.scenes.entries()){
  if(!scene?.state||!Array.isArray(scene.state.chars)||scene.state.chars.length>128)throw Error('장면 인물 데이터가 잘못되었습니다.');
  for(const [j,char]of scene.state.chars.entries()){if(!char||typeof char!=='object')throw Error('장면 인물 형식이 잘못되었습니다.');const name=label(scene.name,'장면 '+(i+1))+' / '+label(char.name,'인물 '+(j+1));if(char.pos!==undefined&&!tuple(char.pos,3)||char.yaw!==undefined&&(!Number.isFinite(char.yaw)||Math.abs(char.yaw)>1000))throw Error('장면 위치·방향이 잘못되었습니다.');result.push({key:`scene-${i}-${j}`,group:'scene-'+i,name,pose:readPose(char.q,name),position:char.pos?[...char.pos]:undefined,yaw:char.yaw});}
 }
 if(!result.length||result.length>128)throw Error('가져올 포즈는 1~128개여야 합니다.');return result;
}
export function applyPoseBlock(project,mappings,{start,end,mask='full',basis='tpose',placement=false}={}){
 if(!Array.isArray(mappings)||!mappings.length||mappings.length>128||!Number.isFinite(start)||!Number.isFinite(end)||start<0||end>project.duration||end-start<.01||!['full','upper','leftArm','rightArm','head','lower'].includes(mask)||!['tpose','armsDown'].includes(basis))throw Error('포즈 대상·적용 부위·시간 범위를 확인하세요.');
 const used=new Set(),patches=[];
 for(const {entry,actorId}of mappings){
  const actor=project.actors.find(a=>a.id===actorId);if(!actor||used.has(actorId))throw Error('각 포즈에 서로 다른 SceneBlock 인물을 지정하세요.');used.add(actorId);
  if((actor.layers?.length??0)>=16)throw Error('인물당 레이어는 최대 16개입니다.');
  validateImportedPose(entry?.pose);const copy=structuredClone(actor),pose={...structuredClone(entry.pose),basis};
  (copy.layers??=[]).push({id:crypto.randomUUID(),name:pose.name.slice(0,120),mask,weight:1,enabled:true,clips:[{id:crypto.randomUUID(),action:'pose',start,end,speed:1,motion:null,fadeIn:0,fadeOut:0,importedPose:pose}]});
  if(placement&&entry.position){if(!tuple(entry.position,3))throw Error('포즈 배치 위치가 잘못되었습니다.');const delta=entry.position.map((v,i)=>v-copy.position[i]);copy.position=[...entry.position];copy.path=(copy.path??[]).map(p=>p.map((v,i)=>v+delta[i]));if(entry.yaw!==undefined){if(!Number.isFinite(entry.yaw)||Math.abs(entry.yaw)>1000)throw Error('포즈 방향이 잘못되었습니다.');copy.rotation=entry.yaw;copy.rotation3D=[copy.rotation3D?.[0]??0,entry.yaw,copy.rotation3D?.[2]??0];copy.autoFacePath=false;}}
  patches.push([actor,copy]);
 }
 for(const [actor,copy]of patches)Object.assign(actor,copy);
}
export function applyImportedPose(model,pose){
 validateImportedPose(pose);resetCharacterPose(model);model.updateWorldMatrix(true,true);
 const frame=model.getWorldQuaternion(new Quaternion()),index=new Map(),rest=new Map();model.traverse(b=>{if(b.isBone){index.set(norm(b.name),b);rest.set(b,b.getWorldQuaternion(new Quaternion()));}});
 const world=new Map(),assigned=new Map();for(const [source,parent,target]of RIG){
  let local=new Quaternion().fromArray(pose.rotations[source]??[0,0,0,1]);
  if(pose.basis==='armsDown'&&/^shoulder[LR]$/.test(source)){const neutral=new Quaternion().setFromEuler(new Euler(0,0,source.endsWith('L')?-Math.PI/2:Math.PI/2));local.multiply(neutral);}
  const delta=(world.get(parent)?.clone()??new Quaternion()).multiply(local);world.set(source,delta);const bone=target&&index.get(target.toLowerCase());if(bone)assigned.set(bone,delta);
 }
 model.traverse(b=>{if(!assigned.has(b))return;const desired=frame.clone().multiply(assigned.get(b)).multiply(frame.clone().invert()).multiply(rest.get(b));const parent=b.parent?.getWorldQuaternion(new Quaternion())??new Quaternion();b.quaternion.copy(parent.invert().multiply(desired)).normalize();b.updateWorldMatrix(false,false);});model.updateWorldMatrix(true,true);
}
