import * as THREE from 'three';
export const PROPS=[['table','테이블'],['box','상자'],['wall','벽'],['chair','의자'],['bench','벤치'],['sofa','소파'],['door','문'],['window','창문'],['stairs','계단']].map(([kind,name])=>({kind,name,nameKorean:name}));
// Each group owns its geometry and material. All dimensions are metres; base is y=0.
export function createPropModel(kind,color='#77818c'){
 if(!PROPS.some(p=>p.kind===kind))throw new Error(`Unknown prop: ${kind}`);
 const group=new THREE.Group(),material=new THREE.MeshStandardMaterial({color,roughness:.8});group.name=kind;group.userData.ownedResources=true;
 const box=(name,w,h,d,x=0,y=h/2,z=0)=>{const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);mesh.name=name;mesh.position.set(x,y,z);mesh.castShadow=mesh.receiveShadow=true;group.add(mesh);return mesh;};
 const legs=(width,depth,height)=>{for(const x of [-width/2,width/2])for(const z of [-depth/2,depth/2])box('leg',.08,height,.08,x,height/2,z);};
 if(kind==='box')box('body',1,1,1);
 if(kind==='wall')box('panel',5,3,.15);
 if(kind==='table'){box('top',1.6,.12,.85,0,.82);legs(1.3,.6,.8);}
 if(kind==='chair'){box('seat',.5,.1,.5,0,.46);legs(.36,.36,.41);box('back',.5,.55,.08,0,.785,.21);}
 if(kind==='bench'){box('seat',1.6,.12,.5,0,.46);legs(1.3,.34,.4);box('back',1.6,.45,.08,0,.745,.21);}
 if(kind==='sofa'){box('base',1.9,.34,.8,0,.25);legs(1.6,.55,.08);box('seat',1.58,.14,.64,0,.49,-.03);box('back',1.9,.56,.16,0,.7,.32);for(const x of [-.88,.88])box('arm',.14,.38,.8,x,.57);}
 if(kind==='door'){box('left-frame',.1,2.2,.16,-.5);box('right-frame',.1,2.2,.16,.5);box('lintel',1.1,.1,.16,0,2.15);box('door-leaf',.88,2.05,.06,0,1.025);box('handle',.12,.04,.08,.31,1,.065);}
 if(kind==='window'){box('left-frame',.09,1.4,.14,-.75);box('right-frame',.09,1.4,.14,.75);box('sill',1.59,.09,.2,0,.045);box('lintel',1.59,.09,.14,0,1.355);box('mullion',.06,1.3,.1,0,.7);box('crossbar',1.5,.06,.1,0,.7);}
 if(kind==='stairs'){for(let i=0;i<5;i++)box(`step-${i+1}`,1.2,(i+1)*.18,.3,0,(i+1)*.09,(i-2)*.3);}
 return group;
}
// SkeletonUtils clones retain source materials and geometries. Clone only materials.
export function cloneActorMaterials(model){const copies=new Map();model.traverse(o=>{if(!o.material)return;const copy=m=>{if(!copies.has(m))copies.set(m,m.clone());return copies.get(m);};o.material=Array.isArray(o.material)?o.material.map(copy):copy(o.material);});model.userData.ownedActorMaterials=[...copies.values()];return model;}
export function tintActorMaterials(model,color){if(!color)return;model.traverse(o=>{for(const material of o.material?(Array.isArray(o.material)?o.material:[o.material]):[])if(material.color)material.color.set(color);});}
