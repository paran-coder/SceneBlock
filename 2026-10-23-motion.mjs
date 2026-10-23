import {Quaternion,Vector3,Euler} from 'three';
const binds=new WeakMap();
const checkedMotions=new WeakSet();
const key=n=>n.replace(/^mixamorig[:_]?/i,'').toLowerCase();
const aliases={spine1:'spine',spine2:'spine1',chest:'spine2',neck1:'neck',leftleg:'leftupleg',rightleg:'rightupleg',leftshin:'leftleg',rightshin:'rightleg'};
function bind(root){
  if(binds.has(root))return binds.get(root);
  root.updateWorldMatrix(true,true);const inverse=root.getWorldQuaternion(new Quaternion()).invert();const bones=[];const map=new Map();
  root.traverse(b=>{if(!b.isBone)return;const entry={bone:b,q:b.quaternion.clone(),p:b.position.clone(),world:inverse.clone().multiply(b.getWorldQuaternion(new Quaternion())),position:root.worldToLocal(b.getWorldPosition(new Vector3()))};bones.push(entry);map.set(key(b.name),entry);});
  const data={bones,map};binds.set(root,data);return data;
}
export function resetCharacterPose(root){const data=bind(root);for(const e of data.bones){e.bone.quaternion.copy(e.q);e.bone.position.copy(e.p);}root.updateWorldMatrix(true,true);}
const finiteArray=(v,n)=>Array.isArray(v)&&v.length===n&&v.every(Number.isFinite);
export function validateMotion(m){
  const fail=s=>{throw new Error(`Invalid Kimodo motion: ${s}`);};
  if(!m||m.version!==1||m.source!=='kimodo'||!Number.isFinite(m.fps)||m.fps<=0||!Number.isInteger(m.frames)||m.frames<1)fail('header');
  const n=m.jointNames?.length;if(!n||!m.jointNames.every(v=>typeof v==='string')||new Set(m.jointNames).size!==n||m.parents?.length!==n||m.restPositions?.length!==n)fail('skeleton');
  let roots=0;for(let i=0;i<n;i++){if(!finiteArray(m.restPositions[i],3)||!Number.isInteger(m.parents[i])||m.parents[i]<-1||m.parents[i]>=n)fail('parent/rest position');if(m.parents[i]===-1)roots++;const visited=new Set([i]);let p=m.parents[i];while(p!==-1){if(visited.has(p))fail('cyclic hierarchy');visited.add(p);p=m.parents[p];if(!Number.isInteger(p)||p<-1||p>=n)fail('parent index');}}
  if(roots!==1)fail('one root required');
  if(m.localRotations?.length!==m.frames||m.rootPositions?.length!==m.frames)fail('frame count');
  for(let f=0;f<m.frames;f++){if(!finiteArray(m.rootPositions[f],3)||m.localRotations[f]?.length!==n)fail('frame dimensions');for(const q of m.localRotations[f])if(!finiteArray(q,4)||q.reduce((a,b)=>a+b*b,0)<1e-12)fail('quaternion');}
  if(!Number.isFinite(m.duration)||m.duration<0)fail('duration');return true;
}
function mapping(data,m){return m.jointNames.map((name,i)=>({i,entry:data.map.get(aliases[key(name)]??key(name))})).filter(x=>x.entry);}
function legScale(data,m){for(const side of ['Left','Right']){const a=m.jointNames.indexOf(side+'Leg'),b=m.jointNames.indexOf(side+'Shin'),c=m.jointNames.indexOf(side+'Foot');const ta=data.map.get(side.toLowerCase()+'upleg'),tb=data.map.get(side.toLowerCase()+'leg'),tc=data.map.get(side.toLowerCase()+'foot');if(a>=0&&b>=0&&c>=0&&ta&&tb&&tc){const v=i=>new Vector3().fromArray(m.restPositions[i]);const length=v(a).distanceTo(v(b))+v(b).distanceTo(v(c));if(length>1e-6)return (ta.position.distanceTo(tb.position)+tb.position.distanceTo(tc.position))/length;}}return 1;}
export function inspectRetarget(root,m){validateMotion(m);const data=bind(root),pairs=mapping(data,m);return {mappedJoints:pairs.length,totalJoints:m.jointNames.length,scale:legScale(data,m),mappedNames:pairs.map(p=>({source:m.jointNames[p.i],target:p.entry.bone.name})),unmappedNames:m.jointNames.filter((_,i)=>!pairs.some(p=>p.i===i))};}
export function applyKimodoMotion(root,m,time,options={inPlace:true}){
  if(!checkedMotions.has(m)){validateMotion(m);checkedMotions.add(m);}resetCharacterPose(root);const data=bind(root);const frame=Math.max(0,Math.min(m.frames-1,(Number.isFinite(time)?time:0)*m.fps)),a=Math.floor(frame),b=Math.min(a+1,m.frames-1),alpha=frame-a;
  const local=m.jointNames.map((_,i)=>new Quaternion().fromArray(m.localRotations[a][i]).normalize().slerp(new Quaternion().fromArray(m.localRotations[b][i]).normalize(),alpha));const world=[];
  const calc=i=>world[i]??(world[i]=m.parents[i]<0?local[i].clone():calc(m.parents[i]).clone().multiply(local[i]));m.jointNames.forEach((_,i)=>calc(i));
  const rootQ=root.getWorldQuaternion(new Quaternion());const pairs=mapping(data,m);const desired=new Map(pairs.map(({i,entry})=>[entry.bone,rootQ.clone().multiply(world[i]).multiply(entry.world)]));
  // Parent-first target traversal also retains unmapped target twist bones at bind pose.
  root.traverse(bone=>{if(!desired.has(bone))return;const parentQ=bone.parent.getWorldQuaternion(new Quaternion());bone.quaternion.copy(parentQ.invert().multiply(desired.get(bone))).normalize();bone.updateWorldMatrix(false,false);});
  const hips=data.map.get('hips');if(hips){const displacement=new Vector3().fromArray(m.rootPositions[a]).lerp(new Vector3().fromArray(m.rootPositions[b]),alpha).sub(new Vector3().fromArray(m.rootPositions[0])).multiplyScalar(legScale(data,m));if(options.inPlace!==false){displacement.x=0;displacement.z=0;}const zero=root.localToWorld(new Vector3()),point=root.localToWorld(displacement);const localDelta=hips.bone.parent.worldToLocal(point).sub(hips.bone.parent.worldToLocal(zero));hips.bone.position.copy(hips.p).add(localDelta);}
  root.updateWorldMatrix(true,true);return {source:'kimodo',frame};
}
export function applyBasicAction(root,action,time,{speed=1}={}){
  resetCharacterPose(root);const data=bind(root),t=(Number.isFinite(time)?time:0)*speed;
  const deltas=new Map();
  const rotate=(name,x=0,y=0,z=0)=>{const e=data.map.get(name.toLowerCase());if(e)deltas.set(e.bone,new Quaternion().setFromEuler(new Euler(x,y,z)));};
  // Basic motions are explicit procedural previews, never labelled AI generation.
  rotate('LeftArm',0,0,-1.15);rotate('RightArm',0,0,1.15);
  if(action==='walk'||action==='run'){const phase=t*(action==='run'?9:6),s=Math.sin(phase);rotate('LeftUpLeg',s*.55);rotate('RightUpLeg',-s*.55);rotate('LeftLeg',Math.max(0,-s)*.7);rotate('RightLeg',Math.max(0,s)*.7);rotate('LeftArm',-s*.45,0,-1.15);rotate('RightArm',s*.45,0,1.15);}
  else if(action==='wave'){rotate('RightArm',0,0,-.6);rotate('RightForeArm',0,0,-1.2+Math.sin(t*7)*.4);}
  else if(action==='sit'){rotate('LeftUpLeg',-Math.PI/2);rotate('RightUpLeg',-Math.PI/2);rotate('LeftLeg',Math.PI/2);rotate('RightLeg',Math.PI/2);}
  else if(action==='turn')rotate('Hips',0,Math.sin(t*.8)*1.2,0);
  else rotate('Spine',Math.sin(t*1.8)*.025);
  // Deltas are expressed in the model's Y-up frame, independent of imported
  // armature and bone axes. Accumulation retains parent influence on children.
  const rootQ=root.getWorldQuaternion(new Quaternion()),accumulated=new Map();
  root.traverse(bone=>{if(!bone.isBone)return;const entry=data.bones.find(e=>e.bone===bone);let ancestor=bone.parent;while(ancestor&&!accumulated.has(ancestor))ancestor=ancestor.parent;const delta=(ancestor?accumulated.get(ancestor).clone():new Quaternion()).multiply(deltas.get(bone)??new Quaternion());accumulated.set(bone,delta);const desired=rootQ.clone().multiply(delta).multiply(entry.world);bone.quaternion.copy(bone.parent.getWorldQuaternion(new Quaternion()).invert().multiply(desired)).normalize();bone.updateWorldMatrix(false,false);});
  if(action==='sit'){const h=data.map.get('hips'),thigh=data.map.get('leftupleg'),shin=data.map.get('leftleg');if(h){const length=thigh&&shin?thigh.position.distanceTo(shin.position):.4;const origin=root.localToWorld(new Vector3()),point=root.localToWorld(new Vector3(0,-length,0));const shift=h.bone.parent.worldToLocal(point).sub(h.bone.parent.worldToLocal(origin));h.bone.position.copy(h.p).add(shift);}}
  root.updateWorldMatrix(true,true);return {source:'procedural',action};
}
