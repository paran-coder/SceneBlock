// Pure oriented-box geometry. No labels, semantic roles, or scene-specific policy.
export function segmentHitsBounds(from,to,bounds,{padding=.3,bodyHeight=1.75}={}){
 const c=Math.cos(bounds.rotation),s=Math.sin(bounds.rotation),local=v=>{const x=v[0]-bounds.position[0],z=v[2]-bounds.position[2];return [x*c-z*s,v[1]-bounds.position[1],x*s+z*c]},a=local(from),b=local(to);let lo=0,hi=1;
 for(let i=0;i<3;i++){const min=i===1?-bodyHeight:-bounds.size[i]/2-padding,max=i===1?bounds.size[i]:bounds.size[i]/2+padding,d=b[i]-a[i];if(Math.abs(d)<1e-10){if(a[i]<min||a[i]>max)return false}else{const x=(min-a[i])/d,y=(max-a[i])/d;lo=Math.max(lo,Math.min(x,y));hi=Math.min(hi,Math.max(x,y));if(lo>hi)return false}}
 return true;
}
const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
export function visibilityDetour(from,to,obstacles){
 if(obstacles.length>32||Math.abs(from[1]-to[1])>1e-8)return null;
 const clear=(a,b)=>obstacles.every(o=>!segmentHitsBounds(a,b,o));
 if(clear(from,to))return [[...from],[...to]];
 if(!clear(from,from)||!clear(to,to))return null;
 const nodes=[[...from],[...to]];
 for(const o of obstacles){if(from[1]+1.75<o.position[1]||from[1]>o.position[1]+o.size[1])continue;const c=Math.cos(o.rotation),s=Math.sin(o.rotation),w=o.size[0]/2+.36,d=o.size[2]/2+.36;for(const x of [-w,w])for(const z of [-d,d]){const p=[o.position[0]+x*c+z*s,from[1],o.position[2]-x*s+z*c];if(clear(p,p))nodes.push(p)}}
 const costs=Array(nodes.length).fill(Infinity),previous=Array(nodes.length).fill(-1),visited=new Set();costs[0]=0;
 for(let iteration=0;iteration<nodes.length;iteration++){let current=-1;for(let i=0;i<nodes.length;i++)if(!visited.has(i)&&(current===-1||costs[i]<costs[current]))current=i;if(current===-1||!Number.isFinite(costs[current]))break;if(current===1){const path=[];for(let i=1;i!==-1;i=previous[i])path.unshift(nodes[i]);return path}visited.add(current);for(let i=0;i<nodes.length;i++){if(visited.has(i)||!clear(nodes[current],nodes[i]))continue;const cost=costs[current]+distance(nodes[current],nodes[i]);if(cost<costs[i]-1e-9){costs[i]=cost;previous[i]=current}}}
 return null;
}
export function pathKnotRatios(path){const lengths=path.slice(1).map((p,i)=>distance(p,path[i])),total=lengths.reduce((s,n)=>s+n,0);let sum=0;return total?lengths.slice(0,-1).map(n=>(sum+=n)/total):[]}
