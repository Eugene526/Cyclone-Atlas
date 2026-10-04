import {edgeCache} from '@/lib/edge-cache.mjs';
import {gfsUrl,windRanges,formatRun,runDate} from '@/lib/gfs-raw.mjs';
import {WIND_LEVELS} from '@/lib/wind-data.mjs';
const memory=new Map<string,{until:number,body:ArrayBuffer,type:string}>();
const pending=new Map<string,Promise<{body:ArrayBuffer,type:string}>>();
async function cached(url:string,range?:string){
 const key=url+'|'+(range||''),hit=memory.get(key);if(hit&&hit.until>Date.now())return new Response(hit.body.slice(0),{headers:{'Content-Type':hit.type,'Cache-Control':'public,max-age=86400'}});
 // Cache immutable run/field bytes at the edge, shared by all viewers.
 const cache=edgeCache;
 const cacheKey=new Request(url+(range?'?fieldrange='+range.replace(/[^0-9-]/g,''):''));
 const edge=await cache?.match(cacheKey);if(edge)return edge;
 if(!pending.has(key))pending.set(key,(async()=>{
 const r=await fetch(url,{headers:range?{Range:range}:{},signal:AbortSignal.timeout(45000)});
 if(!r.ok||(range&&r.status!==206))throw Error(`NOAA 來源回覆 ${r.status}`);
 if(range){const expected=range.replace('bytes=','');if(!r.headers.get('content-range')?.startsWith('bytes '+expected+'/'))throw Error('NOAA 位元組範圍不符');}
 const body=await r.arrayBuffer();if(body.byteLength>8000000)throw Error('來源欄位超出大小限制');
 const response=new Response(body,{headers:{'Content-Type':range?'application/octet-stream':'text/plain','Cache-Control':'public,max-age=86400'}});
 memory.set(key,{until:Date.now()+3600000,body,type:range?'application/octet-stream':'text/plain'});if(memory.size>12)memory.delete(memory.keys().next().value!);
 if(cache)await cache.put(cacheKey,response);return {body,type:range?'application/octet-stream':'text/plain'};
 })());
 try{const item=(await pending.get(key))!;return new Response(item.body.slice(0),{headers:{'Content-Type':item.type,'Cache-Control':'public,max-age=86400'}})}finally{pending.delete(key)}
}
let latest:{until:number,run:string}|null=null;
export async function GET(req:Request){
 try{
 const q=new URL(req.url).searchParams;
 if(q.get('latest')==='1'){
 if(!latest||latest.until<Date.now()){
 const start=new Date(Date.now()-5*3600000);start.setUTCMinutes(0,0,0);start.setUTCHours(Math.floor(start.getUTCHours()/6)*6);
 let found='';for(let i=0;i<3;i++){const run=formatRun(new Date(+start-i*6*3600000));try{await cached(gfsUrl(run,0)+'.idx');found=run;break}catch{}}
 if(!found)throw Error('NOAA 最新起報資料尚未到齊');latest={run:found,until:Date.now()+900000};
 }
 return Response.json({run:latest.run,source:'NOAA GFS 公開原始 GRIB2',resolution:'0.25°',maxStep:384,hourlyThrough:120},{headers:{'Cache-Control':'public,max-age=900'}});
 }
 const run=q.get('run')||'',step=Number(q.get('step')),level=q.get('level')||'10m';
 if(!WIND_LEVELS.some(l=>l.id===level)||!q.has('step'))return Response.json({error:'無效高度／時效'},{status:400});
 let url:string;try{url=gfsUrl(run,step)}catch{return Response.json({error:'無效 GFS 起報時間／時效'},{status:400})}
 const age=Date.now()-+runDate(run);if(age < 0||age>7*86400000)return Response.json({error:'只接受最近七天的公開 GFS 起報資料'},{status:400});
 const idx=await (await cached(url+'.idx')).text();const ranges=windRanges(idx,level),parts=await Promise.all(ranges.map(async r=>new Uint8Array(await (await cached(url,`bytes=${r.start}-${r.end}`)).arrayBuffer())));
 const out=new Uint8Array(parts.reduce((n,b)=>n+b.length,0));let offset=0;for(const b of parts){out.set(b,offset);offset+=b.length}
 return new Response(out,{headers:{'Content-Type':'application/octet-stream','Cache-Control':'public,max-age=86400','X-GFS-Run':run,'X-GFS-Step':String(step)}});
 }catch(e){return Response.json({error:e instanceof Error?e.message:'NOAA 原始風場載入失敗；未切換資料來源'},{status:502})}
}
