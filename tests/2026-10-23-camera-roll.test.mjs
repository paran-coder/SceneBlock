import test from 'node:test';
import assert from 'node:assert/strict';
import {cameraCutRange} from '../src/2026-10-23-directing-operations.mjs';
const cuts=[{cameraId:'a',start:0,end:5},{cameraId:'b',start:5,end:8},{cameraId:'c',start:8,end:10}];
test('camera touching end rolls shared boundary in both directions and preserves outer times',()=>{
 assert.deepEqual(cameraCutRange(cuts,0,1,'end',10),[{index:0,range:{start:0,end:6}},{index:1,range:{start:6,end:8}}]);
 assert.deepEqual(cameraCutRange(cuts,1,-2,'start',10),[{index:1,range:{start:3,end:8}},{index:0,range:{start:0,end:3}}]);
 assert.deepEqual(cuts,[{cameraId:'a',start:0,end:5},{cameraId:'b',start:5,end:8},{cameraId:'c',start:8,end:10}]);
});
test('camera shared boundary clamps both cuts to minimum .1 seconds',()=>{
 assert.equal(cameraCutRange(cuts,0,100,'end',10)[0].range.end,7.9);
 assert.equal(cameraCutRange(cuts,1,-100,'start',10)[0].range.start,.1);
 assert.equal(cameraCutRange(cuts,2,100,'start',10)[0].range.start,9.9);
 assert.equal(cameraCutRange(cuts,1,-100,'end',10)[0].range.end,5.1);
});
test('outer camera edges stop at project bounds and noncontiguous edges leave gaps',()=>{
 assert.deepEqual(cameraCutRange(cuts,0,-5,'start',10),[{index:0,range:{start:0,end:5}}]);
 assert.deepEqual(cameraCutRange(cuts,2,5,'end',10),[{index:2,range:{start:8,end:10}}]);
 const gap=[{start:0,end:3},{start:5,end:10}];
 assert.deepEqual(cameraCutRange(gap,0,1,'end',10),[{index:0,range:{start:0,end:4}}]);
 assert.deepEqual(cameraCutRange(gap,1,-1,'start',10),[{index:1,range:{start:4,end:10}}]);
 assert.deepEqual(cameraCutRange(cuts,1,3,'move',10),[{index:1,range:{start:5,end:8}}]);
});
test('camera boundaries reject nonfinite drags and invalid cuts',()=>{
 assert.throws(()=>cameraCutRange(cuts,0,NaN,'end',10));
 assert.throws(()=>cameraCutRange(cuts,0,1,'invalid',10));
 assert.throws(()=>cameraCutRange(cuts,5,1,'end',10));
});
