import { globalTileURL, GLOBAL_START, globalFrame } from '@/lib/global-satellite.mjs';
import { upstream, failed } from '@/lib/upstream';
export async function GET(request:Request) {
 try {
  const q=new URL(request.url).searchParams, time=q.get('time') || '';
  if(Date.parse(globalFrame(time))<Date.parse(GLOBAL_START) || Date.parse(time)>Date.now()+3600000) return Response.json({error:'時間不在資料範圍'},{status:400});
  const url=globalTileURL(time,Number(q.get('z')),Number(q.get('x')),Number(q.get('y')),q.get('mode')==='rgb');
  const r=await fetch(url,{signal:AbortSignal.timeout(45000)});
  if(!r.ok) throw Error(`衛星來源回覆 ${r.status}`);
  if(!r.headers.get('content-type')?.includes('image/')) throw Error('此時刻影像未提供');
  return new Response(r.body,{headers:{'Content-Type':'image/png','Cache-Control':'public, max-age=86400','X-Observation-UTC':globalFrame(time),'X-Imagery-Source':'EUMETSAT multimission composite'}});
 }catch(e){return failed(e)}
}
