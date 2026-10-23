import * as THREE from 'three';
import {PROP_CATALOG} from './2026-10-24-entity-catalog.mjs';
export const PROPS=PROP_CATALOG;
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
 if(PROPS.find(p=>p.kind===kind)?.category==='vehicles'){
  const dark=new THREE.MeshStandardMaterial({color:'#232930',roughness:.85}),glass=new THREE.MeshStandardMaterial({color:'#80acbd',roughness:.25});
  const detail=(name,w,h,d,x,y,z,mat)=>{const m=box(name,w,h,d,x,y,z);m.material=mat;m.userData.preserveColor=true;return m};
  const wheel=(x,z,r=.32,width=.18)=>{const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,width,20),dark);m.name='wheel';m.rotation.z=Math.PI/2;m.position.set(x,r,z);m.castShadow=m.receiveShadow=true;m.userData.preserveColor=true;group.add(m)};
  if(kind==='bicycle'||kind==='motorcycle'){
   const bike=kind==='bicycle',r=bike?.34:.3,length=bike?1.12:1.35;
   wheel(0,-length/2,r,bike?.06:.18);wheel(0,length/2,r,bike?.06:.18);
   box('frame',.12,.18,length,0,r+.12,0);box('front-fork',.1,.65,.1,0,.65,length/2);box('handlebar',.65,.07,.07,0,1,length/2);
   box('seat',bike?.22:.4,.1,bike?.3:.65,0,.88,-.2);if(!bike)box('engine',.42,.4,.5,0,.53,0);
  }else{
   const [w,h,l,r]=({car:[1.8,1.45,4.4,.32],suv:[1.9,1.8,4.7,.37],van:[1.95,2.1,5.1,.36],bus:[2.5,3.1,10.5,.5],truck:[2.4,3,6.8,.46]})[kind];
   const base=r*1.1;box('body',w,h*.42,l,0,base+h*.21,0);
   const cabinLength=kind==='truck'?l*.3:kind==='car'?l*.53:l*.82,cabinZ=kind==='truck'?l*.3:0;
   box('cabin',w*.91,h*.42,cabinLength,0,base+h*.63,cabinZ);
   for(const x of [-w*.46,w*.46])detail('side-window',.025,h*.28,cabinLength*.86,x,base+h*.65,cabinZ,glass);
   for(const z of [-1,1])detail('windshield',w*.8,h*.28,.025,0,base+h*.65,cabinZ+z*cabinLength*.501,glass);
   if(kind==='truck')box('cargo',w,h*.75,l*.55,0,base+h*.6,-l*.19);
   for(const x of [-w/2,w/2])for(const z of [-l*.32,l*.32])wheel(x,z,r,.18);
   for(const x of [-w*.32,w*.32])detail('headlight',.25,.16,.04,x,base+h*.25,l/2+.025,glass);
  }
 }
 return group;
}
// SkeletonUtils clones retain source materials and geometries. Clone only materials.
export function cloneActorMaterials(model){const copies=new Map();model.traverse(o=>{if(!o.material)return;const copy=m=>{if(!copies.has(m))copies.set(m,m.clone());return copies.get(m);};o.material=Array.isArray(o.material)?o.material.map(copy):copy(o.material);});model.userData.ownedActorMaterials=[...copies.values()];return model;}
export function tintActorMaterials(model,color){if(!color)return;model.traverse(o=>{if(o.userData.preserveColor)return;for(const material of o.material?(Array.isArray(o.material)?o.material:[o.material]):[])if(material.color)material.color.set(color);});}
