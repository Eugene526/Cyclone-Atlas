import test from 'node:test';import assert from 'node:assert/strict';import {nextPlaybackTime,rangeInputFromUTC,rangeInputToUTC} from '../lib/wind-playback.mjs';
const next=(d,h,s,e)=>nextPlaybackTime(d,h,s,e,'2026-10-01','2026-10-10');
test('cross midnight without escaping chosen range',()=>assert.deepEqual(next('2026-10-03',23,'2026-10-03T22:00','2026-10-04T02:00'),{date:'2026-10-04',hour:0}));
test('end loops to start',()=>assert.deepEqual(next('2026-10-04',2,'2026-10-03T22:00','2026-10-04T02:00'),{date:'2026-10-03',hour:22}));
test('outside starts at selected start',()=>assert.deepEqual(next('2026-10-03',1,'2026-10-03T22:00','2026-10-04T02:00'),{date:'2026-10-03',hour:22}));
test('invalid range blocked',()=>assert.equal(next('2026-10-03',1,'2026-10-04T22:00','2026-10-03T02:00'),null));
test('native model cadence skips duplicate forecast times',()=>assert.deepEqual(nextPlaybackTime('2026-10-03',0,'2026-10-03T00:00','2026-10-03T06:00','2026-10-01','2026-10-10',3),{date:'2026-10-03',hour:3}));
test('multi-day animation range wraps to its chosen start',()=>assert.deepEqual(nextPlaybackTime('2026-10-04',23,'2026-10-03T06:00','2026-10-04T23:00','2026-10-01','2026-10-10'),{date:'2026-10-03',hour:6}));
test('animation datetime-local fields map the selected UTC+8 zone to UTC state',()=>{
 const local=rangeInputFromUTC('2026-10-04T13:00','tw');
 assert.equal(local,'2026-10-04T21:00');
 assert.equal(rangeInputToUTC(local,'tw'),'2026-10-04T13:00');
 assert.equal(rangeInputFromUTC('2026-10-04T13:00','utc'),'2026-10-04T13:00');
});
