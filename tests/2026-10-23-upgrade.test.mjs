import test from 'node:test';
import assert from 'node:assert/strict';
import {createProject,validateProject} from '../2026-10-23-core.mjs';
import {upgradeClips} from '../src/2026-10-23-directing-ui.mjs';
test('legacy clips migrate without colliding with existing entity IDs and remain stable',()=>{
 const p=createProject();p.props[0].id='actor-1-clip-1';validateProject(p);
 upgradeClips(p);assert.doesNotThrow(()=>validateProject(p));
 const saved=structuredClone(p);upgradeClips(p);assert.deepEqual(p,saved);
});
