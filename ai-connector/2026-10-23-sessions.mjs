import {randomBytes} from 'node:crypto';
import {readFile,unlink} from 'node:fs/promises';
import path from 'node:path';
import {allowedOrigin} from './2026-10-23-connector.mjs';
export function parseLaunch(value){
 const u=new URL(value);if(value.length>2048||/["\r\n]/.test(value)||u.protocol!=='sceneblock:'||u.hostname!=='start'||u.username||u.password||u.port||!['','/'].includes(u.pathname)||u.hash||[...u.searchParams].length!==2)throw Error('Invalid launch URI');
 const origin=u.searchParams.get('origin'),nonce=u.searchParams.get('nonce');if(!allowedOrigin(origin)||!/^[a-f0-9]{64}$/.test(nonce))throw Error('Invalid launch parameters');return {origin,nonce};
}
export async function consumeGrant(dir,nonce,origin,now=Date.now()/1000){
 if(!/^[a-f0-9]{64}$/.test(nonce)||!allowedOrigin(origin))return false;
 const file=path.join(dir,nonce+'.json');try{const data=JSON.parse((await readFile(file,'utf8')).replace(/^\uFEFF/,''));if(data.origin!==origin||!Number.isFinite(data.created)||now<data.created-5||now-data.created>120)return false;await unlink(file);return true}catch{return false}
}
export function createLeases(clock=Date.now,ttl=30*60*1000){
 const leases=new Map();const sweep=()=>{for(const [t,s]of leases)if(s.expires<clock())leases.delete(t)};
 return {issue(origin){sweep();if(leases.size>=32)throw Error('Too many tabs');const token=randomBytes(32).toString('hex');leases.set(token,{origin,expires:clock()+ttl});return token},check(token,origin,renew=false){sweep();const s=leases.get(token);if(!s||s.origin!==origin)return false;if(renew)s.expires=clock()+ttl;return true},release(token,origin){if(this.check(token,origin))leases.delete(token)},count(){sweep();return leases.size}};
}
