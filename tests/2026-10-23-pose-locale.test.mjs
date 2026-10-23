import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {poseLabel,poseCategory,matchesPose} from '../src/2026-10-23-pose-locale.mjs';

const source=await readFile(new URL('../src/2026-10-23-poses.mjs',import.meta.url),'utf8');
const poses=JSON.parse(source.match(/export const POSES = (\[.*?\]);/s)[1]);
const byId=id=>poses.find(p=>p.id===`a3d_pose_${id}`);
test('all 121 catalog poses have Korean labels and categories',()=>{
  assert.equal(poses.length,121);
  for(const pose of poses){
    assert.match(poseLabel(pose),/[가-힣]/,pose.id);
    assert.doesNotMatch(poseLabel(pose),/[a-z]/i,pose.id);
    assert.match(poseCategory(pose),/^[가-힣 ]+$/,pose.id);
    assert.notEqual(poseLabel(pose),pose.name);
  }
});
test('detailed left/right descriptions retain body and object relationships',()=>{
  assert.equal(poseLabel(byId('stand-left-leg-obj-left-hand-on-knee-r-h')),'왼발을 물체에 올리고 왼손은 무릎, 오른손은 허리에');
  assert.equal(poseLabel(byId('stand-right-leg-obj-l-hip-right-hand-on')),'오른발을 물체에 올리고 왼손은 허리, 오른손은 턱에');
  assert.equal(poseLabel(byId('sit-reaching-left-hand-towards-right-toe')),'왼손을 오른발 끝으로 뻗기');
  assert.equal(poseLabel(byId('dance-legs-spread-lean-r')),'다리를 벌리고 오른쪽으로 기울이기');
  assert.equal(poseLabel(byId('dance-legs-spread-lean-l')),'다리를 벌리고 왼쪽으로 기울이기');
});
test('search supports Korean, English, original IDs and mixed normalized tokens',()=>{
  const pose=byId('stand-left-leg-obj-left-hand-on-knee-r-h');
  for(const query of ['왼발 무릎','LEFT KNEE','a3d_pose_stand-left-leg-obj','서기','stand 무릎','  ＬＥＦＴ　무릎  ','','   '])assert.equal(matchesPose(pose,query),true,query);
  assert.equal(matchesPose(pose,'오른발'),false);
  assert.equal(matchesPose(pose,'left sprinting'),false);
});
test('locale operations preserve original persisted catalog fields',()=>{
  const before=JSON.stringify(poses);
  for(const pose of poses){Object.freeze(pose);poseLabel(pose);poseCategory(pose);matchesPose(pose,'left 왼손');}
  assert.equal(JSON.stringify(poses),before);
  assert.deepEqual(JSON.parse(JSON.stringify({poseId:poses[0].id})),{poseId:'a3d_pose_dyn-floating-legs-raised-arms-extended-u'});
});
