import test from 'node:test';import assert from 'node:assert/strict';
import {windUV,makeGrid,sampleWind,normalizeLon,timeLimits,windColor,WIND_MODELS} from '../lib/wind-data.mjs';
test('meteorological wind direction gives correct vector',()=>{assert.deepEqual(windUV(10,0),[-0,-10]);const east=windUV(10,90);assert.ok(Math.abs(east[0]+10)<1e-8);assert.ok(Math.abs(east[1])<1e-8);assert.equal(windUV(null,0),null);assert.equal(windUV(-1,0),null);});
test('interpolate compass wrap through vector components',()=>{const grid=makeGrid([0,0,1,1],2,2),a=windUV(10,359),b=windUV(10,1),frame={u:[a[0],b[0],a[0],b[0]],v:[a[1],b[1],a[1],b[1]]};const v=sampleWind(grid,frame,.5,.5);assert.ok(v.direction<1||v.direction>359);assert.ok(v.speed>9.99);});
test('missing samples never turn into calm wind',()=>{const grid=makeGrid([0,0,1,1],2,2);assert.equal(sampleWind(grid,{u:[0,null,0,0],v:[0,0,0,0]},.5,.5),null);assert.equal(sampleWind(grid,{u:[1,1,1,1],v:[1,1,1,1]},2,.5),null);});
test('date line interpolation uses a continuous longitude grid',()=>{const grid=makeGrid([170,-10,190,10],2,2);const v=sampleWind(grid,{u:[3,3,3,3],v:[4,4,4,4]},-175,0);assert.equal(v.speed,5);assert.equal(normalizeLon(185),-175);});
test('grid validation and sample budget',()=>{assert.equal(makeGrid([-180,-85,180,85]).points.length,240);assert.throws(()=>makeGrid([0,-90,180,85]));assert.throws(()=>makeGrid([-180,-80,181,80]));});
test('reanalysis and forecast dates never overlap or forecast three months ahead',()=>{assert.deepEqual(timeLimits('history',null,new Date('2026-10-04T12:00Z')),{min:'2026-07-04',max:'2026-09-28'});assert.equal(timeLimits('forecast',WIND_MODELS[0],new Date('2026-10-04T12:00Z')).max,'2026-10-19');});
test('wind palette clamps to physical display scale',()=>{assert.deepEqual(windColor(-10),windColor(0));assert.deepEqual(windColor(100),windColor(75));});

test('three-calendar-month window clamps month end',()=>{assert.equal(timeLimits('history',null,new Date('2026-05-31T00:00Z')).min,'2026-02-28')});
test('every selectable forecast uses a verified first-party raw pipeline',()=>{
 const selectable=WIND_MODELS.filter(m=>m.api);
 assert.ok(selectable.length>0);
 assert.ok(selectable.every(m=>m.raw===true),selectable.filter(m=>m.raw!==true).map(m=>m.id).join(','));
 assert.ok(WIND_MODELS.filter(m=>!m.api).every(m=>m.reason));
});
