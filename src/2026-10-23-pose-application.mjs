/** Find a visible, fully faded-in time without changing the stored animation. */
export function posePreviewTime(clip,time){
 const length=clip.end-clip.start;
 if(!Number.isFinite(length)||length<=0)throw Error('포즈 시간 구간을 확인하세요.');
 const half=length/2,epsilon=Math.min(.001,length/4);
 const low=clip.start+Math.max(epsilon,Math.min(clip.fadeIn??0,half));
 const high=clip.end-Math.max(epsilon,Math.min(clip.fadeOut??0,half));
 if(time<clip.start||time>=clip.end||!Number.isFinite(time))return low;
 return Math.max(low,Math.min(high,time));
}
