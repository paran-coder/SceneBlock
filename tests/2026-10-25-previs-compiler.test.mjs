import test from 'node:test';
import assert from 'node:assert/strict';
import {compilePrevisIntent,previsCapabilities} from '../src/2026-10-25-intent-compiler.mjs';
import {evaluateActor,validateProject} from '../2026-10-23-core.mjs';
import {POSES} from '../src/2026-10-23-poses.mjs';
import {fixture,entity,req,action,relation,shot} from './2026-10-25-intent-fixtures.mjs';
const compile=x=>compilePrevisIntent(x,{description:'arbitrary scene'});
test('timed three dimensional arrivals survive JSON and manual edits invalidate track',()=>{
 const f=fixture({duration:8,actions:[action('run',{end:2,to:[4,0,0]}),action('descend',{id:'down',start:4,end:8,from:[4,0,0],to:[4,-3,2]})]});
 const r=compile(f);assert.equal(r.report.canApply,true,JSON.stringify(r.report));const a=validateProject(JSON.parse(JSON.stringify(r.project))).actors[0];
 assert.deepEqual(evaluateActor(a,3).position,[4,0,0]);assert.deepEqual(evaluateActor(a,6).position,[4,-1.5,1]);assert.ok(previsCapabilities.actions.includes('descend'));
 a.path=[[0,0,0],[20,0,0]];assert.notDeepEqual(evaluateActor(a,6).position,[4,-1.5,1]);assert.equal(a.modelKey,undefined);assert.equal(a.sizeScale,undefined);
});
test('same source soft appearance does not poison bound actors and group layout',()=>{
 const f=fixture({entities:[entity('a'),entity('b','actor',null,null),entity('c','actor',null,null)],requirements:[req('r','relation'),req('look','appearance')],actions:[],relations:[relation('near',{objectId:'b'}),relation('behind',{id:'second',subjectId:'c',objectId:'b'})],coverage:[{sourceId:'source-1',requirementIds:['r','look'],status:'unsupported'}]});
 const r=compile(f);assert.equal(r.report.canApply,true,JSON.stringify(r.report));assert.equal(r.project.actors.length,3);assert.equal(r.report.requirements.find(x=>x.id==='look').status,'approximate');
});
test('seated conversation and moving medium camera compile without character mutations',()=>{
 const f=fixture({entities:[entity(),entity('b','prop','chair',[0,0,0])],requirements:[req('r','action'),req('seat','relation'),req('camera','shot')],actions:[action('sit')],relations:[relation('seatedOn',{requirementIds:['seat']})],shots:[shot({framing:'medium',motion:'orbit',requirementIds:['camera']})],coverage:[{sourceId:'source-1',requirementIds:['r','seat','camera'],status:'interpreted'}]});
 const r=compile(f);assert.equal(r.report.canApply,true,JSON.stringify(r.report));assert.equal(r.project.actors[0].seatPropId,'b');assert.ok(r.project.cameras[0].keys.length>1);
});
test('unresolved core, missing endpoint, overlap and invalid references remain blocking',()=>{
 for(const f of [fixture({actions:[action('move')]}),fixture({actions:[action(),action('run',{id:'over',to:[2,0,0]})]}),fixture({unresolved:[{id:'u',question:'who?',options:[],requirementIds:['r']}]}),fixture({actions:[action('walk',{actorId:'missing',to:[2,0,0]})]})])assert.equal(compile(f).report.canApply,false);
});
test('unclassified empty source is never certified',()=>{assert.equal(compile(fixture({requirements:[],actions:[],coverage:[{sourceId:'source-1',requirementIds:[],status:'unclassified'}]})).report.canApply,false);});
test('reach and handoff use a reaching pose rather than waving',()=>{for(const kind of ['reach','handoff']){const r=compile(fixture({actions:[action(kind)]}));assert.equal(r.report.canApply,true);const clip=r.project.actors[0].clips[0];assert.equal(clip.action,'pose');assert.ok(POSES.some(p=>p.id===clip.poseId));}});
test('overview frames far vertical trajectory and gross collisions remain blocked',()=>{
 const far=compile(fixture({entities:[entity('a','actor',null,[80,40,0])],actions:[action('descend',{to:[80,30,0]})]}));assert.equal(far.report.canApply,true);assert.ok(far.project.cameras[0].target[0]>75);assert.ok(far.project.cameras[0].target[1]>30);
 const same=compile(fixture({entities:[entity(),entity('b','actor',null,[0,0,0])]}));assert.equal(same.report.canApply,false);
});
test('arrival around constraint rejects a contradictory pinned endpoint',()=>{const f=fixture({entities:[entity('a','actor',null,[0,0,0]),entity('b','actor',null,[20,0,0])],requirements:[req(),req('around','relation')],actions:[action('run',{to:[0,0,2]})],relations:[relation('around',{requirementIds:['around']})],coverage:[{sourceId:'source-1',requirementIds:['r','around'],status:'interpreted'}]});assert.equal(compile(f).report.canApply,false);});
test('typed pursuit preserves both tracks and medium dolly targets moving participants',()=>{
 const f=fixture({entities:[entity(),entity('b','actor',null,[3,0,0])],requirements:[req(),req('cam','shot')],actions:[action('run',{to:[4,0,0]}),action('run',{id:'runner',actorId:'b',to:[7,0,0]})],shots:[shot({subjectIds:['a','b'],motion:'dolly',framing:'medium',requirementIds:['cam']})],coverage:[{sourceId:'source-1',requirementIds:['r','cam'],status:'interpreted'}]});
 const before=JSON.stringify(f),r=compile(f);assert.equal(r.report.canApply,true,JSON.stringify(r.report));assert.equal(JSON.stringify(f),before);assert.deepEqual(evaluateActor(r.project.actors[1],2).position,[5,0,0]);assert.equal(r.project.cameras[0].keys[1].target[0],3.5);
});
test('three actors arrive on distinct ring slots around a participant',()=>{
 const points=[[6,0,0],[0,0,6],[-6,0,0]],ends=[[2,0,0],[0,0,2],[-2,0,0]],ids=['a','b','c'];const f=fixture({entities:[...ids.map((id,i)=>entity(id,'actor',null,points[i])),entity('d','actor',null,[0,0,0])],requirements:[req(),req('ring','relation')],actions:ids.map((id,i)=>action('run',{id:'move'+i,actorId:id,to:ends[i]})),relations:ids.map((id,i)=>relation('around',{id:'ring'+i,subjectId:id,objectId:'d',requirementIds:['ring']})),coverage:[{sourceId:'source-1',requirementIds:['r','ring'],status:'interpreted'}]});const r=compile(f);assert.equal(r.report.canApply,true,JSON.stringify(r.report));for(let i=0;i<3;i++){assert.deepEqual(evaluateActor(r.project.actors[i],0).position,points[i]);assert.deepEqual(evaluateActor(r.project.actors[i],4).position,ends[i]);}
});
test('AI track validation rejects malformed optional metadata while ordinary projects have no track',()=>{const r=compile(fixture({actions:[action('walk',{to:[4,0,0]})]}));const p=copy(r.project);p.actors[0].aiTrajectory.segments[0].end=999;assert.throws(()=>validateProject(p),/AI trajectory/);function copy(v){return structuredClone(v);}});
test('inside generic volume is an open floor marker and thin solids are routed around',()=>{
 const box=entity('b','prop','box',[0,0,0]);box.dimensions={width:8,height:4,depth:8,seatHeight:null};const f=fixture({entities:[entity(),box],requirements:[req('r','relation')],actions:[],relations:[relation('inside')],coverage:[{sourceId:'source-1',requirementIds:['r'],status:'interpreted'}]});const r=compile(f);assert.equal(r.report.canApply,true,JSON.stringify(r.report));assert.equal(r.project.props[0].scale[1],.03);
 const obstacle=entity('b','prop','box',[2,0,0]);const travel=compile(fixture({entities:[entity(),obstacle],actions:[action('run',{to:[4,0,0]})]}));assert.equal(travel.report.canApply,true,JSON.stringify(travel.report));assert.ok(travel.project.actors[0].path.length>2);
});
test('required contact cannot certify a remote pinned actor and prop',()=>{
 const f=fixture({entities:[entity(),entity('b','prop','box',[10,0,0])],requirements:[req('r','relation')],actions:[],relations:[relation('contact')],coverage:[{sourceId:'source-1',requirementIds:['r'],status:'interpreted'}]});assert.equal(compile(f).report.canApply,false);
});
test('moving medium view uses evaluated reference facing and local group extent',()=>{
 const f=fixture({entities:[entity(),entity('b','actor',null,[0,0,2])],requirements:[req(),req('cam','shot')],actions:[action('run',{to:[20,0,0]}),action('run',{id:'runner',actorId:'b',to:[20,0,2]})],shots:[shot({subjectIds:['a','b'],motion:'dolly',framing:'medium',requirementIds:['cam']})],coverage:[{sourceId:'source-1',requirementIds:['r','cam'],status:'interpreted'}]});
 const r=compile(f);assert.equal(r.report.canApply,true,JSON.stringify(r.report));const camera=r.project.cameras[0],first=camera.keys[0],offset=first.position.map((v,i)=>v-first.target[i]),refYaw=evaluateActor(r.project.actors[0],0).rotation;
 assert.ok(Math.abs(Math.atan2(offset[0],offset[2])-refYaw)<1e-6);assert.ok(Math.hypot(...offset)<8,'following medium camera must not frame the entire 20 metre travel');
 f.shots[0].viewSide='unspecified';const auto=compile(f).project.cameras[0].keys[0],ray=auto.position.map((v,i)=>v-auto.target[i]),n=Math.hypot(ray[0],ray[2]),right=[ray[2]/n,0,-ray[0]/n];assert.ok(Math.abs(2*right[2])>1.5,'automatic view separates the parallel runners horizontally');
});
