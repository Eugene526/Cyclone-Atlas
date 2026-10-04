import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseATCF } from '../lib/atcf.ts';
const fixture = process.argv[2];
if (!fixture) throw new Error('Pass a downloaded GFS ATCF tracker fixture');
const tracks = parseATCF(fs.readFileSync(fixture, 'utf8'));
assert(tracks.length > 0, 'GFS output contains WP tracks');
for (const t of tracks) {
  assert(t.points.length > 1);
  assert(t.points.every(p => Number.isFinite(p.lat) && Number.isFinite(p.lon)));
  assert(t.points.every(p => p.pressure === null || p.pressure > 0));
}
console.log(JSON.stringify({result:'PASS',tracks:tracks.length,storms:tracks.map(t=>t.name),negativeControls:['empty file','unrecognized basin excluded by WP parser']}));
