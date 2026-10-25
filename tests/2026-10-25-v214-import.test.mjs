import test from 'node:test';
import assert from 'node:assert/strict';
import {Bone,Group,Quaternion} from 'three';
import {createProject,validateProject,evaluateActor} from '../2026-10-23-core.mjs';
const api=await import('../src/2026-10-25-poseblock-import.mjs').catch(()=>({}));
const single={app:'poseblock3d',version:2,poses:[{name:'arbitrary label',q:{pelvis:[0,0,0,1],shoulderL:[0,0,Math.SQRT1_2,Math.SQRT1_2]}}],scenes:[]};
test('imports generic names and normalized quaternion data without thumbnails',()=>{
 assert.equal(typeof api.parsePoseBlock,'function');const rows=api.parsePoseBlock(single);assert.equal(rows.length,1);assert.equal(rows[0].name,'arbitrary label');assert.equal(rows[0].pose.rotations.shoulderL.length,4);assert.equal(rows[0].pose.thumb,undefined);
});
test('scene character entries retain independent poses and optional placement',()=>{
 assert.equal(typeof api.parsePoseBlock,'function');const rows=api.parsePoseBlock({app:'poseblock3d',version:2,poses:[],scenes:[{name:'pair',state:{chars:[{name:'X',q:{pelvis:[0,0,0,2]},pos:[1,0,-2],yaw:.5},{name:'Y',q:{head:[0,0,0,1]},pos:[0,0,0],yaw:0}]}}]});assert.equal(rows.length,2);assert.deepEqual(rows[0].position,[1,0,-2]);assert.deepEqual(rows[0].pose.rotations.pelvis,[0,0,0,1]);assert.equal(rows[1].name,'pair / Y');
});
test('rejects wrong formats, invalid rotations and unknown-only rigs',()=>{
 assert.equal(typeof api.parsePoseBlock,'function');for(const doc of [{...single,app:'other'},{...single,poses:[{name:'x',q:{head:[0,0,0,0]}}]},{...single,poses:[{name:'x',q:{head:[0,0,Infinity,1]}}]},{...single,poses:[{name:'x',q:{unknown:[0,0,0,1]}}]}])assert.throws(()=>api.parsePoseBlock(doc));
});
test('import applies as one bounded overlay without changing locomotion or existing clips',()=>{
 assert.equal(typeof api.applyPoseBlock,'function');const p=createProject();const old=structuredClone(p.actors[0]);const row=api.parsePoseBlock(single)[0];api.applyPoseBlock(p,[{entry:row,actorId:'actor-1'}],{start:2,end:4,mask:'full',basis:'tpose',placement:false});assert.deepEqual(p.actors[0].path,old.path);assert.equal(p.actors[0].layers[0].clips[0].start,2);assert.equal(evaluateActor(p.actors[0],3).overlays[0].importedPose.source,'poseblock3d');assert.equal(evaluateActor(p.actors[0],1).overlays.length,0);assert.doesNotThrow(()=>validateProject(JSON.parse(JSON.stringify(p))));
});
test('rejects duplicate target mappings without partially mutating the project',()=>{
 assert.equal(typeof api.applyPoseBlock,'function');const p=createProject(),before=structuredClone(p),row=api.parsePoseBlock(single)[0];assert.throws(()=>api.applyPoseBlock(p,[{entry:row,actorId:'actor-1'},{entry:row,actorId:'actor-1'}],{start:0,end:2,mask:'full',basis:'tpose'}));assert.deepEqual(p,before);
});
test('explicit placement moves the whole path while pose-only import does not',()=>{
 assert.equal(typeof api.applyPoseBlock,'function');const p=createProject(),row={...api.parsePoseBlock(single)[0],position:[4,0,1],yaw:.2};api.applyPoseBlock(p,[{entry:row,actorId:'actor-1'}],{start:0,end:2,mask:'full',basis:'tpose',placement:true});assert.deepEqual(p.actors[0].position,[4,0,1]);assert.deepEqual(p.actors[0].path[0],[4,0,1]);assert.equal(p.actors[0].rotation,.2);assert.equal(p.actors[0].autoFacePath,false);
});
test('retarget retains model bind axes and parent influence instead of copying raw local quaternions',()=>{
 assert.equal(typeof api.applyImportedPose,'function');const model=new Group(),hips=new Bone(),arm=new Bone(),hand=new Bone();hips.name='mixamorigHips';arm.name='mixamorigLeftArm';hand.name='mixamorigLeftHand';model.add(hips);hips.add(arm);arm.add(hand);arm.quaternion.setFromAxisAngle({x:1,y:0,z:0},.4);const rest=arm.quaternion.clone();api.applyImportedPose(model,api.parsePoseBlock(single)[0].pose);const expected=new Quaternion(0,0,Math.SQRT1_2,Math.SQRT1_2).multiply(rest);assert.ok(arm.getWorldQuaternion(new Quaternion()).angleTo(expected)<1e-6);assert.ok(hand.getWorldQuaternion(new Quaternion()).angleTo(expected)<1e-6);assert.deepEqual(model.position.toArray(),[0,0,0]);
});
test('project validator rejects corrupt imported poses in saved clips',()=>{
 const p=createProject();p.actors[0].clips=[{id:'bad',action:'pose',start:0,end:2,speed:1,motion:null,importedPose:{version:1,source:'poseblock3d',name:'bad',basis:'tpose',rotations:{pelvis:[0,0,0,0]}}}];assert.throws(()=>validateProject(p),/포즈|pose/i);
});
