import test from 'node:test';import assert from 'node:assert/strict';import {aiConnectionView,aiConnectionFailure} from '../src/2026-10-25-ai-state.mjs';
test('connected sessions cannot initiate a second connect even when provider status is unknown',()=>{for(const providerStatus of [null,{installed:true,loggedIn:true},{installed:true,loggedIn:false},{installed:false}]){const view=aiConnectionView({connected:true,providerStatus,name:'Codex'});assert.equal(view.connectDisabled,true);assert.equal(view.connectPrimary,false);assert.match(view.connectLabel,/연결됨/);assert.equal(view.disconnectDisabled,false)}});
test('connection stages and provider readiness are distinct',()=>{assert.match(aiConnectionView({starting:true,phase:'approval'}).summary,/사이트 승인/);assert.match(aiConnectionView({connected:true,providerStatus:{installed:true,loggedIn:false},name:'Codex'}).summary,/로그인 필요/);assert.match(aiConnectionView({connected:true,providerStatus:null}).summary,/상태 확인/)});
test('failure guidance identifies connector, approval and provider check without assuming installation failure',()=>{assert.match(aiConnectionFailure('connector',false),/응답/);assert.match(aiConnectionFailure('approval',false),/사이트 승인/);assert.match(aiConnectionFailure('provider',true),/연결은 유지/);assert.match(aiConnectionFailure('provider',false),/만료/)});

import {createAIClient} from '../src/2026-10-23-ai-client.mjs';
test('an expired response from an old session cannot clear a newly connected session',async()=>{
 let releaseStatus,connects=0;
 const client=createAIClient(async(url)=>{
  if(url.endsWith('/connect'))return new Response(JSON.stringify({token:'session-'+(++connects)}));
  if(url.endsWith('/status'))return new Promise(resolve=>{releaseStatus=()=>resolve(new Response(JSON.stringify({error:'expired'}),{status:401}))});
  return new Response('{}');
 });
 await client.authorize('first');const pending=client.status();
 await client.disconnect();await client.authorize('second');releaseStatus();
 await assert.rejects(pending,/expired/);assert.equal(client.connected(),true);
});
