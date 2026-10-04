import {edgeCache} from '@/lib/edge-cache.mjs';
import {bloscPlan,assembleBlosc} from '@/lib/blosc-slice.mjs';
import {WIND_LEVELS,timeLimits} from '@/lib/wind-data.mjs';
const ROOT='https://storage.googleapis.com/gcp-public-data-arco-era5/ar/full_37-1h-0p25deg-chunk-1.zarr-v3/';
const LEVELS=[1,2,3,5,7,10,20,30,50,70,100,125,150,175,200,225,250,300,350,400,450,500,550,600,650,700,750,775,800,825,850,875,900,925,950,975,1000];
async function range(url:string,start:number,end:number){const r=await fetch(url,{headers:{Range:`bytes=${start}-${end}`},signal:AbortSignal.timeout(50000)});if(r.status!==206||!r.headers.get('content-range')?.startsWith(`bytes ${start}-${end}/`))throw Error('ERA5 來源位元組範圍未符合要求');return new Uint8Array(await r.arrayBuffer())}
async function slice(url:string,start:number,length:number){const h=await range(url,0,15),p=bloscPlan(h,start,length);
 if(p.flags&2){const b=await range(url,16+start,16+start+length-1),out=new Uint8Array(16+length);out.set(h);out.set(b,16);const d=new DataView(out.buffer);d.setUint32(4,length,true);d.setUint32(12,out.length,true);return {bytes:out,skip:0,length}}
 const table=await range(url,16,16+4*p.count-1),view=new DataView(table.buffer,table.byteOffset,table.byteLength),offsets=Array.from({length:p.count},(_,i)=>view.getUint32(i*4,true)),sorted=[...offsets,p.cbytes].sort((a,b)=>a-b);
 const ranges=Array.from({length:p.last-p.first+1},(_,k)=>{const i=p.first+k,from=offsets[i],to=sorted[sorted.indexOf(from)+1]-1;if(from<16+4*p.count||to<from||to-from>2000000)throw Error('ERA5 壓縮區塊索引不符');return {i,from,to}}).sort((a,b)=>a.from-b.from);
 const groups:any[]=[];for(const r of ranges){const g=groups.at(-1);if(g&&r.from-g.to<=131072&&r.to-g.from<8000000){g.to=r.to;g.items.push(r)}else groups.push({from:r.from,to:r.to,items:[r]})}
 const blocks:any[]=[];for(const g of groups){const data=await range(url,g.from,g.to);for(const r of g.items)blocks[r.i-p.first]=data.subarray(r.from-g.from,r.to-g.from+1)}
 return assembleBlosc(h,offsets,blocks,p);
}
const cache=new Map<string,ArrayBuffer>();
export async function GET(req:Request){try{const q=new URL(req.url).searchParams,date=q.get('date')||'',hour=Number(q.get('hour')),level=q.get('level')||'10m',limits=timeLimits('history',null);if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||date<limits.min||date>limits.max||!q.has('hour')||!Number.isFinite(Date.parse(date+'T00:00Z'))||new Date(date+'T00:00Z').toISOString().slice(0,10)!==date||!Number.isInteger(hour)||hour<0||hour>23||!WIND_LEVELS.some(l=>l.id===level))return Response.json({error:'ERA5 日期／高度不符可用範圍'},{status:400});
 const key=[date,hour,level].join('|'),edge=edgeCache,edgeKey=new Request(new URL('/api/wind/era5?'+new URLSearchParams({date,hour:String(hour),level}),req.url)),edgeHit=await edge?.match(edgeKey);if(edgeHit)return edgeHit;const hit=cache.get(key);if(hit)return new Response(hit.slice(0),{headers:{'Content-Type':'application/octet-stream','Cache-Control':'public,max-age=86400'}});
 const t=(Date.parse(date+'T00:00Z')-Date.parse('1900-01-01T00:00Z'))/3600000+hour,cells=721*1440,bytes=cells*4,high=level.endsWith('hPa'),index=high?LEVELS.indexOf(parseInt(level)):0;if(index<0)throw Error('ERA5 原始壓力層不存在');
 const names=high?['u_component_of_wind','v_component_of_wind','surface_pressure']:[`${parseInt(level)}m_u_component_of_wind`,`${parseInt(level)}m_v_component_of_wind`];
 const pieces=[];for(const name of names){const pressure=high&&name!=='surface_pressure',r=await slice(`${ROOT}${name}/${t}.`+(pressure?'0.0.0':'0.0'),pressure?index*bytes:0,bytes);pieces.push(r)}
 const metadata={date,hour,level,cells,parts:pieces.map(p=>({size:p.bytes.length,skip:p.skip,length:p.length})),grid:{west:0,east:360,south:-90,north:90,cols:1441,rows:721,lonStep:.25,latStep:.25}};
 const json=new TextEncoder().encode(JSON.stringify(metadata)),out=new Uint8Array(4+json.length+pieces.reduce((n,p)=>n+p.bytes.length,0));new DataView(out.buffer).setUint32(0,json.length,true);out.set(json,4);let cursor=4+json.length;for(const p of pieces){out.set(p.bytes,cursor);cursor+=p.bytes.length}if(edge)await edge.put(edgeKey,new Response(out.slice(),{headers:{'Content-Type':'application/octet-stream','Cache-Control':'public,max-age=86400'}}));cache.set(key,out.buffer);if(cache.size>6)cache.delete(cache.keys().next().value!);return new Response(out,{headers:{'Content-Type':'application/octet-stream','Cache-Control':'public,max-age=86400'}});
 }catch(e){return Response.json({error:e instanceof Error?e.message:'ERA5 原始資料讀取失敗'},{status:502})}}
