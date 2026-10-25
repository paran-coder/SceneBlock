import {validateIntent} from '../ai-connector/2026-10-25-intent-schema.mjs';
import {validateProject} from '../2026-10-23-core.mjs';
import {trajectoryFingerprint,sampleAITrajectory} from './2026-10-25-ai-trajectory.mjs';
import {visibilityDetour,segmentHitsBounds,pathKnotRatios} from './2026-10-25-intent-geometry.mjs';
const assets={box:[1,1,1],wall:[5,3,.15],table:[1.6,.88,.85],chair:[.5,1.06,.5],bench:[1.6,.97,.5],sofa:[1.9,.98,.8],door:[1.1,2.2,.16],window:[1.59,1.4,.2],stairs:[1.2,.9,1.5]};
const seats={chair:.51,bench:.52,sofa:.56};
const moves=new Set(['walk','run','approach','move','jump','descend','climb']);
export const previsCapabilities=Object.freeze({version:'2.0.0',actorAssets:['actor-standard'],propAssets:Object.keys(assets),actions:['idle','walk','run','wave','sit','turn','approach','move','jump','descend','climb','crouch','reach','gesture','lie','lookAt','handoff'],relations:['seatedOn','face','parallel','avoid','near','around','inside','frontOf','behind','contact'],cameraMotion:['static','dolly','truck','pan','orbit'],limits:{appearance:'Unchanged standard actor; fine appearance/effects reported as simplifications',movementSegmentsPerActor:64,shots:'Sampled geometric framing and approximate body anchors; articulated visibility is not guaranteed'}});
const copy=v=>structuredClone(v),distance=(a,b)=>Math.hypot(...a.map((x,i)=>x-b[i])),heading=(a,b)=>Math.atan2(b[0]-a[0],b[2]-a[2]);
const near=(a,b)=>distance(a,b)<1e-6;
export function compilePrevisIntent(input,{description,waivedRequirementIds=[],currentProject=null}={}){
 const intent=copy(input),issues=[],requirements=(intent?.requirements??[]).map(r=>({id:r.id,status:'violated',reason:'Requirement has no realizable binding.'})),reports=new Map(requirements.map(r=>[r.id,r])),waived=new Set(waivedRequirementIds);
 const mark=(ids,status,reason)=>{for(const id of ids??[]){const r=reports.get(id);if(!r||waived.has(id))continue;if(['violated','ambiguous','unsupported'].includes(r.status)&&r.reason!=='Requirement has no realizable binding.')continue;if(r.status==='approximate'&&status==='satisfied')continue;Object.assign(r,{status,reason});}};
 const fail=(ids,message,status='violated')=>{mark(ids,status,message);issues.push({severity:'error',requirementIds:[...(ids??[])],message});};
 const approx=(ids,message)=>{mark(ids,'approximate',message);issues.push({severity:'warning',requirementIds:[...(ids??[])],message});};
 const active=x=>!x.requirementIds?.length||x.requirementIds.some(id=>!waived.has(id));
 const finish=project=>{for(const r of requirements)if(waived.has(r.id))Object.assign(r,{status:'omittedByUser',reason:'Explicitly omitted by user.'});const canApply=!!project&&!issues.some(i=>i.severity==='error'&&(!i.requirementIds.length||i.requirementIds.some(id=>!waived.has(id))))&&requirements.every(r=>['satisfied','approximate','omittedByUser'].includes(r.status));return {intent,project:canApply?project:null,report:{requirements,issues,canApply}};};
 try{validateIntent(intent,description);}catch(e){fail(requirements.map(r=>r.id),`Invalid intent contract: ${e.message}`);return finish();}
 for(const id of waived)if(!reports.has(id))fail([],`Unknown waiver requirement: ${id}`);
 const reqMap=new Map(intent.requirements.map(r=>[r.id,r]));
 for(const u of intent.unresolved.filter(active)){const core=u.requirementIds.filter(id=>!['appearance','effect'].includes(reqMap.get(id)?.kind));if(core.length||!u.requirementIds.length)fail(core,u.question,'ambiguous');else approx(u.requirementIds,u.question);}
 for(const r of intent.requirements)if(['appearance','effect'].includes(r.kind))approx([r.id],'Fine appearance/effect is simplified; the standard character and geometry are preserved.');
 const actors=[],props=[],all=new Map(),source=new Map();
 for(const e of intent.entities.filter(active)){
  source.set(e.id,e);const position=e.position?[...e.position]:[actors.length%4*2.5,0,Math.floor(actors.length/4)*3],rotation=e.rotation??0;
  if(e.kind==='actor'){
   const a={id:e.id,name:e.label,position,rotation,color:e.color,action:'idle',start:0,end:intent.duration,speed:1,path:[],pathCurve:'polyline',motion:null,clips:[],layers:[]};actors.push(a);all.set(e.id,a);mark(e.requirementIds,'satisfied','Explicit participant bound to unchanged standard actor.');
   if(e.assetId!==null&&e.assetId!=='actor-standard'||Object.values(e.dimensions).some(v=>v!==null))approx(e.requirementIds,'Requested character detail is represented by the unchanged standard actor.');
  }else{
   const kind=assets[e.assetId]?e.assetId:'box',base=assets[kind],scale=['width','height','depth'].map((k,i)=>(e.dimensions[k]??base[i])/base[i]);
   if(e.dimensions.seatHeight!==null){if(!seats[kind])fail(e.requirementIds,'Seat height requires a supported seat.');else scale[1]=e.dimensions.seatHeight/seats[kind];}
   const p={id:e.id,name:e.label,kind,color:e.color,position,rotation,scale};if(seats[kind])p.supportSurfaceY=seats[kind];props.push(p);all.set(e.id,p);mark(e.requirementIds,'satisfied','Explicit prop bound to generic geometry.');if(kind!==e.assetId)approx(e.requirementIds,'Unfamiliar set/prop uses a labelled box with requested dimensions.');
  }
 }
 const requireEntity=(id,ids)=>{const e=all.get(id);if(!e)fail(ids,`Binding depends on an omitted entity: ${id}`);return e;};
 // Spatial layout is typed data, never inferred from labels, prose, costumes or character names.
 const deferred=[],spatial=[],regions=new Set();
 for(const r of intent.relations.filter(active)){
  const a=requireEntity(r.subjectId,r.requirementIds),b=requireEntity(r.objectId,r.requirementIds);if(!a||!b)continue;
  if(a===b){fail(r.requirementIds,'A spatial relation requires distinct entities.');continue;}
  if(['face','parallel','avoid','seatedOn'].includes(r.kind)){deferred.push(r);continue;}
  if(!previsCapabilities.relations.includes(r.kind)){fail(r.requirementIds,`Core relation ${r.kind} cannot be represented.`,'unsupported');continue;}
  spatial.push(r);if(r.kind==='inside'&&props.includes(b))regions.add(b.id);
  // Travel endpoints are validated after timed tracks exist; a relation must not teleport the start.
  if(intent.actions.some(x=>x.actorId===a.id&&moves.has(x.kind)))continue;
  const theta=b.rotation,size=props.includes(b)?assets[b.kind].map((n,i)=>n*b.scale[i]):[.6,1.75,.6],offset=r.kind==='inside'?0:r.kind==='contact'?(size[2]/2+.3):Math.max(1.4,size[2]/2+1);
  const sign=r.kind==='behind'?-1:1,desired=[b.position[0]+Math.sin(theta)*offset*sign,b.position[1],b.position[2]+Math.cos(theta)*offset*sign];
  if(r.kind==='around'){const siblings=intent.relations.filter(x=>x.kind==='around'&&x.objectId===r.objectId),i=siblings.indexOf(r),t=i*2*Math.PI/Math.max(1,siblings.length);desired[0]=b.position[0]+Math.sin(t)*Math.max(2,size[0]);desired[2]=b.position[2]+Math.cos(t)*Math.max(2,size[2]);}
  if(source.get(a.id).position){const delta=distance(a.position,b.position),local=(a.position[0]-b.position[0])*Math.sin(theta)+(a.position[2]-b.position[2])*Math.cos(theta);if(r.kind==='frontOf'&&local<=0||r.kind==='behind'&&local>=0||r.kind==='near'&&delta>Math.max(3,...size)*1.5||r.kind==='inside'&&a.position.some((v,i)=>Math.abs(v-b.position[i])>size[i]/2))fail(r.requirementIds,'Pinned positions contradict the requested spatial relation.');}
  else a.position=desired;
  approx(r.requirementIds,'Generic spatial arrangement; distances/contact/container boundaries are approximate.');
 }
 const actionMap=new Map();for(const a of intent.actions.filter(active)){if(!requireEntity(a.actorId,a.requirementIds))continue;if(a.targetId!==null&&!requireEntity(a.targetId,a.requirementIds))continue;const list=actionMap.get(a.actorId)??[];list.push(a);actionMap.set(a.actorId,list);}
 const sample=(a,t)=>sampleAITrajectory(a,t)??{position:a.position,rotation:a.rotation};
 for(const actor of actors){
  const acts=(actionMap.get(actor.id)??[]).sort((a,b)=>a.start-b.start),segments=[];let cursor=[...actor.position],previousEnd=0;
  for(const act of acts){
   if(act.start<previousEnd){fail(act.requirementIds,'Overlapping base actions.');continue;}previousEnd=act.end;
   if(!previsCapabilities.actions.includes(act.kind)){fail(act.requirementIds,`Core action ${act.kind} cannot be represented.`,'unsupported');continue;}
   let action=act.kind,poseId;
   if(moves.has(act.kind)){
    const from=act.from??cursor;let to=act.to;
    if(!segments.length&&act.from){if(source.get(actor.id).position&&!near(actor.position,from))fail(act.requirementIds,'Movement origin conflicts with pinned actor position.');else actor.position=[...from];}
    else if(act.from&&!near(cursor,from)){fail(act.requirementIds,'Sequential movement has a discontinuous origin.');continue;}
    if(act.kind==='approach'&&!to){const target=all.get(act.targetId);if(!target||target===actor){fail(act.requirementIds,'Approach needs a distinct target or explicit destination.');continue;}if(intent.actions.some(x=>x.actorId===target.id&&moves.has(x.kind))){fail(act.requirementIds,'Approach to a moving target needs an explicit timed destination.');continue;}const p=sample(target,act.end).position,d=distance(from,p);if(d<.01){fail(act.requirementIds,'Approach origin coincides with target.');continue;}to=p.map((v,i)=>v+(from[i]-v)*Math.min(1,1/d));}
    if(!to){fail(act.requirementIds,'Movement requires a typed destination.');continue;}
    segments.push({start:act.start,end:act.end,points:[[...from],[...to]],arc:act.kind==='jump'?Math.min(1.5,Math.max(.4,distance(from,to)*.2)):0,yaw:null});cursor=[...to];action=act.kind==='run'?'run':'walk';
    if(!['walk','run','approach'].includes(act.kind))approx(act.requirementIds,'Typed 3D movement uses a standard locomotion pose; jump uses a parabolic root arc.');else mark(act.requirementIds,'satisfied','Timed movement segment compiled.');
   }else if(['crouch','lie','reach','gesture','handoff','lookAt'].includes(act.kind)){
    if(act.kind==='crouch'){action='pose';poseId='a3d_pose_crouch-lean-fwd-right-hand-supporting';}else if(act.kind==='lie'){action='pose';poseId='a3d_pose_lay-on-back-left-leg-bent';}else if(['reach','handoff'].includes(act.kind)){action='pose';poseId='a3d_pose_loco-run-reach';}else action=act.kind==='lookAt'?'turn':'wave';
    if(act.targetId&&act.kind==='lookAt')actor.rotation=heading(cursor,all.get(act.targetId).position);
    approx(act.requirementIds,act.kind==='handoff'?'Reaching pose represents the exchange gesture; physical object attachment and transfer are not animated.':'Action uses a related existing pose/gesture; detailed contact and articulated performance are approximate.');
   }else mark(act.requirementIds,'satisfied','Existing standard action compiled.');
   actor.clips.push({id:`previs-${act.id}`,action,start:act.start,end:act.end,speed:1,motion:null,...(poseId?{poseId}:{})});
  }
  if(actor.clips.length){actor.action=actor.clips[0].action==='pose'?'idle':actor.clips[0].action;actor.start=actor.clips[0].start;actor.end=actor.clips.at(-1).end;}
  actor.path=segments.flatMap((s,i)=>i?s.points.slice(1):s.points);if(segments.length)actor.aiTrajectory={version:1,segments,fingerprint:trajectoryFingerprint(actor)};
 }
 const orientationDemands=new Map();
 const demand=(a,r,yaw)=>{const list=orientationDemands.get(a.id)??[];if(list.some(x=>x.start<r.end&&x.end>r.start&&Math.abs(Math.atan2(Math.sin(x.yaw-yaw),Math.cos(x.yaw-yaw)))>.01)){fail(r.requirementIds,'Conflicting orientation demands overlap in time.');return false;}list.push({start:r.start,end:r.end,yaw});orientationDemands.set(a.id,list);return true;};
 for(const r of deferred){
  const a=all.get(r.subjectId),b=all.get(r.objectId);if(!a||!b)continue;
  if(r.kind==='avoid'){
   if(!actors.includes(a)||!props.includes(b)||!a.aiTrajectory){fail(r.requirementIds,'Avoid requires a moving actor and solid prop.');continue;}
   const relevant=a.aiTrajectory.segments.filter(s=>s.start>=r.start&&s.end<=r.end);if(!relevant.length){fail(r.requirementIds,'Avoid interval must cover a movement segment.');continue;}
   for(const seg of relevant){if(seg.points.some(p=>Math.abs(p[1]-seg.points[0][1])>1e-6)||seg.arc){fail(r.requirementIds,'Solid avoidance requires a level trajectory.');continue;}const route=visibilityDetour(seg.points[0],seg.points.at(-1),props.map(p=>({position:p.position,rotation:p.rotation,size:assets[p.kind].map((v,i)=>v*p.scale[i])})));if(!route)fail(r.requirementIds,'No clearance route exists.');else seg.points=route;}
   mark(r.requirementIds,'satisfied','Generic solid clearance route compiled.');
  }else if(r.kind==='seatedOn'){
   if(!actors.includes(a)||!seats[b.kind]||a.aiTrajectory||!a.clips.some(c=>c.action==='sit'&&c.start<=r.start&&c.end>=r.end)){fail(r.requirementIds,'Seated relation needs a supported seat and covering sit action.');continue;}
   if(source.get(a.id).position&&Math.hypot(a.position[0]-b.position[0],a.position[2]-b.position[2])>.05){fail(r.requirementIds,'Pinned sitter conflicts with the seat.');continue;}
   if(r.start!==0||r.end!==intent.duration){fail(r.requirementIds,'Seat anchor currently requires full-duration seating.');continue;}
   const seatYaw=b.rotation+Math.PI;if(source.get(a.id).rotation!==null&&Math.abs(Math.atan2(Math.sin(a.rotation-seatYaw),Math.cos(a.rotation-seatYaw)))>.01){fail(r.requirementIds,'Pinned sitter orientation conflicts with the seat plane.');continue;}if(!demand(a,r,seatYaw))continue;a.position=[...b.position];a.rotation=seatYaw;a.action='sit';a.seatPropId=b.id;approx(r.requirementIds,'Generic seat anchor; standard skeleton and chair dimensions are unchanged.');
  }else{
   if(!actors.includes(a)){fail(r.requirementIds,'Orientation relation needs an actor subject.');continue;}
   const desired=r.kind==='parallel'?b.rotation:heading(sample(a,r.start).position,sample(b,r.start).position);
   if(!demand(a,r,desired))continue;
   if(!a.aiTrajectory&&r.start===0&&r.end===intent.duration){if(source.get(a.id).rotation!==null&&Math.abs(Math.atan2(Math.sin(a.rotation-desired),Math.cos(a.rotation-desired)))>.01)fail(r.requirementIds,'Pinned orientation conflicts with relation.');else a.rotation=desired;}
   else{if(!a.aiTrajectory)a.aiTrajectory={version:1,fingerprint:'',segments:[]};const conflict=a.aiTrajectory.segments.some(s=>s.start<r.end&&s.end>r.start&&(s.start<r.start||s.end>r.end));if(conflict)fail(r.requirementIds,'Orientation boundaries must align with movement segments.');else{const covered=a.aiTrajectory.segments.filter(s=>s.start>=r.start&&s.end<=r.end);if(covered.length)for(const s of covered)s.yaw=desired;else{const p=sample(a,r.start).position;a.aiTrajectory.segments.push({start:r.start,end:r.end,points:[[...p],[...p]],arc:0,yaw:desired});a.aiTrajectory.segments.sort((x,y)=>x.start-y.start);}}}
   approx(r.requirementIds,'Orientation is sampled at the relation start; moving-target gaze is approximate.');
  }
  if(a.aiTrajectory)a.aiTrajectory.fingerprint=trajectoryFingerprint(a);
 }
 for(const a of actors)if(a.aiTrajectory){a.path=a.aiTrajectory.segments.flatMap((s,i)=>i?s.points.slice(1):s.points);a.aiTrajectory.fingerprint=trajectoryFingerprint(a);}
 // Evaluate spatial intent at the end of its active interval. Explicit endpoints are never rewritten.
 for(const r of spatial){const a=all.get(r.subjectId),b=all.get(r.objectId);if(!a||!b)continue;const ap=sample(a,r.end).position,bp=sample(b,r.end).position,size=props.includes(b)?assets[b.kind].map((v,i)=>v*b.scale[i]):[.6,1.75,.6],delta=ap.map((v,i)=>v-bp[i]),c=Math.cos(b.rotation),sn=Math.sin(b.rotation),local=[delta[0]*c-delta[2]*sn,delta[1],delta[0]*sn+delta[2]*c],rad=Math.hypot(delta[0],delta[2]),ring=Math.max(2,size[0],size[2]);
  const contactGap=Math.hypot(Math.max(0,Math.abs(local[0])-size[0]/2),Math.max(0,Math.abs(local[2])-size[2]/2)),contactMiss=r.kind==='contact'&&(contactGap>.5||ap[1]>bp[1]+size[1]+.15||ap[1]+1.75<bp[1]-.15);
  if(contactMiss||r.kind==='around'&&(rad<ring*.55||rad>ring*1.6)||r.kind==='near'&&distance(ap,bp)>Math.max(3,...size)*1.5||r.kind==='frontOf'&&local[2]<=0||r.kind==='behind'&&local[2]>=0||r.kind==='inside'&&(Math.abs(local[0])+.3>size[0]/2||Math.abs(local[2])+.3>size[2]/2||local[1]<0||local[1]+1.75>size[1]))fail(r.requirementIds,'Timed endpoint contradicts the requested spatial relation.');else approx(r.requirementIds,'Spatial relation is represented at its active interval endpoint with generic spacing.');
 }
 // An interior region is an open floor marker rather than a solid enclosing box.
 for(const p of props)if(regions.has(p.id)){if(p.kind!=='box'){fail(source.get(p.id).requirementIds,'Inside requires a generic box region, not a solid catalogue asset.');continue;}p.aiRegion={size:assets.box.map((v,i)=>v*p.scale[i]),origin:[...p.position]};p.scale[1]=.03;p.position[1]-=.03;approx(source.get(p.id).requirementIds,'Interior volume is shown as an open floor marker; walls/roof are omitted.');}
 const bounds=p=>({position:p.position,rotation:p.rotation,size:assets[p.kind].map((v,i)=>v*p.scale[i])});
 // Automatically detour level travel around solid scenery, retaining exact pinned endpoints and timing.
 for(const a of actors){for(const seg of a.aiTrajectory?.segments??[]){const solids=props.filter(p=>!regions.has(p.id));const level=!seg.arc&&seg.points.every(p=>Math.abs(p[1]-seg.points[0][1])<1e-6),hits=solids.some(p=>seg.points.slice(1).some((q,i)=>segmentHitsBounds(seg.points[i],q,bounds(p),{padding:.3,bodyHeight:1.75})));if(hits&&level){const route=visibilityDetour(seg.points[0],seg.points.at(-1),solids.map(bounds));if(route){seg.points=route;approx((actionMap.get(a.id)??[]).flatMap(x=>x.requirementIds),'Level trajectory detoured around solid scenery.');}else fail((actionMap.get(a.id)??[]).flatMap(x=>x.requirementIds),'Pinned trajectory intersects solid scenery with no clearance route.');}else if(hits&&!seg.arc)fail((actionMap.get(a.id)??[]).flatMap(x=>x.requirementIds),'Vertical trajectory intersects solid scenery.');}
  if(a.aiTrajectory){a.path=a.aiTrajectory.segments.flatMap((s,i)=>i?s.points.slice(1):s.points);a.aiTrajectory.fingerprint=trajectoryFingerprint(a);}
 }
 const samplingTimes=[...new Set([0,intent.duration,...actors.flatMap(a=>(a.aiTrajectory?.segments??[]).flatMap(s=>[...Array.from({length:33},(_,i)=>s.start+(s.end-s.start)*i/32),...pathKnotRatios(s.points).map(t=>s.start+t*(s.end-s.start))]))])].sort((a,b)=>a-b);
 for(const a of actors)for(const p of props)if(a.seatPropId!==p.id&&!regions.has(p.id)&&samplingTimes.some((t,i)=>{const pos=sample(a,t).position,from=i?sample(a,samplingTimes[i-1]).position:pos;return segmentHitsBounds(from,pos,bounds(p),{padding:.28,bodyHeight:1.75});}))fail((actionMap.get(a.id)??[]).flatMap(x=>x.requirementIds),`Actor intersects solid bounds: ${a.id}, ${p.id}`);
 for(let i=0;i<actors.length;i++)for(let j=i+1;j<actors.length;j++){const a=actors[i],b=actors[j],hit=samplingTimes.some((time,k)=>{const p=sample(a,time).position.map((v,n)=>v-sample(b,time).position[n]);if(!k)return Math.hypot(...p)<.58;const old=samplingTimes[k-1],q=sample(a,old).position.map((v,n)=>v-sample(b,old).position[n]),d=p.map((v,n)=>v-q[n]),den=d.reduce((v,n)=>v+n*n,0),ratio=den?Math.max(0,Math.min(1,-q.reduce((v,n,j)=>v+n*d[j],0)/den)):0;return Math.hypot(...q.map((v,n)=>v+d[n]*ratio))<.58;});if(hit)fail([...(actionMap.get(a.id)??[]),...(actionMap.get(b.id)??[])].flatMap(x=>x.requirementIds),`Actor bounds overlap: ${a.id}, ${b.id}`);}
 const cameras=[],cuts=[];
 for(const s of intent.shots.filter(active)){
  const subjects=s.subjectIds.length?s.subjectIds.map(id=>requireEntity(id,s.requirementIds)):s.framing==='environment'?[...actors,...props]:[],ref=s.referenceId===null?null:requireEntity(s.referenceId,s.requirementIds);if(subjects.some(x=>!x)||s.referenceId!==null&&!ref)continue;
  if(!previsCapabilities.cameraMotion.includes(s.motion)){fail(s.requirementIds,'Camera motion cannot be represented.');continue;}
  if(!subjects.length&&s.framing!=='environment'){fail(s.requirementIds,'Shot needs explicit subjects.');continue;}
  let theta=(ref?sample(ref,s.start).rotation:0)+({front:0,rear:Math.PI,left:-Math.PI/2,right:Math.PI/2,unspecified:0}[s.viewSide]);
  const times=[...new Set([s.start,s.end,...subjects.flatMap(a=>a.aiTrajectory?.segments.flatMap(x=>[x.start,(x.start+x.end)/2,x.end])??[])].filter(t=>t>=s.start&&t<=s.end))].sort((a,b)=>a-b);
  const samples=times.map(time=>subjects.map(a=>({entity:a,position:sample(a,time).position}))),allPoints=samples.flat().map(x=>x.position),anchor=s.framing==='detail'?1.5:s.framing==='close'?1.45:s.framing==='medium'?1.15:1;
  if(s.viewSide==='unspecified'&&subjects.length>1){const score=angle=>samples.reduce((total,points)=>{const projected=points.map(x=>x.position[0]*Math.cos(angle)-x.position[2]*Math.sin(angle)),mean=projected.reduce((n,v)=>n+v,0)/projected.length;return total+projected.reduce((n,v)=>n+(v-mean)**2,0);},0);let best=score(theta);for(let i=0;i<32;i++){const candidate=i*Math.PI/16,value=score(candidate);if(value>best+1e-8){best=value;theta=candidate;}}}
  const center=allPoints.length?[0,1,2].map(i=>(Math.min(...allPoints.map(p=>p[i]))+Math.max(...allPoints.map(p=>p[i])))/2):[0,1,0];
  const bodyRadius=s.framing==='close'?.35:s.framing==='detail'?.18:s.framing==='medium'?.65:1;
  const span=Math.max(bodyRadius,...allPoints.map(p=>distance(p,center)+bodyRadius));
  const keys=times.map((time,index)=>{const points=samples[index],target=points.length?[0,1,2].map(i=>points.reduce((n,x)=>n+x.position[i]+(i===1?actors.includes(x.entity)?anchor:assets[x.entity.kind][1]*x.entity.scale[1]/2:0),0)/points.length):[0,1,0],ratio=(time-s.start)/(s.end-s.start),angle=theta+(s.motion==='orbit'?ratio*Math.PI/3:0),radius=Math.max(bodyRadius,...points.map(x=>distance(x.position.map((v,i)=>v+(i===1?anchor:0)),target)+(actors.includes(x.entity)?bodyRadius:Math.hypot(...assets[x.entity.kind].map((n,i)=>n*x.entity.scale[i]))/2))),d=radius/Math.sin(Math.PI/8)*1.15*(s.motion==='dolly'?(1-ratio*.2)/.8:1);return {id:`previs-${s.id}-key-${index}`,time,target,position:[target[0]+Math.sin(angle)*d+(s.motion==='truck'?ratio*2:0),target[1]+(s.framing==='environment'?2:.2),target[2]+Math.cos(angle)*d],fov:45,roll:0};});
  if(s.motion==='static'&&keys.length){const target=[...center];target[1]+=anchor;const radius=Math.max(span,...samples.flat().map(x=>distance(x.position.map((v,i)=>v+(i===1?anchor:0)),target)+(actors.includes(x.entity)?bodyRadius:Math.hypot(...assets[x.entity.kind].map((n,i)=>n*x.entity.scale[i]))/2))),d=radius/Math.sin(Math.PI/8)*1.15,position=[target[0]+Math.sin(theta)*d,target[1]+(s.framing==='environment'?2:.2),target[2]+Math.cos(theta)*d];for(const k of keys){k.position=[...position];k.target=[...target];}}
  if(s.motion==='pan'&&keys.length)for(const k of keys)k.position=[...keys[0].position];
  for(const key of keys){if(props.some(p=>!regions.has(p.id)&&segmentHitsBounds(key.position,key.position,bounds(p),{padding:0,bodyHeight:0})))fail(s.requirementIds,'Camera lies inside solid scenery.');if(s.occlusion==='subjects-visible'&&props.some(p=>!regions.has(p.id)&&!subjects.includes(p)&&subjects.some(a=>{const pos=[...sample(a,key.time).position];pos[1]+=actors.includes(a)?anchor:assets[a.kind][1]*a.scale[1]/2;return segmentHitsBounds(key.position,pos,bounds(p),{padding:0,bodyHeight:0});})))fail(s.requirementIds,'Requested visible subject is occluded by solid scenery.');}
  const first=keys[0],id=`previs-camera-${s.id}`;cameras.push({id,name:s.id,position:first.position,target:first.target,fov:45,keys,keyEasing:'linear'});cuts.push({cameraId:id,start:s.start,end:s.end});approx(s.requirementIds,'Framing uses sampled subject extents and approximate body anchors; detailed occlusion and articulated visibility are not guaranteed.');
 }
 if(!cameras.length){const points=[...actors.flatMap(a=>samplingTimes.map(t=>sample(a,t).position)),...props.map(p=>p.position)],target=points.length?[0,1,2].map(i=>(Math.min(...points.map(p=>p[i]))+Math.max(...points.map(p=>p[i])))/2+(i===1?1:0)):[0,1,0],radius=Math.max(2,...points.map(p=>distance(p,target)+2)),d=radius/Math.tan(Math.PI/8)*1.2;cameras.push({id:'previs-overview',name:'Overview',position:[target[0]+d*.6,target[1]+d*.4,target[2]+d],target,fov:45});}
 // Source coverage itself does not overwrite independently bound requirements on the same line.
 for(const c of intent.coverage.filter(active))if(c.status!=='interpreted'){const missing=c.requirementIds.filter(id=>reports.get(id)?.reason==='Requirement has no realizable binding.');if(missing.length||!c.requirementIds.length)fail(missing,`Source ${c.sourceId} has unresolved core intent.`,c.status==='ambiguous'?'ambiguous':'unsupported');}
 const project={version:'1.0.0',name:intent.name,duration:intent.duration,fps:currentProject?.fps??30,actors,props,cameras,cuts};
 try{return finish(validateProject(project));}catch(e){fail([],`Project validation failed: ${e.message}`);return finish();}
}
