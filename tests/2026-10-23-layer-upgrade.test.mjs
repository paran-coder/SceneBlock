import test from 'node:test';
import assert from 'node:assert/strict';
import {createProject,validateProject} from '../2026-10-23-core.mjs';
import {upgradeClips} from '../src/2026-10-23-directing-ui.mjs';
test('legacy base clips reserve existing layer and overlay clip IDs',()=>{
 const p=createProject(),a=p.actors[0];
 a.layers=[{id:'actor-1-clip-1',name:'Overlay',mask:'rightArm',weight:1,enabled:true,clips:[{id:'actor-1-clip-2',action:'wave',start:0,end:2,speed:1,motion:null}]}];
 upgradeClips(p);assert.equal(a.clips[0].id,'actor-1-clip-3');assert.doesNotThrow(()=>validateProject(p));
 const saved=structuredClone(p);upgradeClips(p);assert.deepEqual(p,saved);
});
