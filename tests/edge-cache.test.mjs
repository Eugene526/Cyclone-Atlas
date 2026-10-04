import test from 'node:test';
import assert from 'node:assert/strict';
import {bestEffortCache} from '../lib/edge-cache.mjs';
test('forbidden default-cache getter never blocks source reads',async()=>{
 let attempts=0;const cache=bestEffortCache(()=>{attempts++;throw Error('This Worker is not permitted to access the default cache.')});
 assert.equal(await cache.match('field'),undefined);await cache.put('field',new Response('valid original data'));
 assert.equal(attempts,1);
 const source=await (async()=>await cache.match('field')||new Response('valid original data'))();assert.equal(await source.text(),'valid original data');
});
test('cache match rejection is non-fatal and disables further cache use',async()=>{
 let puts=0;const cache=bestEffortCache(()=>({match:async()=>{throw Error('not permitted')},put:async()=>puts++}));
 assert.equal(await cache.match('field'),undefined);await cache.put('field',new Response('ok'));assert.equal(puts,0);
});
test('cache write rejection never discards successfully fetched bytes',async()=>{
 const cache=bestEffortCache(()=>({match:async()=>undefined,put:async()=>{throw Error('quota or cache unavailable')}}));
 const bytes=new Uint8Array([71,82,73,66]);await cache.put('field',new Response(bytes));assert.deepEqual(bytes,new Uint8Array([71,82,73,66]));
});
test('supported cache still serves and stores responses',async()=>{
 const entries=new Map(),cache=bestEffortCache(()=>({match:async k=>entries.get(k),put:async(k,r)=>entries.set(k,r)}));
 await cache.put('field',new Response('cached'));assert.equal(await (await cache.match('field')).text(),'cached');
});
