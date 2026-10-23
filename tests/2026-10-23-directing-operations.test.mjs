import test from 'node:test';
import assert from 'node:assert/strict';
import {motionClipPatch,timelineRange} from '../src/2026-10-23-directing-operations.mjs';
test('motion duration uses playback speed and clamps next clip/scene end',()=>{
 const c={id:'a',start:2,end:3,speed:2},motion={duration:6};assert.deepEqual(motionClipPatch(c,motion,[c],10),{motion,poseId:undefined,end:5});
 assert.equal(motionClipPatch(c,motion,[{id:'b',start:4,end:7},c],10).end,4);assert.equal(motionClipPatch(c,motion,[c],4.5).end,4.5);
 assert.equal(motionClipPatch(c,{duration:.01},[c],10).end,2.1);
 assert.throws(()=>motionClipPatch(c,{duration:NaN},[c],10));
});
test('timeline movement preserves length between neighbors and scene boundaries',()=>{
 const c={start:2,end:4},others=[{start:0,end:1},{start:6,end:8}];assert.deepEqual(timelineRange(c,9,'move',others,10),{start:4,end:6});assert.deepEqual(timelineRange(c,-9,'move',others,10),{start:1,end:3});assert.deepEqual(timelineRange(c,.16,'move',others,10),{start:2.2,end:4.2});
});
test('timeline trims enforce neighbor limits, minimum length and valid non-tenth imported times',()=>{
 const c={start:2,end:4},others=[{start:0,end:1},{start:6,end:8}];assert.deepEqual(timelineRange(c,100,'start',others,10),{start:3.9,end:4});assert.deepEqual(timelineRange(c,-100,'end',others,10),{start:2,end:2.1});
 const s=timelineRange({start:1.03,end:2.03},-10,'move',[{start:0,end:1.03}],10);assert.ok(s.start>=1.03);assert.ok(s.end-s.start>=.1-1e-9);
 const t=timelineRange({start:2,end:4},9,'end',[{start:4.04,end:6}],10);assert.ok(t.end<=4.04);assert.throws(()=>timelineRange(c,Infinity,'move',[],10));
});
test('operations preserve input objects and reject impossible motion intervals',()=>{
 const c={id:'c',start:1,end:2,speed:.5},m={duration:2},before=structuredClone(c);assert.equal(motionClipPatch(c,m,[c],10).end,5);assert.deepEqual(c,before);
 const n={start:0,end:1};timelineRange(c,.5,'move',[n],10);assert.deepEqual(c,before);assert.deepEqual(n,{start:0,end:1});
 assert.throws(()=>motionClipPatch({...c,start:9.95,end:10},m,[],10));
 assert.throws(()=>timelineRange({start:2,end:4},1,'move',[{start:3,end:5}],10));
 const short=timelineRange({start:2,end:2.02},0,'move',[],10);assert.ok(short.end-short.start>=.1-1e-9);
});
