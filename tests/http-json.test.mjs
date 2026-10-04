import test from 'node:test';
import assert from 'node:assert/strict';
import {fetchJson,readJsonResponse} from '../lib/http-json.mjs';

test('HTML route fallback gives a readable localized error, not a JSON parser exception',async()=>{
  await assert.rejects(readJsonResponse(new Response('<!DOCTYPE html><html>Not found</html>',{status:404,headers:{'content-type':'text/html'}}),'NOAA GFS'),/NOAA GFS暫時回傳錯誤網頁（HTTP 404）/);
});

test('transient HTML edge response retries once then returns JSON',async()=>{
  let calls=0;
  const result=await fetchJson('/api/wind/gfs?latest=1',{label:'NOAA GFS',fetcher:async()=>{
    calls++;
    return calls===1
      ? new Response('<!DOCTYPE html><html>gateway</html>',{status:502,headers:{'content-type':'text/html'}})
      : Response.json({run:'2026100406'});
  }});
  assert.equal(calls,2);
  assert.equal(result.run,'2026100406');
});

test('JSON API error payload remains specific and does not retry',async()=>{
  let calls=0;
  await assert.rejects(fetchJson('/api/wind/gfs',{label:'NOAA GFS',fetcher:async()=>{calls++;return Response.json({error:'NOAA 資料尚未到齊'},{status:502})}}),/NOAA 資料尚未到齊/);
  assert.equal(calls,1);
});
