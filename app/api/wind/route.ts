import {WIND_MODELS,WIND_LEVELS,makeGrid,normalizeLon,windUV,timeLimits} from '@/lib/wind-data.mjs';
const memory=new Map<string,{expires:number,data:any}>();
const pending=new Map<string,Promise<any>>();
export async function GET(req:Request){
 const q=new URL(req.url).searchParams,kind=q.get('kind')||'forecast',id=q.get('model')||'gfs',level=q.get('level')||'10m',date=q.get('date')||new Date().toISOString().slice(0,10);
 const model=WIND_MODELS.find(m=>m.id===id),height=WIND_LEVELS.find(l=>l.id===level);
 if(!['forecast','history'].includes(kind)||!height||!model?.api)return Response.json({error:'此模式尚未接入全球風場，未使用其他模式代替。'},{status:400});
 if(kind==='history'&&!height.surface)return Response.json({error:'免費 ERA5 接口只提供 10m／100m；高空再分析尚未接入。'},{status:422});
 if(kind==='forecast'&&level==='100m'&&model.no100)return Response.json({error:'此模式的免費來源未提供 100m 風。'},{status:422});
 if(kind==='forecast'&&model.surfaceOnly&&!height.surface)return Response.json({error:'此系集來源目前只驗證近地面風。'},{status:422});
 const limits=timeLimits(kind,model);
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||date<limits.min||date>limits.max)return Response.json({error:`可用日期為 ${limits.min} 至 ${limits.max}（UTC）；ERA5 延遲約 5–6 天。`},{status:400});
 let grid:any;try{grid=makeGrid((q.get('bbox')||'95,-5,180,55').split(',').map(Number))}catch(e){return Response.json({error:String(e)},{status:400})}
 const key=[kind,kind==='history'?'era5':id,level,date,...[grid.west,grid.south,grid.east,grid.north]].join('|');
 const cached=memory.get(key);if(cached&&cached.expires>Date.now())return Response.json(cached.data,{headers:{'Cache-Control':'public,max-age=600'}});
 try{
  if(!pending.has(key))pending.set(key,(async()=>{
   const speed=`wind_speed_${level}`,direction=`wind_direction_${level}`;
   const base=kind==='history'?'https://archive-api.open-meteo.com/v1/archive':model.ensemble?'https://ensemble-api.open-meteo.com/v1/ensemble':'https://api.open-meteo.com/v1/forecast';
   const params=new URLSearchParams({latitude:grid.points.map((p:number[])=>p[1].toFixed(4)).join(','),longitude:grid.points.map((p:number[])=>normalizeLon(p[0]).toFixed(4)).join(','),hourly:[speed,direction,...(!height.surface?['surface_pressure']:[])].join(','),models:kind==='history'?'era5':model.api!,wind_speed_unit:'ms',timezone:'UTC',start_date:date,end_date:date,cell_selection:'nearest'});
   const response=await fetch(base+'?'+params,{signal:AbortSignal.timeout(55000)});
   const payload:any=await response.json();
   if(!response.ok)throw Error(response.status===429?'免費資料源達到用量限制，請稍後再試。':payload.reason||`來源回覆 ${response.status}`);
   const records=Array.isArray(payload)?payload:[payload];
   if(records.length!==grid.points.length)throw Error('來源格點數量不符，影像未生成。');
   const times=records[0].hourly?.time||[];if(!times.length)throw Error('來源未提供此日期。');
   const frames=times.map((t:string,h:number)=>({time:t+'Z',u:records.map(()=>null),v:records.map(()=>null)}));
   let valid=0;
   records.forEach((r:any,k:number)=>{
    if(r.hourly_units?.[speed]!=='m/s')return;
    frames.forEach((frame:any,h:number)=>{
     if(r.hourly?.time?.[h]!==times[h])return;
     const s=r.hourly?.[speed]?.[h],d=r.hourly?.[direction]?.[h],sp=r.hourly?.surface_pressure?.[h];
     if(!height.surface&&(!Number.isFinite(sp)||parseInt(level)>sp))return; // below-terrain pressure surfaces are masked
     const uv=windUV(s,d);if(uv){frame.u[k]=Math.round(uv[0]*100)/100;frame.v[k]=Math.round(uv[1]*100)/100;valid++}
    });
   });
   if(!valid)throw Error('此模式／高度／日期沒有有效風場資料；未以其他模式或零風替代。');
   const {points,...meta}=grid;
   const data={grid:meta,frames,model:kind==='history'?'ERA5 再分析':model.name,modelId:kind==='history'?'era5':id,level,kind,date,source:base,checkedAt:new Date().toISOString(),nativeResolution:kind==='history'?'0.25°':model.native,interpolation:'顯示格點雙線性向量插值；非新增模式解析度',validFraction:valid/(records.length*frames.length)};
   memory.set(key,{expires:Date.now()+(kind==='history'?86400000:1800000),data});if(memory.size>20)memory.delete(memory.keys().next().value!);return data;
  })());
  const data=await pending.get(key);return Response.json(data,{headers:{'Cache-Control':`public,max-age=${kind==='history'?86400:600}`}});
 }catch(e){return Response.json({error:e instanceof Error?e.message:'風場讀取失敗'},{status:502})}finally{pending.delete(key)}
}
