import test from 'node:test';
import assert from 'node:assert/strict';
import {Group,Bone,PerspectiveCamera,Scene,Quaternion} from 'three';
import {Stage} from '../src/2026-10-23-stage.mjs';
import {createProject} from '../2026-10-23-core.mjs';
import {resetCharacterPose} from '../2026-10-23-motion.mjs';
import {applyLibraryPose,applyJointOffsets} from '../src/2026-10-23-poses.mjs';
test('Stage library pose starts from bind rather than procedural idle; offsets follow pose',()=>{
 const stage=Object.create(Stage.prototype),model=new Group(),hips=new Bone(),arm=new Bone(),root=new Group();hips.name='mixamorigHips';arm.name='mixamorigLeftArm';model.add(hips);hips.add(arm);root.add(model);root.userData.model=model;model.updateMatrixWorld(true);
 const project=createProject();project.actors=[{...project.actors[0],path:[],rotation:0,clips:[{id:'pose-clip',action:'pose',start:0,end:5,speed:1,motion:null,poseId:'fixture',jointOffsets:{LeftArm:[10,0,0]}}]}];
 const document={bones:{LeftArm:[0,0,0,1]}};
 Object.assign(stage,{project,objects:new Map([['actor-1',root]]),gizmo:{dragging:false},poseCache:new Map([['fixture',document]]),shotCamera:new PerspectiveCamera(),camera:new PerspectiveCamera(),orbit:{update(){}},renderer:{render(){}},scene:new Scene(),onStatus(){}});
 resetCharacterPose(model);applyLibraryPose(model,document);applyJointOffsets(model,{LeftArm:[10,0,0]});const expected=arm.getWorldQuaternion(new Quaternion());resetCharacterPose(model);
 stage.update(.7);assert.ok(arm.getWorldQuaternion(new Quaternion()).angleTo(expected)<1e-6,'library pose must not inherit procedural arm lowering');stage.update(1.3);assert.ok(arm.getWorldQuaternion(new Quaternion()).angleTo(expected)<1e-6,'fresh frames must not accumulate offsets');
});

test('pose export preparation rejects failed or unknown poses and permits immediate explicit retry',async()=>{
 const stage=Object.create(Stage.prototype),original=globalThis.fetch;let requests=0;
 Object.assign(stage,{project:{actors:[{clips:[{poseId:'a3d_pose_t-pose'}]}]},assetsReady:Promise.resolve(),poseCache:new Map(),posePending:new Map(),diagnostics:[],onStatus(){},update(){}});
 try{globalThis.fetch=async()=>{requests++;return {ok:false,status:503}};await assert.rejects(()=>stage.preparePoses(),/pose/i);assert.equal(requests,1);await stage.loadPose('a3d_pose_t-pose');assert.equal(requests,1,'frame requests must respect failure backoff');
 globalThis.fetch=async()=>{requests++;return {ok:true,json:async()=>({bones:{}})}};await stage.preparePoses();assert.equal(requests,2);assert.ok(stage.poseCache.has('a3d_pose_t-pose'));
 stage.project.actors[0].clips[0].poseId='unknown-fixture';await assert.rejects(()=>stage.preparePoses(),/unknown.*pose|pose.*unknown/i);
 }finally{globalThis.fetch=original}
});
