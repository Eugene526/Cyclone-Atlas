import test from 'node:test';import assert from 'node:assert/strict';import {jmaRange,jmaURL,jmaMessages} from '../lib/jma-raw.mjs';
test('JMA public URL and range include requested cycle',()=>{assert.match(jmaURL('2026100400'),/20261004000000/);assert.deepEqual(jmaRange(0,'10m'),{start:109,end:125520});assert.equal(jmaRange(6,'925hPa').start,7023205)});
test('unsupported levels/time are rejected',()=>{for(const [s,l] of [[3,'10m'],[138,'10m'],[0,'100m']])assert.throws(()=>jmaRange(s,l))});
test('wrong source layout is rejected',()=>assert.throws(()=>jmaMessages(new Uint8Array(109),new Uint8Array(125412),0,'10m')));
