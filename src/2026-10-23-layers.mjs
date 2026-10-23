export const LAYER_MASKS=['full','upper','leftArm','rightArm','head'];

// Array order is compositing order: the last layer has priority on shared bones.
export function resolveActorLayers(actor,time){
  const result=[];
  for(const layer of actor.layers??[]){
    if(!layer.enabled||layer.weight<=0)continue;
    const clip=layer.clips.find(c=>time>=c.start&&time<c.end);
    if(!clip)continue;
    const half=(clip.end-clip.start)/2;
    const fadeIn=Math.min(clip.fadeIn??0,half),fadeOut=Math.min(clip.fadeOut??0,half);
    const incoming=fadeIn>0?Math.min(1,(time-clip.start)/fadeIn):1;
    const outgoing=fadeOut>0?Math.min(1,(clip.end-time)/fadeOut):1;
    result.push({...clip,layerId:layer.id,mask:layer.mask,weight:layer.weight*Math.max(0,Math.min(incoming,outgoing)),localTime:(time-clip.start)*clip.speed});
  }
  return result;
}
