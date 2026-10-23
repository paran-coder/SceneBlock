const clean=n=>Math.round(n*1e9)/1e9;
const clamp=(n,low,high)=>Math.max(low,Math.min(high,n));
const snapClamp=(n,low,high)=>clean(clamp(Math.round(n*10)/10,low,high));
/** Return a patch without mutating the selected clip or its neighbors. */
export function motionClipPatch(clip,motion,clips,duration){
 if(!clip||!Number.isFinite(clip.start)||!Number.isFinite(clip.speed)||clip.speed<=0||!Number.isFinite(motion?.duration)||motion.duration<=0||!Number.isFinite(duration))throw Error('동작 길이·속도를 확인하세요.');
 const next=clips.filter(c=>c!==clip&&c.id!==clip.id&&c.start>=clip.end).reduce((n,c)=>Math.min(n,c.start),duration);
 const limit=Math.min(duration,next),minimum=clip.start+.1;
 if(limit<minimum-1e-9)throw Error('동작을 적용할 시간 구간이 부족합니다.');
 return {motion,poseId:undefined,end:clean(Math.min(limit,Math.max(minimum,clip.start+motion.duration/clip.speed)))};
}
/** Drag one range inside its existing neighbors; touching boundaries are allowed. */
export function timelineRange({start,end},delta,edge,others,duration){
 if(![start,end,delta,duration].every(Number.isFinite)||start<0||end<=start||end>duration||!['move','start','end'].includes(edge))throw Error('타임라인 시간 범위를 확인하세요.');
 const neighbors=others;
 if(neighbors.some(c=>!Number.isFinite(c.start)||!Number.isFinite(c.end)||c.end<=c.start||(c.start<end&&c.end>start)))throw Error('겹치는 타임라인 구간입니다.');
 const lower=Math.max(0,...neighbors.filter(c=>c.end<=start).map(c=>c.end));
 const upper=Math.min(duration,...neighbors.filter(c=>c.start>=end).map(c=>c.start));
 if(edge==='start'&&end-.1<lower-1e-9)throw Error('최소 행동 길이를 확보할 수 없습니다.');
 if(edge==='end'&&start+.1>upper+1e-9)throw Error('최소 행동 길이를 확보할 수 없습니다.');
 if(edge==='start')return {start:snapClamp(start+delta,lower,end-.1),end};
 if(edge==='end')return {start,end:snapClamp(end+delta,start+.1,upper)};
 const length=Math.max(.1,end-start);
 if(upper-lower<length-1e-9)throw Error('최소 행동 길이를 확보할 수 없습니다.');
 const moved=snapClamp(start+delta,lower,upper-length);
 return {start:moved,end:clean(moved+length)};
}
