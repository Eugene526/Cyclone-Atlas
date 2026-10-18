'use client';
import dynamic from 'next/dynamic';
import {useEffect,useRef,useState} from 'react';
import type {MapAPI} from '@/components/WeatherMap';
const Map=dynamic(()=>import('@/components/WeatherMap'),{ssr:false});
const empty:any[]=[], layers={nearshore:false,official:false,impact:false},noop=()=>{};
export default function Page(){
 const [frames,setFrames]=useState<string[]>([]),[index,setIndex]=useState(0),[ready,setReady]=useState(false),[status,setStatus]=useState('雷達資料載入中');
 const api=useRef<MapAPI|null>(null);
 useEffect(()=>{let alive=true;const update=()=>fetch('/api/radar?provider=cwa').then(r=>r.json()).then((d:any)=>{if(!alive)return;const rows=(d.frames||[]).map((f:{time:string})=>f.time).filter((t:string)=>Date.parse(t)>Date.now()-3*3600000).slice(-18);if(rows.length){setFrames(rows);setIndex(0)}else setStatus('目前沒有可用的雷達影格')}).catch(()=>setStatus('雷達來源暫時未就緒'));update();const id=setInterval(update,300000);return()=>{alive=false;clearInterval(id)}},[]);
 useEffect(()=>{if(!ready||frames.length<2)return;const id=setTimeout(()=>{setReady(false);setIndex(i=>(i+1)%frames.length)},850);return()=>clearTimeout(id)},[ready,frames,index]);
 const time=frames[index];return <div style={{position:'fixed',inset:0,background:'#07131c'}}>{time&&<Map cwa={null} agency="cwa" warningLayers={layers} cwaError={false} cwaHistory={false} radars={['cwa']} onRadarReady={setReady} onRadarStatus={setStatus} time={time} mode="bw" opacity={0.3} storms={empty} wind={false} forecast={false} models={empty} onCenter={noop} onStatus={noop} playing={true} nextTimes={frames.length?[frames[(index+1)%frames.length]]:empty} onPoint={noop} onThermal={noop} thermal={null} onLoaded={noop} onLoading={noop} onReady={a=>{api.current=a;a.region([119.1,21.4,123.9,25.9])}}/>}<div style={{position:'absolute',top:18,right:18,color:'#fff',background:'#091925e8',padding:'10px 14px',fontSize:14}}>中央氣象署雷達回波<br/>{time?new Date(time).toLocaleString('zh-TW',{timeZone:'Asia/Taipei',hour12:false})+' UTC+8':status}</div></div>
}
