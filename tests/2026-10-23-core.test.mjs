import test from 'node:test';
import assert from 'node:assert/strict';
import { createProject, validateProject, evaluateActor, evaluateCamera, parseScenePrompt, cloneProject } from '../2026-10-23-core.mjs';

test('project save JSON round trip preserves cameras, paths and animation provenance', () => {
  const p = createProject();
  p.actors[0].motion = null;
  assert.deepEqual(validateProject(JSON.parse(JSON.stringify(p))), p);
  const q = cloneProject(p); q.actors[0].position[0] += 3;
  assert.notEqual(q.actors[0].position[0], p.actors[0].position[0]);
});
test('actor traverses polyline by distance, clamps and keeps action timing', () => {
  const a = {...createProject().actors[0], position:[0,0,0], path:[[0,0,0],[1,0,0],[1,0,3]], start:2,end:6,speed:2,action:'walk'};
  assert.deepEqual(evaluateActor(a,1).position,[0,0,0]);
  assert.deepEqual(evaluateActor(a,4).position,[1,0,1]);
  assert.equal(evaluateActor(a,4).localTime,4);
  assert.deepEqual(evaluateActor(a,9).position,[1,0,3]);
  assert.equal(evaluateActor(a,9).action,'idle');
});
test('camera cuts use half-open intervals and interpolate camera move deterministically', () => {
  const p=createProject(); p.cameras[0].position=[0,2,6]; p.cameras[0].endPosition=[2,2,6];
  p.cuts=[{cameraId:p.cameras[0].id,start:0,end:5},{cameraId:p.cameras[1].id,start:5,end:10}];
  assert.equal(evaluateCamera(p,5).id,p.cameras[1].id);
  assert.deepEqual(evaluateCamera(p,2.5).position,[1,2,6]);
});
test('invalid imported time, references and non-finite coordinates are rejected',()=>{
  for(const mutate of [p=>p.duration=-1,p=>p.actors[0].position[0]=Infinity,p=>p.cuts[0].cameraId='missing',p=>p.actors.push(p.actors[0]),p=>p.actors[0].end=999]){
    const p=createProject();mutate(p);assert.throws(()=>validateProject(p));
  }
});
test('local scene prompt creates editable cafe blocking without claiming AI generation',()=>{
  const p=parseScenePrompt('카페에서 두 사람이 마주 앉아 대화한다',createProject());
  assert.equal(p.actors.length,2);assert.equal(p.actors[0].action,'sit');
  assert.ok(p.props.some(p=>p.kind==='table'));assert.equal(p.actors[0].motion,null);
  assert.ok(p.actors[0].position[0]*p.actors[1].position[0]<0);
});
test('import rejects a motion missing playback duration before accepting project',()=>{
 const p=createProject();p.actors[0].motion={version:1,source:'kimodo',fps:30,frames:1,jointNames:['Hips'],parents:[-1],restPositions:[[0,0,0]],localRotations:[[[0,0,0,1]]],rootPositions:[[0,1,0]]};
 assert.throws(()=>validateProject(p));
});
