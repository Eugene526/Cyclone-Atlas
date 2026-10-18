import {upstream} from '@/lib/upstream';

type Reading={station:string;county:string;town:string;time:string;value:number};
const num=(value:unknown)=>{const n=Number(value);return Number.isFinite(n)&&n>=0&&n<900?n:null};
const top=(items:Reading[],limit=5)=>items.sort((a,b)=>b.value-a.value).slice(0,limit);
let cache:{until:number;value:unknown}|null=null;
let pending:Promise<unknown>|null=null;

async function load(){
 if(cache&&cache.until>Date.now())return cache.value;
 if(pending)return pending;
 pending=(async()=>{
  const key=process.env.CWA_API_KEY;
  if(!key)throw Error('CWA key missing');
  const ids=['O-A0001-001','O-A0002-001'];
  const results=await Promise.allSettled(ids.map(async id=>{
   const response=await upstream(`https://opendata.cwa.gov.tw/api/v1/rest/datastore/${id}?Authorization=${encodeURIComponent(key)}&format=JSON`);
   if(!response.ok)throw Error(`${id}: ${response.status}`);
   const body:any=await response.json();
   if(!Array.isArray(body.records?.Station))throw Error(`${id}: invalid payload`);
   return body.records.Station as any[];
  }));
  const now=Date.now();
  const reading=(station:any,value:unknown):Reading|null=>{
   const n=num(value),time=String(station.ObsTime?.DateTime||'');
   if(n===null||!Number.isFinite(Date.parse(time))||now-Date.parse(time)>3*3600000)return null;
   const geo=station.GeoInfo||{};
   return {station:String(station.StationName||''),county:String(geo.CountyName||''),town:String(geo.TownName||''),time,value:n};
  };
  const weather=results[0].status==='fulfilled'?results[0].value:[];
  const rain=results[1].status==='fulfilled'?results[1].value:[];
  const collect=(stations:any[],get:(s:any)=>unknown)=>top(stations.map(s=>reading(s,get(s))).filter((r):r is Reading=>r!==null));
  const value={
   checkedAt:new Date(now).toISOString(),
   sources:ids.map((id,i)=>({id,status:results[i].status==='fulfilled'?'ready':'unavailable'})),
   temperature:collect(weather,s=>s.WeatherElement?.AirTemperature),
   gust:collect(weather,s=>s.WeatherElement?.GustInfo?.PeakGustSpeed),
   rain1h:collect(rain,s=>s.RainfallElement?.Past1hr?.Precipitation),
   rain24h:collect(rain,s=>s.RainfallElement?.Past24hr?.Precipitation),
  };
  cache={until:now+300000,value};return value;
 })();
 try{return await pending}finally{pending=null}
}
export async function GET(){try{return Response.json(await load(),{headers:{'Cache-Control':'public,max-age=60,s-maxage=300'}})}catch{return Response.json({error:'觀測資料暫時未取得'},{status:502})}}
