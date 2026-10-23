/** Static pose targets sampled in absolute scene seconds. */
export function samplePoseKeys(clip,time){
 const keys=[...(clip.poseKeys??[])].sort((a,b)=>a.time-b.time);if(!keys.length)return null;
 if(time<=keys[0].time)return {from:keys[0],to:keys[0],alpha:0};
 if(time>=keys.at(-1).time)return {from:keys.at(-1),to:keys.at(-1),alpha:0};
 const i=keys.findIndex(k=>k.time>time),from=keys[i-1],to=keys[i];let alpha=(time-from.time)/(to.time-from.time);
 if(clip.poseKeyEasing==='easeInOut')alpha=alpha*alpha*(3-2*alpha);
 return {from,to,alpha};
}
export function fitPoseKeys(clip,patch,move=false){
 if(!clip.poseKeys||Object.hasOwn(patch,'poseKeys'))return patch;const start=patch.start??clip.start,end=patch.end??clip.end,delta=move?start-clip.start:0;
 return {...patch,poseKeys:clip.poseKeys.map(k=>({...k,time:Math.round((k.time+delta)*1e9)/1e9})).filter(k=>k.time>=start&&k.time<=end)};
}
