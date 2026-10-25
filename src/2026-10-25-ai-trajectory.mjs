// Optional AI metadata. A route/timing/heading edit falls back to the existing manual evaluator.
export const trajectoryFingerprint=a=>JSON.stringify([a.position,a.path,a.pathCurve,a.rotation,a.rotation3D,a.autoFacePath,a.arrivalRotation,a.start,a.end,a.action,a.clips]);
export function validateAITrajectory(a,duration){
 const t=a.aiTrajectory;if(t===undefined)return;
 const vector=v=>Array.isArray(v)&&v.length===3&&v.every(n=>Number.isFinite(n)&&Math.abs(n)<=10000);
 if(!t||t.version!==1||typeof t.fingerprint!=='string'||t.fingerprint.length>200000||!Array.isArray(t.segments)||t.segments.length>256)throw Error('Invalid AI trajectory');
 let end=0;for(const s of t.segments){if(!s||!Number.isFinite(s.start)||!Number.isFinite(s.end)||s.start<end||s.end-s.start<.01-1e-9||s.end>duration||!Array.isArray(s.points)||s.points.length<2||s.points.length>512||!s.points.every(vector)||!Number.isFinite(s.arc)||s.arc<0||s.arc>100||s.yaw!==null&&!Number.isFinite(s.yaw))throw Error('Invalid AI trajectory segment');end=s.end;}
}
export function sampleAITrajectory(a,time){
 const track=a.aiTrajectory;if(!track||track.fingerprint!==trajectoryFingerprint(a)||!track.segments.length)return null;
 let position=[...a.position],rotation=a.rotation;
 for(const s of track.segments){if(time<s.start)break;const ratio=Math.max(0,Math.min(1,(time-s.start)/(s.end-s.start))),lengths=s.points.slice(1).map((p,i)=>Math.hypot(...p.map((v,j)=>v-s.points[i][j]))),total=lengths.reduce((n,v)=>n+v,0);let remaining=ratio*total,index=0;while(index<lengths.length-1&&remaining>lengths[index])remaining-=lengths[index++];const from=s.points[index],to=s.points[index+1],t=lengths[index]?remaining/lengths[index]:ratio;position=from.map((v,j)=>v+(to[j]-v)*t);position[1]+=4*s.arc*ratio*(1-ratio);if(s.yaw!==null)rotation=s.yaw;else if(Math.hypot(to[0]-from[0],to[2]-from[2])>1e-8)rotation=Math.atan2(to[0]-from[0],to[2]-from[2]);if(time<s.end)break;}
 return {position,rotation};
}
