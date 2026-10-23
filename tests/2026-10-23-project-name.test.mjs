import test from 'node:test';
import assert from 'node:assert/strict';
import {createProject,parseScenePrompt} from '../2026-10-23-core.mjs';
test('fresh scenes start untitled and composition preserves deliberate project name',()=>{
 const p=createProject();assert.equal(p.name,'제목 없는 장면');assert.equal(parseScenePrompt('카페에서 두 사람이 대화한다',p).name,p.name);
 p.name='촬영 테스트';assert.equal(parseScenePrompt('두 사람이 걷는다',p).name,p.name);
});
