import test from 'node:test';
import assert from 'node:assert/strict';
import {createProject,validateProject,evaluateActor,evaluateCamera} from '../2026-10-23-core.mjs';
const clip=(id,action,start,end,extra={})=>({id,action,start,end,speed:1,motion:null,...extra});
test('sequential clips use half-open boundaries and clear all state in gaps',()=>{
 const a=createProject().actors[0];a.clips=[clip('c1','pose',0,2,{poseId:'standing',jointOffsets:{Head:[10,0,0]}}),clip('c2','run',3,5,{speed:2})];
 assert.equal(evaluateActor(a,1).poseId,'standing');
 for(const t of [2,2.5,5]) {const s=evaluateActor(a,t);assert.equal(s.action,'idle');assert.equal(s.clipId,null);assert.equal(s.poseId,null);assert.deepEqual(s.jointOffsets,{});assert.equal(s.motion,null);}
 assert.equal(evaluateActor(a,3).clipId,'c2');assert.equal(evaluateActor(a,4).localTime,2);assert.deepEqual(evaluateActor(a,4).position,[-1.04,0,0]);
});
test('clips, models, offsets and camera metadata survive validation and reject malformed imports',()=>{
 const p=createProject();p.actors[0].clips=[clip('c','pose',0,2,{poseId:'standing',jointOffsets:{Head:[0,20,0]}})];p.actors[0].modelKey='a3d_char_30ec53c93eae4173946b38639691ebe0.glb';
 assert.deepEqual(validateProject(p),p);
 for(const mutate of [q=>q.actors[0].clips.push(clip('d','walk',1,3)),q=>q.actors[0].clips.push(clip('c','walk',3,4)),q=>q.actors[0].clips[0].speed=Infinity,q=>q.actors[0].clips[0].poseId='../escape',q=>q.actors[0].clips[0].jointOffsets.Head=[NaN,0,0],q=>q.actors[0].modelKey='unknown.glb',q=>q.cameras[0].followActorId='missing',q=>q.cameras[0].motion={type:'orbit',easing:'oops',angle:90}]){const q=structuredClone(p);mutate(q);assert.throws(()=>validateProject(q));}
});
test('camera follows route delta and orbit/easing endpoints are deterministic',()=>{
 const p=createProject();const c=p.cameras[0];p.cuts=[{cameraId:c.id,start:0,end:10}];c.position=[0,1,5];c.target=[0,1,0];c.motion={type:'orbit',easing:'linear',angle:180};
 let s=evaluateCamera(p,5);assert.ok(Math.abs(s.position[0]-5)<1e-9);assert.ok(Math.abs(s.position[2])<1e-9);
 c.motion={type:'static',easing:'linear',angle:0};c.followActorId=p.actors[0].id;s=evaluateCamera(p,5);assert.deepEqual(s.position,[1.2,1,5]);assert.deepEqual(s.target,[-0.8,1.2,0]);
 delete c.followActorId;c.motion={type:'linear',easing:'easeInOut',angle:0};c.endPosition=[8,1,5];assert.equal(evaluateCamera(p,2.5).position[0],1.25);
});
test('legacy actor motion stays available only during the legacy active interval',()=>{const a=createProject().actors[0];a.motion={example:true};assert.deepEqual(evaluateActor(a,1).motion,a.motion);assert.equal(evaluateActor(a,9).motion,null);});
test('empty clips suppress legacy animation and clip motion never inherits stale data',()=>{
 const a=createProject().actors[0];a.motion={legacy:true};a.clips=[];assert.equal(evaluateActor(a,1).action,'idle');
 a.clips=[clip('motion','walk',1,2,{motion:{selected:true}}),clip('plain','wave',2,3)];assert.deepEqual(evaluateActor(a,1.5).motion,{selected:true});assert.equal(evaluateActor(a,2).motion,null);
});
test('import rejects excessive clips, cross-item duplicate IDs, invalid angles and out-of-scene clips',()=>{
 for(const mutate of [p=>p.actors[0].clips=Array.from({length:65},(_,i)=>clip(`c${i}`,'idle',0,1)),p=>p.actors[0].clips=[clip(p.cameras[0].id,'idle',0,1)],p=>p.actors[0].clips=[clip('c','pose',0,1,{jointOffsets:{Head:[181,0,0]}})],p=>p.actors[0].clips=[clip('c','walk',9,11)],p=>p.actors[0].clips=[clip('c','run',0,1,{motion:{}})]]) {const p=createProject();mutate(p);assert.throws(()=>validateProject(p));}
});
test('static, dolly and pan camera presets preserve expected geometry',()=>{
 const p=createProject(),c=p.cameras[0];p.cuts=[{cameraId:c.id,start:0,end:10}];c.position=[0,2,6];c.target=[0,2,0];c.endPosition=[100,2,6];c.motion={type:'static',easing:'linear',angle:90};assert.deepEqual(evaluateCamera(p,10).position,[0,2,6]);
 c.motion.type='dolly';delete c.endPosition;assert.deepEqual(evaluateCamera(p,10).position,[0,2,3]);c.motion.type='pan';const s=evaluateCamera(p,10);assert.deepEqual(s.position,[0,2,6]);assert.ok(Math.abs(s.target[0]+6)<1e-9);assert.ok(Math.abs(s.target[2]-6)<1e-9);
});
test('final camera uses chronologically last cut even when imported cuts are unsorted',()=>{
 const p=createProject();p.cuts=[p.cuts[2],p.cuts[0],p.cuts[1]];
 assert.equal(evaluateCamera(p,p.duration).id,p.cameras[2].id);
 assert.equal(evaluateCamera(p,p.duration+1).id,p.cameras[2].id);
});
