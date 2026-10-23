import test from 'node:test';
import assert from 'node:assert/strict';
import {createProject,evaluateActor} from '../2026-10-23-core.mjs';
const actor=()=>({...createProject().actors[0],position:[0,0,0],path:[[0,0,0],[8,0,0]],clips:[{id:'walk',action:'walk',start:0,end:8,speed:1,motion:null}]});
test('stretch walking clip stretches route through new end rather than walking in place',()=>{
 const a=actor();assert.equal(evaluateActor(a,4).position[0],4);assert.equal(evaluateActor(a,6).position[0],6);assert.equal(evaluateActor(a,8).position[0],8);
 a.clips[0].end=4;assert.equal(evaluateActor(a,2).position[0],4);assert.equal(evaluateActor(a,4).position[0],8);
});
test('moving walking clip delays movement and holds the final point',()=>{
 const a=actor();a.clips[0].start=2;a.clips[0].end=6;
 assert.equal(evaluateActor(a,1).position[0],0);assert.equal(evaluateActor(a,4).position[0],4);assert.equal(evaluateActor(a,9).position[0],8);
});
test('stationary gaps hold route progress and later locomotion continues it',()=>{
 const a=actor();a.clips=[{id:'a',action:'walk',start:0,end:2,speed:1},{id:'b',action:'wave',start:2,end:5,speed:1},{id:'c',action:'run',start:5,end:7,speed:1}];
 assert.equal(evaluateActor(a,1).position[0],2);assert.equal(evaluateActor(a,3).position[0],4);assert.equal(evaluateActor(a,6).position[0],6);assert.equal(evaluateActor(a,8).position[0],8);
});
test('pose and stationary clips do not traverse a leftover route',()=>{
 const a=actor();a.clips[0].action='pose';assert.equal(evaluateActor(a,4).position[0],0);
 a.clips=[];assert.equal(evaluateActor(a,9).position[0],0);
});
