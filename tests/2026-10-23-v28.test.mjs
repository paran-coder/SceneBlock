import test from 'node:test';
import assert from 'node:assert/strict';
import {createProject,evaluateActor} from '../2026-10-23-core.mjs';
import {recommendedPose} from '../src/2026-10-23-pose-policy.mjs';
test('explicit facing overrides route facing after user rotates actor',()=>{const a=createProject().actors[0];a.rotation=0;a.autoFacePath=false;assert.equal(evaluateActor(a,2).rotation,0);a.rotation=Math.PI;assert.equal(evaluateActor(a,2).rotation,Math.PI)});
test('left arm suggestions exclude explicitly right-only poses',()=>{assert.equal(recommendedPose({id:'point-right-hand',name:'Point Right Hand',category:'stand'},'leftArm'),false);assert.equal(recommendedPose({id:'point-right-hand',name:'Point Right Hand',category:'stand'},'rightArm'),true)});
