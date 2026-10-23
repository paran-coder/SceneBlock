import {Quaternion,Euler} from 'three';
import {resetCharacterPose,applyBasicAction,applyKimodoMotion} from '../2026-10-23-motion.mjs';
import {applyJointOffsets} from './2026-10-23-poses.mjs';

const normalize=name=>name.replace(/^mixamorig[:_]?/i,'').replace(/[^a-z0-9]/gi,'').toLowerCase();
export function layerMaskIncludes(name,mask){
  const key=normalize(name);
  if(mask==='full')return true;
  if(mask==='leftArm')return /^(left|l)(shoulder|arm|forearm|hand|finger|thumb)/.test(key);
  if(mask==='rightArm')return /^(right|r)(shoulder|arm|forearm|hand|finger|thumb)/.test(key);
  if(mask==='head')return /^(neck|head)/.test(key);
  return /^(spine|chest|upperchest|body|neck|head)/.test(key)||layerMaskIncludes(name,'leftArm')||layerMaskIncludes(name,'rightArm');
}
function snapshot(nodes){return nodes.map(node=>({node,q:node.quaternion.clone(),p:node.position.clone()}))}
function restore(entries){for(const {node,q,p} of entries){node.quaternion.copy(q);node.position.copy(p)}}
/** Applies bottom-to-top replacement layers to an already evaluated base pose.
 * Root Object3D transforms never enter the blend: locomotion remains independent.
 */
export function applyActorOverlays(model,overlays=[],{applyPose}={}){
  const bones=[];model.traverse(node=>{if(node.isBone)bones.push(node)});
  const rigged=bones.length>0,nodes=rigged?bones:model.children;
  for(const layer of overlays){
    const weight=Math.max(0,Math.min(1,Number.isFinite(layer.weight)?layer.weight:1));if(!weight)continue;
    const before=snapshot(nodes),modelPosition=model.position.clone(),modelQuaternion=model.quaternion.clone();
    let target;
    try{
      resetCharacterPose(model);
      if(!rigged)for(const node of nodes)node.quaternion.identity();
      if(layer.poseId){if(!applyPose||applyPose(model,layer.poseId)===false)continue}
      else if(layer.motion)applyKimodoMotion(model,layer.motion,layer.localTime||0,{inPlace:true});
      else if(rigged){
        applyBasicAction(model,layer.action||'idle',layer.localTime||0);
        if(layer.action==='turn'){
          // Looking behind turns the torso/head, never the locomotion root.
          resetCharacterPose(model);
          const frame=model.getWorldQuaternion(new Quaternion()),inverse=frame.clone().invert(),rest=new Map(bones.map(b=>[b,inverse.clone().multiply(b.getWorldQuaternion(new Quaternion()))])),accumulated=new Map();
          for(const bone of bones){
            const key=normalize(bone.name),angle=key==='spine'?.35:key==='spine1'?.25:key==='spine2'?.2:key==='neck'?.35:key==='head'?.65:0;
            let parent=bone.parent;while(parent&&!accumulated.has(parent))parent=parent.parent;
            const delta=(parent?accumulated.get(parent).clone():new Quaternion()).multiply(new Quaternion().setFromEuler(new Euler(0,angle,0)));accumulated.set(bone,delta);
            const desired=frame.clone().multiply(delta).multiply(rest.get(bone));bone.quaternion.copy(bone.parent.getWorldQuaternion(new Quaternion()).invert().multiply(desired)).normalize();bone.updateWorldMatrix(false,false);
          }
        }
      }else{
        const t=layer.localTime||0,swing=Math.sin(t*6)*.45;
        for(const node of nodes){if((layer.action==='walk'||layer.action==='run')&&/leg|arm/.test(node.name))node.rotation.x=(node.name.startsWith('left')?1:-1)*swing;if(layer.action==='wave'&&node.name==='rightarm')node.rotation.z=2+Math.sin(t*7)*.25;if(layer.action==='turn'&&/head|body/.test(node.name))node.rotation.y=node.name==='head'?1:.5}
      }
      if(layer.jointOffsets)applyJointOffsets(model,layer.jointOffsets);
      target=snapshot(nodes);
    }finally{restore(before);model.position.copy(modelPosition);model.quaternion.copy(modelQuaternion);model.updateWorldMatrix(true,true)}
    if(!target)continue;
    for(let i=0;i<nodes.length;i++)if(layerMaskIncludes(nodes[i].name,layer.mask||'upper')){nodes[i].quaternion.slerp(target[i].q,weight);nodes[i].position.lerp(target[i].p,weight)}
    model.updateWorldMatrix(true,true);
  }
}
