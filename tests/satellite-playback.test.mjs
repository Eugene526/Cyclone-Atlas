import test from 'node:test';
import assert from 'node:assert/strict';
import { satelliteAnimationFrames } from '../lib/satellite-playback.mjs';

test('animation preloads every requested timestamp through the interval', () => {
  assert.deepEqual(satelliteAnimationFrames('2026-10-18T00:00:00Z','2026-10-18T01:00:00Z',20),[
    '2026-10-18T00:00:00.000Z','2026-10-18T00:20:00.000Z','2026-10-18T00:40:00.000Z','2026-10-18T01:00:00.000Z',
  ]);
});

test('invalid or reversed animation interval has no frames', () => {
  assert.deepEqual(satelliteAnimationFrames('bad','2026-10-18T01:00:00Z',20),[]);
  assert.deepEqual(satelliteAnimationFrames('2026-10-18T01:00:00Z','2026-10-18T00:00:00Z',20),[]);
});
