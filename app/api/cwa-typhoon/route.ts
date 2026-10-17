import { normalizeCyclones, normalizeWarning, forecastImpacts } from '@/lib/cwa-typhoon.mjs';
import counties from '@/public/data/taiwan-counties.json';
import seaZone from '@/public/data/taiwan-sea-zone.json';
import {probabilityEnvelope,seaWindOverlap} from '@/lib/cwa-geometries.mjs';
export const maxDuration = 60;
let cache: {until:number,data:any}|null=null;
let pending:Promise<any>|null=null;
async function source(url:string){const r=await fetch(url,{signal:AbortSignal.timeout(18000),cache:'no-store'});if(!r.ok)throw Error(`來源回覆 ${r.status}`);return r;}
async function load(){
 if(cache&&cache.until>Date.now()&&(!cache.data.warning.active||Date.parse(cache.data.warning.expires)>Date.now()))return cache.data;
 if(pending)return pending;
 pending=(async()=>{
 const key=process.env.CWA_API_KEY;if(!key)throw Error('CWA 資料服務尚未設定');
 const q=new URLSearchParams({Authorization:key});
 const results=await Promise.allSettled([
 source(`https://opendata.cwa.gov.tw/api/v1/rest/datastore/W-C0034-001?${q}`).then(r=>r.json()).then(d=>normalizeWarning(d)),
 source(`https://opendata.cwa.gov.tw/fileapi/v1/opendataapi/W-C0034-005?${q}&downloadType=WEB&format=JSON`).then(r=>r.json()).then(normalizeCyclones)
 ]);
 const warning=results[0].status==='fulfilled'?results[0].value:{state:'unknown',active:false,headline:'警報資料暫時未取得，請查官方最新資訊',sections:[],polygons:[],officialCounties:[]};
 const cyclone=results[1].status==='fulfilled'?results[1].value:null;
 const fresh=!!cyclone&&(!cyclone.storms.length||cyclone.storms.every((s:any)=>Date.now()-Date.parse(s.current.time)<18*3600000));
 let chartAvailable=false;
 if(warning.active){try{const text=await(await source('https://www.cwa.gov.tw/Data/js/typhoon/TY_WARN-Data.js')).text();const stamp=text.match(/var File_Time\s*=\s*['"](\d{12})['"]/)?.[1];
 if(stamp){const t=Date.parse(`${stamp.slice(0,4)}-${stamp.slice(4,6)}-${stamp.slice(6,8)}T${stamp.slice(8,10)}:${stamp.slice(10,12)}:00Z`);chartAvailable=Math.abs(t-Date.parse(warning.issuedAt || ""))<6*3600000;}}catch{}}
 const data={warning:{...warning,chartAvailable,imageUrl:chartAvailable?'/api/cwa-typhoon?image=1':null},storms:cyclone?.storms||[],trackStatus:!cyclone?'unavailable':fresh?'ready':'stale',issuedAt:cyclone?.issuedAt||null,checkedAt:new Date().toISOString(),impacts:cyclone&&fresh?forecastImpacts(cyclone.storms,counties):{items:[],checked:0,missing:0,method:'CWA 路徑資料未取得或已過期，暫不估算'},probabilityEnvelopes:cyclone&&fresh?cyclone.storms.map(probabilityEnvelope).filter(Boolean):[],seaWindOverlap:cyclone&&fresh?seaWindOverlap(cyclone.storms,seaZone):{type:'FeatureCollection',features:[]},sources:{warning:'https://opendata.cwa.gov.tw/dataset/warning/W-C0034-001',track:'https://opendata.cwa.gov.tw/dataset/warning/W-C0034-005'}};
 cache={until:Date.now()+180000,data};return data;
 })();try{return await pending}finally{pending=null}
}
export async function GET(req:Request){try{const data=await load();if(new URL(req.url).searchParams.has('image')){if(!data.warning.active||!data.warning.chartAvailable)return Response.json({error:'目前沒有已核對時間的有效警報圖'},{status:404});const r=await source('https://www.cwa.gov.tw/Data/typhoon/TY_WARN/B20.png');if(!r.headers.get('content-type')?.startsWith('image/'))throw Error('警報圖尚未取得');return new Response(await r.arrayBuffer(),{headers:{'Content-Type':r.headers.get('content-type')!,'Cache-Control':'public, max-age=60'}})}return Response.json(data,{headers:{'Cache-Control':'public, max-age=60'}})}catch{return Response.json({error:'CWA 資料暫時未取得，請稍後重試',checkedAt:new Date().toISOString()},{status:502,headers:{'Cache-Control':'no-store'}})}}
