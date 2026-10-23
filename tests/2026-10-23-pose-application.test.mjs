import test from 'node:test';
import assert from 'node:assert/strict';
import {posePreviewTime} from '../src/2026-10-23-pose-application.mjs';
test('pose preview escapes zero fade and out of range without altering duration',()=>{
 const c={start:0,end:5,fadeIn:.2,fadeOut:.2};assert.equal(posePreviewTime(c,0),.2);assert.equal(posePreviewTime(c,9),.2);assert.equal(posePreviewTime(c,2),2);assert.equal(posePreviewTime(c,4.99),4.8);assert.deepEqual(c,{start:0,end:5,fadeIn:.2,fadeOut:.2});
});
test('short intervals and omitted fades always preview inside the active interval',()=>{
 const c={start:2,end:2.02,fadeIn:.2,fadeOut:.2};assert.ok(Math.abs(posePreviewTime(c,0)-2.01)<1e-9);assert.ok(posePreviewTime({start:0,end:5},5)>0);assert.throws(()=>posePreviewTime({start:0,end:0},0));
});
