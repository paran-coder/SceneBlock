import test from 'node:test';
import assert from 'node:assert/strict';
import {samplePoseKeys,fitPoseKeys} from '../src/2026-10-23-pose-keys.mjs';
import {createProject,validateProject} from '../2026-10-23-core.mjs';
import {POSES} from '../src/2026-10-23-poses.mjs';
const clip={start:1,end:9,poseKeys:[{id:'k1',time:2,poseId:POSES[0].id},{id:'k2',time:6,poseId:POSES[1].id}]};
test('keys hold ends and sample absolute scene time deterministically',()=>{assert.equal(samplePoseKeys(clip,0).from.id,'k1');assert.equal(samplePoseKeys(clip,9).from.id,'k2');assert.equal(samplePoseKeys(clip,4).alpha,.5);samplePoseKeys(clip,8);assert.equal(samplePoseKeys(clip,3).alpha,.25);assert.equal(samplePoseKeys({...clip,poseKeyEasing:'easeInOut'},3).alpha,.15625)});
test('moving clip shifts keys while trim drops outside keys',()=>{assert.deepEqual(fitPoseKeys(clip,{start:3,end:11},true).poseKeys.map(k=>k.time),[4,8]);assert.deepEqual(fitPoseKeys(clip,{start:3}).poseKeys.map(k=>k.time),[6]);assert.deepEqual(fitPoseKeys(clip,{end:1.5}).poseKeys,[])});
test('key validation rejects unknown IDs duplicate times and global duplicate IDs',()=>{const p=createProject();p.actors[0].layers=[{id:'layer',name:'키',enabled:true,mask:'upper',weight:1,clips:[{id:'clip',action:'pose',start:1,end:9,speed:1,poseKeys:structuredClone(clip.poseKeys)}]}];assert.doesNotThrow(()=>validateProject(p));for(const change of [c=>c.poseKeys[0].poseId='missing',c=>c.poseKeys[1].time=2,c=>c.poseKeys[0].id='camera-1',c=>c.poseKeys[0].time=0,c=>c.poseKeyEasing='bad']){const copy=structuredClone(p);change(copy.actors[0].layers[0].clips[0]);assert.throws(()=>validateProject(copy))}});
