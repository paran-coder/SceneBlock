import test from 'node:test';
import assert from 'node:assert/strict';
import {sampleRoute,routeDisplayPoints} from '../src/2026-10-23-path-curves.mjs';
import {createProject,evaluateActor,evaluateCamera,validateProject} from '../2026-10-23-core.mjs';
const route=[[0,0,0],[2,0,0],[2,0,2],[4,0,2]];
test('smooth endpoints, tangent continuity and uniform distance',()=>{
 assert.deepEqual(sampleRoute(route,0,'smooth').position,route[0]);
 assert.deepEqual(sampleRoute(route,1,'smooth').position,route.at(-1));
 const samples=Array.from({length:101},(_,i)=>sampleRoute(route,i/100,'smooth'));
 const lengths=samples.slice(1).map((v,i)=>Math.hypot(...v.position.map((x,j)=>x-samples[i].position[j])));
 assert.ok(Math.max(...lengths)/Math.min(...lengths)<1.04);
 for(let i=1;i<samples.length;i++) assert.ok(samples[i].tangent.reduce((v,n,j)=>v+n*samples[i-1].tangent[j],0)>.95);
 assert.ok(routeDisplayPoints(route,'smooth').length>=201);
});
test('legacy polyline, repeated points and cache mutation',()=>{
 assert.deepEqual(sampleRoute(route,.5).position,[2,0,1]);
 assert.deepEqual(sampleRoute([[1,2,3],[1,2,3]],.5,'smooth').position,[1,2,3]);
 assert.ok(sampleRoute([[0,0,0],[0,0,0],[1,0,0]],.5,'smooth').tangent.every(Number.isFinite));
 const mutable=structuredClone(route),before=sampleRoute(mutable,.4,'smooth').position;
 mutable[1][2]=3;assert.notDeepEqual(sampleRoute(mutable,.4,'smooth').position,before);
 assert.deepEqual(route,[[0,0,0],[2,0,0],[2,0,2],[4,0,2]]);
});
test('actor and camera use identical route evaluator and validate modes',()=>{
 const p=createProject(),a=p.actors[0],c=p.cameras[0];
 a.path=structuredClone(route);a.pathCurve='smooth';a.start=0;a.end=10;
 c.path=structuredClone(route);c.pathCurve='smooth';c.motion={type:'path',easing:'linear',angle:0};p.cuts=[{cameraId:c.id,start:0,end:10}];
 for(const t of [0,1,4,7,10])assert.deepEqual(evaluateActor(a,t).position,evaluateCamera(p,t).position);
 validateProject(p);a.pathCurve='invalid';assert.throws(()=>validateProject(p),/경로/);
});
