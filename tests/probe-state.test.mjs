import test from 'node:test';import assert from 'node:assert/strict';import {alphaTemperature,acceptThermal} from '../lib/probe-state.mjs';
test('encoding endpoints are 50 and -90 Celsius',()=>{assert.equal(alphaTemperature(0),50);assert.equal(alphaTemperature(255),-90)});
test('closed popup does not reopen on completed download',()=>assert.equal(acceptThermal(null,{loading:false,time:'a',lon:1,lat:2}),null));
test('stale point does not replace newly clicked point',()=>{const current={time:'b',lon:1,lat:2};assert.equal(acceptThermal(current,{time:'a',lon:1,lat:2}),current)});
