import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import path from 'node:path';
import {consumeGrant,createLeases,parseLaunch} from '../ai-connector/2026-10-23-sessions.mjs';
import {reorderTimeline} from '../src/2026-10-23-track-order.mjs';
import {createConnector} from '../ai-connector/2026-10-23-connector.mjs';
test('launch permits exact trusted origin and 32-byte nonce only',()=>{
 const nonce='a'.repeat(64),uri=`sceneblock://start?origin=${encodeURIComponent('https://scene-block.vercel.app')}&nonce=${nonce}`;
 assert.deepEqual(parseLaunch(uri),{origin:'https://scene-block.vercel.app',nonce});
 for(const u of [uri+'&nonce='+nonce,uri.replace('start?','evil?'),uri.replace(nonce,'bad'),uri.replace('scene-block.vercel.app','evil.test')])assert.throws(()=>parseLaunch(u));
});
test('grant is origin-bound, expires, consumed once and rejects traversal',async()=>{
 const root=path.resolve('2026-10-23-runtime');await mkdir(root,{recursive:true});const dir=await mkdtemp(path.join(root,'grants-')),nonce='a'.repeat(64),file=path.join(dir,nonce+'.json');
 try{await writeFile(file,JSON.stringify({origin:'https://scene-block.vercel.app',created:100}));assert.equal(await consumeGrant(dir,nonce,'https://evil.test',110),false);assert.equal(await consumeGrant(dir,nonce,'https://scene-block.vercel.app',110),true);assert.equal(await consumeGrant(dir,nonce,'https://scene-block.vercel.app',110),false);await writeFile(file,JSON.stringify({origin:'https://scene-block.vercel.app',created:100}));assert.equal(await consumeGrant(dir,nonce,'https://scene-block.vercel.app',300),false);assert.equal(await consumeGrant(dir,'../x','https://scene-block.vercel.app'),false)}finally{assert.equal(path.dirname(dir),root);await rm(dir,{recursive:true,force:true})}
});
test('independent leases expire, revoke and bind tokens to origin',()=>{let now=0;const s=createLeases(()=>now,50),a=s.issue('one'),b=s.issue('two');assert.ok(s.check(a,'one'));assert.equal(s.check(a,'two'),false);s.release(a,'one');assert.equal(s.check(a,'one'),false);assert.ok(s.check(b,'two'));now=51;assert.equal(s.check(b,'two'),false);assert.equal(s.count(),0)});
test('reordering actors keeps layers together and same actor layers follow visible priority',()=>{const p={actors:[{id:'a',layers:[{id:'low'},{id:'high'}]},{id:'b',layers:[]}]};reorderTimeline(p,{actor:'a'},{actor:'b'},true);assert.deepEqual(p.actors.map(a=>a.id),['b','a']);reorderTimeline(p,{actor:'a',layer:'low'},{actor:'a',layer:'high'},false);assert.deepEqual(p.actors[1].layers.map(l=>l.id),['high','low']);assert.throws(()=>reorderTimeline(p,{actor:'a',layer:'low'},{actor:'b'},false));});
test('on-demand HTTP requires local grant, prevents replay and origin reuse, independent tabs release separately',async()=>{
 const root=path.resolve('2026-10-23-runtime');await mkdir(root,{recursive:true});const dir=await mkdtemp(path.join(root,'grants-'));
 const {server}=createConnector({port:8769,grantDir:dir,installation:'test',providers:{status:async()=>({codex:{installed:true}})}});await new Promise(r=>server.listen(8769,'127.0.0.1',r));
 const origin='https://scene-block.vercel.app',send=(url,{body,token,site=origin}={})=>fetch('http://127.0.0.1:8769'+url,{method:body?'POST':'GET',headers:{Origin:site,...(body?{'Content-Type':'application/json'}:{}),...(token?{Authorization:'Bearer '+token}:{})},body:body?JSON.stringify(body):undefined});
 try{assert.equal((await fetch('http://127.0.0.1:8769/health')).status,200);assert.equal((await send('/pair',{body:{code:'123456'}})).status,404);assert.equal((await send('/connect',{body:{nonce:'a'.repeat(64)}})).status,403);
 const tokens=[];for(const n of ['a','b']){const nonce=n.repeat(64);await writeFile(path.join(dir,nonce+'.json'),JSON.stringify({origin,created:Date.now()/1000}));const response=await send('/connect',{body:{nonce}});assert.equal(response.status,200);tokens.push((await response.json()).token);assert.equal((await send('/connect',{body:{nonce}})).status,403)}
 assert.equal((await send('/status',{token:tokens[0],site:'http://127.0.0.1:8767'})).status,401);assert.equal((await send('/lease',{token:tokens[0],body:{}})).status,200);await send('/release',{token:tokens[0],body:{}});assert.equal((await send('/status',{token:tokens[0]})).status,401);assert.equal((await send('/status',{token:tokens[1]})).status,200);
 }finally{server.closeAllConnections();await new Promise(r=>server.close(r));assert.equal(path.dirname(dir),root);await rm(dir,{recursive:true,force:true})}
});
test('unused on-demand connector closes itself without a resident service',async()=>{
 let done;const stopped=new Promise(r=>done=r);const {server}=createConnector({port:8770,grantDir:'unused',idleMs:1,onIdle:done,providers:{}});await new Promise(r=>server.listen(8770,'127.0.0.1',r));
 try{await Promise.race([stopped,new Promise((_,reject)=>setTimeout(()=>reject(Error('idle exit timeout')),2500).unref())]);assert.equal(server.listening,false)}finally{if(server.listening)await new Promise(r=>server.close(r))}
});
