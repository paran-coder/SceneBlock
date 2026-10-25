import {CatmullRomCurve3,Vector3} from 'three';

// Geometry is shared by playback and the path guide. Numeric signatures also
// invalidate cached curves while a handle is being dragged in place.
const cache=new WeakMap();
function prepared(points,mode){
 const signature=mode+':'+points.map(p=>p.join(',')).join(';');
 const previous=cache.get(points);if(previous?.signature===signature)return previous;
 const clean=[];for(const p of points)if(!clean.length||Math.hypot(...p.map((v,i)=>v-clean.at(-1)[i]))>1e-10)clean.push([...p]);
 const lengths=clean.slice(1).map((p,i)=>Math.hypot(...p.map((v,j)=>v-clean[i][j])));
 const curve=mode==='smooth'&&clean.length>2?new CatmullRomCurve3(clean.map(p=>new Vector3(...p)),false,'centripetal'):null;
 if(curve){curve.arcLengthDivisions=Math.max(400,Math.min(8192,clean.length*32));curve.updateArcLengths();}
 const value={signature,points:clean,lengths,total:lengths.reduce((a,b)=>a+b,0),curve};cache.set(points,value);return value;
}
export function sampleRoute(points,ratio,mode='polyline'){
 const p=prepared(points,mode),t=Math.max(0,Math.min(1,Number.isFinite(ratio)?ratio:0));
 if(!p.points.length)return {position:[0,0,0],tangent:[0,0,0]};
 if(p.points.length===1)return {position:[...p.points[0]],tangent:[0,0,0]};
 if(p.curve){const position=t===0?[...p.points[0]]:t===1?[...p.points.at(-1)]:p.curve.getPointAt(t).toArray();return {position,tangent:p.curve.getTangentAt(t).toArray()};}
 let remain=t*p.total,index=p.lengths.length-1;
 for(let i=0;i<p.lengths.length;i++){if(remain<=p.lengths[i]||i===p.lengths.length-1){index=i;break;}remain-=p.lengths[i];}
 const a=p.points[index],b=p.points[index+1],length=p.lengths[index],u=Math.min(1,remain/length);
 return {position:a.map((v,i)=>v+(b[i]-v)*u),tangent:b.map((v,i)=>(v-a[i])/length)};
}
export function routeDisplayPoints(points,mode='polyline'){
 const p=prepared(points,mode);if(!p.curve)return points.map(p=>[...p]);
 const steps=Math.max(200,Math.min(8192,p.points.length*32));
 return Array.from({length:steps+1},(_,i)=>sampleRoute(points,i/steps,mode).position);
}
