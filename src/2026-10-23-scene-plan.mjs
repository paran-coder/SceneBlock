import {validatePlan} from '../ai-connector/2026-10-23-schema.mjs';
import {validateProject} from '../2026-10-23-core.mjs';
export function compileScenePlan(plan,current){
 validatePlan(plan);
 const actors=plan.actors.map((a,i)=>{if(a.action==='pose')throw Error('기본 포즈는 포즈 레이어로 지정해야 합니다.');const id=`ai-actor-${i+1}`;return {id,name:a.name,position:[...a.position],rotation:a.rotation,color:a.color,action:a.action,start:a.start,end:a.end,speed:a.speed,path:a.path.map(p=>[...p]),pathCurve:'smooth',motion:null,clips:[{id:id+'-base',action:a.action,start:a.start,end:a.end,speed:a.speed,motion:null}],layers:a.layers.map((l,j)=>({id:`${id}-layer-${j+1}`,name:l.name,mask:l.mask,weight:l.weight,enabled:true,clips:l.clips.map((c,k)=>({id:`${id}-layer-${j+1}-clip-${k+1}`,action:c.action,start:c.start,end:c.end,speed:c.speed,motion:null,...(c.poseId?{poseId:c.poseId}:{}),fadeIn:.2,fadeOut:.2}))}))}});
 const cameras=plan.cameras.map((c,i)=>({id:`ai-camera-${i+1}`,name:c.name,position:[...c.position],target:[...c.target],fov:c.fov,motion:{...c.motion,easing:c.motion.easing==='smooth'?'easeInOut':'linear'},...(c.followActor!==null?{followActorId:actors[c.followActor].id}:{})}));
 return validateProject({version:'1.0.0',name:current?.name??plan.name,duration:plan.duration,fps:current?.fps??30,actors,props:plan.props.map((p,i)=>({...p,id:`ai-prop-${i+1}`})),cameras,cuts:plan.cuts.map(c=>({cameraId:cameras[c.camera].id,start:c.start,end:c.end}))});
}
export function sceneContext(project){
 return {name:project.name,duration:project.duration,actors:project.actors.map(a=>({name:a.name,position:a.position,rotation:a.rotation,action:a.action,path:a.path})),props:project.props.map(p=>({name:p.name,kind:p.kind,position:p.position,scale:p.scale})),cameras:project.cameras.map(c=>({name:c.name,position:c.position,target:c.target,fov:c.fov}))};
}
