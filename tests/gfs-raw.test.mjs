import test from 'node:test';import assert from 'node:assert/strict';
import {gfsUrl,windRanges,forecastStep,formatRun,runDate} from '../lib/gfs-raw.mjs';
import {sampleWind} from '../lib/wind-data.mjs';
test('fixed NOAA origin and strict forecast identifiers',()=>{assert.match(gfsUrl('2026100400',6),/gfs\.t00z\.pgrb2\.0p25\.f006$/);for(const [r,s] of [['../../',0],['2026100401',0],['2026100400',121],['2026100400',385]])assert.throws(()=>gfsUrl(r,s))});
test('indexed byte ranges never download whole GRIB files',()=>{const idx='1:0:d=x:UGRD:10 m above ground:anl:\n2:100:d=x:VGRD:10 m above ground:anl:\n3:230:d=x:TMP:2 m above ground:anl:';assert.deepEqual(windRanges(idx,'10m').map(x=>[x.start,x.end]),[[0,99],[100,229]]);assert.throws(()=>windRanges(idx,'850hPa'))});
test('native forecast cadence is not invented hourly after 120 hours',()=>{assert.equal(forecastStep('2026100400','2026-10-04',8),8);assert.equal(forecastStep('2026100400','2026-10-09',1),120);assert.equal(forecastStep('2026100400','2026-10-09',2),123);assert.equal(formatRun(runDate('2026100406')),'2026100406')});
test('unloaded raw frames are missing, not calm',()=>assert.equal(sampleWind({}, {u:null,v:null},0,0),null));
