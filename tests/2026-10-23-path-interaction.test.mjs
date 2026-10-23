import test from 'node:test';
import assert from 'node:assert/strict';
import {PerspectiveCamera,Vector3} from 'three';
import {Stage} from '../src/2026-10-23-stage.mjs';
test('waypoint picking uses a forgiving CSS-pixel target and picks the nearest',()=>{
 const stage=Object.create(Stage.prototype);stage.pathGuide={visible:true,children:[{userData:{pathIndex:0},position:[100,100]},{userData:{pathIndex:1},position:[140,100]}]};stage.pathScreen=p=>p;
 assert.equal(stage.pickPathHandle({clientX:113,clientY:107}),0);
 assert.equal(stage.pickPathHandle({clientX:137,clientY:108}),1);
 assert.equal(stage.pickPathHandle({clientX:210,clientY:150}),-1);
 stage.pathGuide.visible=false;assert.equal(stage.pickPathHandle({clientX:100,clientY:100}),-1);
});
test('top view toggles back to the exact prior edit view and drains orbit momentum',()=>{
 const stage=Object.create(Stage.prototype);stage.camera=new PerspectiveCamera();stage.camera.position.set(7,5,9);stage.camera.lookAt(1,1,0);stage.orbit={target:new Vector3(1,1,0),enableDamping:true,update(){}};stage.update=()=>{};stage.time=0;
 const original={position:stage.camera.position.toArray(),target:stage.orbit.target.toArray(),quaternion:stage.camera.quaternion.toArray()};
 assert.equal(stage.setTopView(),true);assert.equal(stage.topViewActive,true);
 assert.equal(stage.setTopView(),false);assert.deepEqual(stage.camera.position.toArray(),original.position);assert.deepEqual(stage.orbit.target.toArray(),original.target);assert.ok(stage.camera.quaternion.toArray().every((x,i)=>Math.abs(x-original.quaternion[i])<1e-12));assert.equal(stage.orbit.enableDamping,true);
});
