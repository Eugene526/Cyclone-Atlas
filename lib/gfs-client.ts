import GFSWorker from '../components/gfs.worker?worker';
import {forecastStep,runDate,formatRun} from './gfs-raw.mjs';
const frames=new Map<string,any>();let latest:{run:string,until:number}|null=null;
export async function loadGFS(date:string,hour:number,level:string,signal:AbortSignal){
 if(!latest||latest.until<Date.now()){const r=await fetch('/api/wind/gfs?latest=1',{signal});const m=await r.json();if(!r.ok)throw Error(m.error);latest={run:m.run,until:Date.now()+900000}}
 let run=latest.run;const target=Date.parse(`${date}T${String(hour).padStart(2,'0')}:00Z`);
 while(+runDate(run)>target)run=formatRun(new Date(+runDate(run)-6*3600000));
 const step=forecastStep(run,date,hour),key=[run,step,level].join('|');let result=frames.get(key);
 if(!result){
 const r=await fetch('/api/wind/gfs?'+new URLSearchParams({run,step:String(step),level}),{signal});if(!r.ok)throw Error((await r.json()).error);
 const bytes=await r.arrayBuffer();if(signal.aborted)throw Error('讀取已取消');
 result=await new Promise<any>((resolve,reject)=>{const worker=new GFSWorker();const cleanup=()=>{worker.terminate();signal.removeEventListener('abort',abort)};const abort=()=>{cleanup();reject(Error('讀取已取消'))};signal.addEventListener('abort',abort,{once:true});worker.onerror=()=>{cleanup();reject(Error('原始 GRIB 解碼失敗'))};worker.onmessage=e=>{cleanup();e.data.error?reject(Error(e.data.error)):resolve(e.data.result)};worker.postMessage({bytes,level,run,step},[bytes]);});
 frames.set(key,result);if(frames.size>6)frames.delete(frames.keys().next().value!);
 }
 const validTime=new Date(+runDate(run)+step*3600000).toISOString();
 const dayFrames=Array.from({length:24},(_,h)=>({time:`${date}T${String(h).padStart(2,'0')}:00:00Z`,u:null,v:null}));dayFrames[hour]={time:validTime,u:result.u,v:result.v};
 return {grid:result.grid,frames:dayFrames,model:'GFS',modelId:'gfs',kind:'forecast',level,date,run:runDate(run).toISOString(),step,source:'https://registry.opendata.aws/noaa-gfs-bdp-pds/',sourceName:'NOAA 原始 GRIB2 · 公開資料',nativeResolution:'0.25°',raw:true,checkedAt:new Date().toISOString(),validFraction:result.validFraction};
}
