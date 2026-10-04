import test from 'node:test';
import assert from 'node:assert/strict';
import {ecmwfPath,ecmwfRanges} from '../lib/raw-sources.mjs';
import {bloscPlan,assembleBlosc} from '../lib/blosc-slice.mjs';
test('ECMWF fixed origin and native cadence',()=>{
 assert.match(ecmwfPath('ecmwf','2026100400',3),/^https:\/\/storage.googleapis.com\/ecmwf-open-data\//);
 for(const args of [['bad','2026100400',0],['ecmwf','2026100400',1],['aifs-single','2026100400',3],['ecmwf','../../',0]])assert.throws(()=>ecmwfPath(...args));
});
test('pressure fields include surface-pressure mask and exact level',()=>{
 const records=[{param:'u',levelist:'500',_offset:0,_length:20},{param:'u',levelist:'850',_offset:20,_length:20},{param:'v',levelist:'850',_offset:40,_length:20},{param:'sp',_offset:60,_length:20}].map(JSON.stringify).join('\n');
 assert.deepEqual(ecmwfRanges(records,'850hPa'),[{start:20,end:39},{start:40,end:59},{start:60,end:79}]);
 assert.throws(()=>ecmwfRanges(records,'100m'));
});
test('Blosc level slice retains complete boundary blocks',()=>{
 const h=new Uint8Array(16),d=new DataView(h.buffer);h[0]=2;d.setUint32(4,40,true);d.setUint32(8,16,true);d.setUint32(12,80,true);
 const plan=bloscPlan(h,18,20);assert.equal(plan.first,1);assert.equal(plan.last,2);
 const r=assembleBlosc(h,[],[new Uint8Array([1,2]),new Uint8Array([3,4,5])],plan),out=new DataView(r.bytes.buffer);
 assert.equal(r.skip,2);assert.equal(r.length,20);assert.equal(out.getUint32(4,true),24);assert.equal(out.getUint32(12,true),29);assert.equal(out.getUint32(16,true),24);assert.equal(out.getUint32(20,true),26);
 assert.throws(()=>bloscPlan(h,39,2));
});
import {iconURL,gefsPath} from '../lib/raw-sources.mjs';
test('ICON and GEFS strictly preserve their own origins and native intervals',()=>{
 assert.match(iconURL('2026100400',9,'u','850hPa'),/\/u\/icon_global_icosahedral_pressure-level_2026100400_009_850_U.grib2.bz2$/);
 assert.match(iconURL('2026100400',9,'p','850hPa'),/\/ps\/.*_PS.grib2.bz2$/);
 assert.throws(()=>iconURL('2026100400',80,'u','10m'));assert.throws(()=>iconURL('2026100400',3,'u','100m'));
 assert.match(gefsPath('2026100400',246),/noaa-gefs-pds.*geavg.*f246$/);
 assert.throws(()=>gefsPath('2026100400',243));
});
import {gepsURL,aigefsPath} from '../lib/raw-sources.mjs';
test('GEPS uses all members and AIGEFS uses original averages',()=>{
 assert.match(gepsURL('2026100400',9,'u','850hPa'),/UGRD_ISBL_0850.*P009_allmbrs.grib2$/);
 assert.match(gepsURL('2026100400',9,'p','850hPa'),/PRES_SFC_0/);
 assert.throws(()=>gepsURL('2026100406',9,'u','10m'));assert.throws(()=>gepsURL('2026100400',195,'u','10m'));
 assert.match(aigefsPath('2026100400',12),/sfc.avg.f012.grib2$/);assert.throws(()=>aigefsPath('2026100400',3));
});
