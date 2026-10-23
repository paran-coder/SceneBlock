import test from 'node:test';
import assert from 'node:assert/strict';
import {nextActorColor,nextActorName} from '../src/2026-10-23-actors.mjs';
test('new actors receive distinct valid colors even after palette is exhausted',()=>{
 const actors=[{color:'#b8c3d7'},{color:'#c4ad99'}];for(let i=0;i<40;i++){const color=nextActorColor(actors);assert.match(color,/^#[a-f0-9]{6}$/i);assert.ok(!actors.some(a=>a.color.toLowerCase()===color.toLowerCase()));actors.push({color});}
});
test('default names advance naturally and skip existing names without renaming them',()=>{
 const actors=[{name:'인물 A'},{name:'인물 B'}];assert.equal(nextActorName(actors),'인물 C');actors.push({name:'인물 D'});assert.equal(nextActorName(actors),'인물 E');assert.equal(actors[2].name,'인물 D');
 assert.equal(nextActorName(Array.from({length:26},(_,i)=>({name:`인물 ${String.fromCharCode(65+i)}`}))),'인물 AA');
});
