import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { PROPS, createPropModel, cloneActorMaterials, tintActorMaterials } from '../src/2026-10-23-props.mjs';
test('all sixteen props have grounded metre bounds and distinct components',()=>{
 assert.equal(PROPS.length,16);
 for(const {kind} of PROPS){const a=createPropModel(kind,'#3388aa'),b=createPropModel(kind,'#ff9900');a.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(a);assert.ok(Math.abs(box.min.y)<1e-6,kind);assert.ok(box.max.y>.4&&box.max.y<4,kind);assert.ok(a.children.length>=(['box','wall'].includes(kind)?1:3),kind);assert.notEqual(a.children[0].material,b.children[0].material);assert.equal(a.children.find(m=>!m.userData.preserveColor).material.color.getHexString(),'3388aa');}
});
test('actor clones preserve shared geometry and skinning while owning independent tint materials',()=>{
 const geometry=new THREE.BoxGeometry(),source=new THREE.MeshStandardMaterial({color:'#aaaaaa'}),template=new THREE.Group();const mesh=new THREE.SkinnedMesh(geometry,source);template.add(mesh);
 const a=template.clone(),b=template.clone();cloneActorMaterials(a);cloneActorMaterials(b);tintActorMaterials(a,'#336699');tintActorMaterials(b,'#ff8800');
 assert.equal(a.children[0].geometry,geometry);assert.ok(a.children[0].isSkinnedMesh);assert.notEqual(a.children[0].material,b.children[0].material);assert.equal(source.color.getHexString(),'aaaaaa');assert.equal(a.children.find(m=>!m.userData.preserveColor).material.color.getHexString(),'336699');assert.equal(b.children[0].material.color.getHexString(),'ff8800');
});
import { createProject, validateProject } from '../2026-10-23-core.mjs';
test('all prop kinds survive project validation and JSON save/open',()=>{
 const p=createProject();p.props=PROPS.map(({kind,name},i)=>({id:`prop-${i}`,kind,name,position:[i,0,0],rotation:.4,scale:[1.2,.8,1],color:'#446688'}));
 assert.deepEqual(validateProject(JSON.parse(JSON.stringify(p))).props,p.props);
 p.props[0].kind='unsupported';assert.throws(()=>validateProject(p));
});
test('furniture and architectural components retain practical dimensions',()=>{
 const expected={table:[1.6,.88,.85],box:[1,1,1],wall:[5,3,.15],chair:[.5,1.06,.5],bench:[1.6,.97,.5],sofa:[1.9,.98,.8],door:[1.1,2.2,.185],window:[1.59,1.4,.2],stairs:[1.2,.9,1.5]};
 for(const [kind,dimensions] of Object.entries(expected)){const model=createPropModel(kind),size=new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3()).toArray();size.forEach((value,i)=>assert.ok(Math.abs(value-dimensions[i])<1e-6,`${kind} dimension ${i}: ${value}`));}
 const steps=createPropModel('stairs').children;assert.deepEqual(steps.map(m=>m.name),['step-1','step-2','step-3','step-4','step-5']);assert.ok(steps.every((m,i)=>i===0||m.geometry.parameters.height>steps[i-1].geometry.parameters.height));
});
import { Stage } from '../src/2026-10-23-stage.mjs';
test('removing imported actor disposes only its cloned materials',()=>{
 const geometry=new THREE.BoxGeometry(),material=new THREE.MeshStandardMaterial(),template=new THREE.Group();template.add(new THREE.Mesh(geometry,material));
 const model=cloneActorMaterials(template.clone()),root=new THREE.Group();root.userData.hasTemplate=true;root.add(model);let geometryDisposals=0,sourceDisposals=0,cloneDisposals=0;geometry.addEventListener('dispose',()=>geometryDisposals++);material.addEventListener('dispose',()=>sourceDisposals++);model.children[0].material.addEventListener('dispose',()=>cloneDisposals++);
 Stage.prototype.removeObject.call({scene:new THREE.Scene()},root);assert.equal(geometryDisposals,0);assert.equal(sourceDisposals,0);assert.equal(cloneDisposals,1);
});
