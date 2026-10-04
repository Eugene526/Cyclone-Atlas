import {getRawFrame,putRawFrame} from './raw-frame-cache';
import {fetchJson,readJsonResponse} from './http-json.mjs';
import RawWorker from '../components/icon.worker?worker';
import {formatRun,runDate} from './gfs-raw.mjs';
const latest=new Map<string,any>();
export async function loadICON(date:string,hour:number,level:string,signal:AbortSignal){
 const id='icon';let meta=latest.get(id);if(!meta||meta.until<Date.now()){meta=await fetchJson('/api/wind/icon?'+new URLSearchParams({model:id,latest:'1'}),{signal,label:'DWD ICON'});meta.until=Date.now()+900000;latest.set(id,meta)}
 let run=meta.run;const target=Date.parse(`${date}T${String(hour).padStart(2,'0')}:00Z`);while(+runDate(run)>target)run=formatRun(new Date(+runDate(run)-12*3600000));const raw=(target-+runDate(run))/3600000,step=raw>78?Math.round(raw/3)*3:raw;if(step>meta.maxStep)throw Error('所選時間超出此原始模式預報時限');
 const key=[id,run,step,level].join('|');let result=getRawFrame(key);if(!result){const r=await fetch('/api/wind/icon?'+new URLSearchParams({model:id,run,step:String(step),level}),{signal});if(!r.ok)await readJsonResponse(r,'DWD ICON');const bytes=await r.arrayBuffer();if(signal.aborted)throw Error('讀取已取消');result=await new Promise<any>((resolve,reject)=>{const worker=new RawWorker();const done=()=>{worker.terminate();signal.removeEventListener('abort',abort)};const abort=()=>{done();reject(Error('讀取已取消'))};signal.addEventListener('abort',abort,{once:true});worker.onerror=()=>{done();reject(Error('此瀏覽器不支援原始 GRIB 解碼器'))};worker.onmessage=(e:MessageEvent)=>{done();e.data.error?reject(Error(e.data.error)):resolve(e.data.result)};worker.postMessage({bytes,run,step,level},[bytes])});putRawFrame(key,result);}
 const frames=Array.from({length:24},(_,h)=>({time:`${date}T${String(h).padStart(2,'0')}:00Z`,u:null,v:null}));frames[hour]={time:new Date(+runDate(run)+step*3600000).toISOString(),u:result.u,v:result.v};return {grid:result.grid,frames,modelId:id,kind:'forecast',level,date,run:runDate(run).toISOString(),step,cadence:step<78?1:3,raw:true,sourceName:'DWD ICON 原始 GRIB2',source:'https://opendata.dwd.de/weather/nwp/icon/',nativeResolution:'約 13 km · 重投影 0.25°',validFraction:result.validFraction};
}
