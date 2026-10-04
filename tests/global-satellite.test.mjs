import test from 'node:test';
import assert from 'node:assert/strict';
import {globalFrame,globalTileURL} from '../lib/global-satellite.mjs';
test('three-hour frame never substitutes a later observation',()=>{
 assert.equal(globalFrame('2026-10-04T07:40:00Z'),'2026-10-04T06:00:00.000Z');
 assert.equal(globalFrame('2026-10-04T00:00:00Z'),'2026-10-04T00:00:00.000Z');
 assert.throws(()=>globalFrame('invalid'));
});
test('geographic mosaic tiles meet at the date line without stretching',()=>{
 const first=new URL(globalTileURL('2026-10-04T06:00Z',2,0,0));
 const last=new URL(globalTileURL('2026-10-04T06:00Z',2,3,0));
 assert.equal(first.searchParams.get('bbox'),'-180,0,-90,90');
 assert.equal(last.searchParams.get('bbox'),'90,0,180,90');
 assert.equal(first.searchParams.get('srs'),'EPSG:4326');
 assert.throws(()=>globalTileURL('2026-10-04T06:00Z',2,4,0));
 assert.throws(()=>globalTileURL('2026-10-04T06:00Z',2,0,2));
});
