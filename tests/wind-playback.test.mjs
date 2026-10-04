import test from 'node:test';import assert from 'node:assert/strict';import {nextPlaybackTime} from '../lib/wind-playback.mjs';
const next=(d,h,s,e)=>nextPlaybackTime(d,h,s,e,'2026-10-01','2026-10-10');
test('cross midnight without escaping chosen range',()=>assert.deepEqual(next('2026-10-03',23,'2026-10-03T22:00','2026-10-04T02:00'),{date:'2026-10-04',hour:0}));
test('end loops to start',()=>assert.deepEqual(next('2026-10-04',2,'2026-10-03T22:00','2026-10-04T02:00'),{date:'2026-10-03',hour:22}));
test('outside starts at selected start',()=>assert.deepEqual(next('2026-10-03',1,'2026-10-03T22:00','2026-10-04T02:00'),{date:'2026-10-03',hour:22}));
test('invalid range blocked',()=>assert.equal(next('2026-10-03',1,'2026-10-04T22:00','2026-10-03T02:00'),null));
