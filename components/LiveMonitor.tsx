'use client';

import {useEffect,useRef,useState} from 'react';
import WeatherMap,{type MapAPI} from './WeatherMap';
import {useTyphoonWarnings} from './useTyphoonWarnings';
import './live-monitor.css';

const LAYERS={nearshore:true,official:true,impact:true};
const RADARS=['cwa'];
const EMPTY:any[]=[];
const noop=()=>{};
const fmt=(s:string)=>new Date(s).toLocaleString('zh-TW',{timeZone:'Asia/Taipei',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false});
const short=(s:string,n=150)=>s.length>n?s.slice(0,n).trim()+'…':s;
const isDaylight=(date:string,lat:number,lon:number)=>{
 const d=new Date(date);if(!Number.isFinite(d.getTime()))return false;
 const day=Math.floor((d.getTime()-Date.UTC(d.getUTCFullYear(),0,1))/86400000)+1;
 const decl=23.44*Math.sin((2*Math.PI/365)*(day-81))*Math.PI/180;
 const latitude=lat*Math.PI/180;
 const solarHour=(d.getUTCHours()+d.getUTCMinutes()/60+lon/15+24)%24;
 const hourAngle=(solarHour-12)*Math.PI/12;
 return Math.asin(Math.sin(latitude)*Math.sin(decl)+Math.cos(latitude)*Math.cos(decl)*Math.cos(hourAngle))*180/Math.PI>=5;
};

export default function LiveMonitor(){
 const {data:cwa,error:cwaError}=useTyphoonWarnings();
 const [clock,setClock]=useState<Date|null>(null);
 const [latest,setLatest]=useState('');
 const [frame,setFrame]=useState('');
 const [advisories,setAdvisories]=useState<any>(null);
 const [observations,setObservations]=useState<any>(null);
 const [scene,setScene]=useState(0);
 const [ready,setReady]=useState(false);
 const [mapReady,setMapReady]=useState(false);
 const [radarReady,setRadarReady]=useState(true);
 const [radarStatus,setRadarStatus]=useState('');
 const api=useRef<MapAPI|null>(null);
 const latestRef=useRef('');

 useEffect(()=>{setClock(new Date());const id=setInterval(()=>setClock(new Date()),1000);return()=>clearInterval(id)},[]);
 useEffect(()=>{let active=true;async function update(){
  const results=await Promise.allSettled(['/api/satellite','/api/live-advisories'].map(async url=>{const r=await fetch(url);if(!r.ok)throw Error(url);return r.json() as Promise<any>}));
  if(!active)return;
  if(results[0].status==='fulfilled'&&Number.isFinite(Date.parse(results[0].value.time))){
   const t=results[0].value.time;latestRef.current=t;setLatest(t);setFrame(v=>v||new Date(Date.parse(t)-3*3600000).toISOString());
  }
  if(results[1].status==='fulfilled')setAdvisories(results[1].value);
 }update();const id=setInterval(()=>{if(!document.hidden)update()},180000);return()=>{active=false;clearInterval(id)}},[]);
 useEffect(()=>{let active=true;async function update(){try{const r=await fetch('/api/live-observations');if(!r.ok)throw Error();const body=await r.json();if(active)setObservations(body)}catch{if(active)setObservations(null)}}update();const id=setInterval(()=>{if(!document.hidden)update()},300000);return()=>{active=false;clearInterval(id)}},[]);
 useEffect(()=>{const durations=[18000,17000,17000,18000];const id=setTimeout(()=>setScene(v=>v+1),durations[scene%4]);return()=>clearTimeout(id)},[scene]);
 useEffect(()=>{if(!frame||!ready)return;const id=setTimeout(()=>{setReady(false);setFrame(v=>{const end=Date.parse(latestRef.current);if(!Number.isFinite(end))return v;const next=Date.parse(v)+600000;return new Date(next>end?end-3*3600000:next).toISOString()})},radarReady?900:1900);return()=>clearTimeout(id)},[frame,ready,radarReady]);

 const storms=cwa?.storms||EMPTY;
 const phase=scene%4;
 const currentStorm=storms[Math.floor(scene/4)%Math.max(1,storms.length)];
 const radarScene=phase===1||phase===2;
 const targetLat=currentStorm?.current?.lat??23.6,targetLon=currentStorm?.current?.lon??121;
 const night=phase===0&&!isDaylight(frame,targetLat,targetLon);
 const mode=phase===0?(night?'bw':'rgb'):phase===3?'ott':'bw';
 const sceneTitle=['颱風衛星雲圖','臺灣雷達回波','警特報發布區域','雲頂溫度分析'][phase];
 const sceneSubtitle=['衛星特寫與颱風目前位置','近三小時觀測影格循環','依氣象署有效特報標示縣市','紅外線亮溫色調強化'][phase];
 const items=advisories?.items||EMPTY,bulletins=advisories?.bulletins||EMPTY;
 const alertItems=phase===2?items:EMPTY;
 const tickerItems=[...(cwa?.warning?.active?[cwa.warning.headline]:[]),...bulletins.map((b:any)=>`${b.title}：${short(String(b.text||''),220)}`)];
 const ticker=tickerItems.length?tickerItems.join('　　｜　　'):advisories?'目前沒有有效的氣象警特報':'正在取得氣象署警特報';
 const nextTimes=frame?[new Date(Math.min(Date.parse(latest||frame),Date.parse(frame)+600000)).toISOString()]:EMPTY;
 const ranking=phase===1?(observations?.rain1h||[]):phase===2?(observations?.gust||[]):(observations?.temperature||[]);
 const rankingTitle=phase===1?'近一小時雨量':phase===2?'最大瞬間風':'測站氣溫';
 const rankingUnit=phase===1?'毫米':phase===2?'公尺／秒':'°C';
 const affectedAreas=[...new Set(items.map((v:any)=>String(v.area)))];
 const sourceCount=(advisories?.sources||[]).filter((s:any)=>s.status==='ready').length;

 useEffect(()=>{
  if(!api.current||!mapReady)return;
  if(radarScene){api.current.region([119.2,21.5,123.8,25.8]);return}
  if(currentStorm?.current&&Number.isFinite(currentStorm.current.lat)&&Number.isFinite(currentStorm.current.lon)){
   const {lat,lon}=currentStorm.current;
   api.current.region(phase===0?[lon-7,lat-5,lon+7,lat+5]:[lon-5.5,lat-4,lon+5.5,lat+4]);return;
  }
  api.current.region([119.2,21.5,123.8,25.8]);
 },[scene,phase,radarScene,currentStorm,mapReady]);

 return <div className="broadcast">
  <header className="broadcast-head">
   <a className="broadcast-brand" href="/" aria-label="颱風觀測站首頁"><img src="/images/typhoon-observatory-logo.png" alt="颱風觀測站"/></a>
   <div className="broadcast-program"><strong>颱風即時監測</strong><span>衛星　／　雷達　／　警特報</span></div>
   <div className="broadcast-onair"><i/> LIVE　自動播報</div>
   <time className="broadcast-clock">{clock?clock.toLocaleString('zh-TW',{timeZone:'Asia/Taipei',hour12:false}):'--:--:--'}<small>臺灣時間　UTC+8</small></time>
  </header>

  <div className="broadcast-body">
   <main className="broadcast-visual">
    <div className="broadcast-map">{frame&&<WeatherMap cwa={cwa} agency="cwa" warningLayers={LAYERS} cwaError={cwaError} cwaHistory={true} advisoryItems={alertItems} radars={radarScene?RADARS:EMPTY} onRadarReady={setRadarReady} onRadarStatus={setRadarStatus} time={frame} mode={mode} opacity={1} storms={EMPTY} wind={!radarScene} forecast={false} models={EMPTY} onCenter={noop} onStatus={noop} playing={true} nextTimes={nextTimes} onPoint={noop} onThermal={noop} thermal={null} onLoaded={()=>setReady(true)} onLoading={()=>setReady(false)} onReady={a=>{api.current=a;setMapReady(true)}}/>}</div>
    <div className="broadcast-title" key={scene}><span>{String(phase+1).padStart(2,'0')} / 04　{radarScene?'CWA RADAR':'HIMAWARI-9'}</span><h1>{sceneTitle}</h1><p>{sceneSubtitle}{night?' · 夜間自動切換紅外線':''}</p></div>
    <div className="broadcast-map-key">
     {phase===2?<><b>警特報燈號</b>{(['red','orange','yellow','green'] as const).map(level=>{const areas=[...new Set(items.filter((v:any)=>v.level===level).map((v:any)=>v.area))];return areas.length?<span key={level}><i className={'lamp-'+level}/>{areas.join('、')}</span>:null})}{!items.length&&<span>目前無有效發布區域</span>}</>:
      phase===1?<><b>雷達回波</b><span className="radar-gradient"/> <small>弱　　中　　強</small></>:
      <><b>{mode==='rgb'?'真實色衛星':mode==='ott'?'OTT 強化':'黑白紅外線'}</b><span>颱風目前位置與七級風半徑</span></>}
    </div>
    <div className="broadcast-frame-time"><b>觀測時間</b><time>{frame?fmt(frame):'影格載入中'}</time><span>UTC+8</span></div>
    <div className="broadcast-frame-progress"><i style={{width:`${latest&&frame?Math.max(0,Math.min(100,100-(Date.parse(latest)-Date.parse(frame))/108000)):0}%`}}/></div>
   </main>

   <aside className="broadcast-data">
    <div className="broadcast-data-head"><b>即時觀測資料</b><span>CWA OPEN DATA</span></div>
    <section className="broadcast-lead">
     {radarScene?<><span className="broadcast-section-name">{phase===1?'臺灣雷達回波':'特報發布縣市'}</span><strong>{phase===1?'3 小時':`${affectedAreas.length} 縣市`}</strong><p>{phase===1?(radarStatus||'雷達影格更新中'):(affectedAreas.length?affectedAreas.join('、'):'目前無有效特報地區')}</p></>:
      currentStorm?<><span className="broadcast-section-name">目前颱風 · 中央氣象署</span><strong>{currentStorm.name}</strong><p>{currentStorm.current?.lat?.toFixed(1)}°N　{currentStorm.current?.lon?.toFixed(1)}°E</p><div className="broadcast-storm-values"><div><small>中心氣壓</small><b>{currentStorm.current?.pressure??'—'} <em>hPa</em></b></div><div><small>最大風速</small><b>{currentStorm.current?.windMs??'—'} <em>m/s</em></b></div></div></>:<><span className="broadcast-section-name">西北太平洋</span><strong>衛星觀測中</strong><p>目前沒有颱風預報資料</p></>}
    </section>
    <section className="broadcast-rank"><div className="broadcast-section-heading"><b>{rankingTitle}排行</b><span>{rankingUnit}</span></div>{ranking.length&&ranking[0].value>0?<ol>{ranking.slice(0,5).map((r:any,i:number)=><li key={r.station+i}><span>{i+1}</span><b>{r.county} {r.station}</b><strong>{r.value.toFixed(1)}</strong></li>)}</ol>:<p>{observations?'目前無顯著觀測值':'測站資料讀取中'}</p>}<small>{ranking[0]?.time?`觀測 ${fmt(ranking[0].time)}`:'觀測更新中'}　UTC+8</small></section>
    <section className="broadcast-warning"><div className="broadcast-section-heading"><b>最新警特報</b><span>{sourceCount}/6 資料源</span></div>{cwa?.warning?.active&&<p className="broadcast-typhoon-warning">{short(cwa.warning.headline,90)}</p>}{bulletins.length?<div className="broadcast-warning-list">{bulletins.slice(0,2).map((b:any,i:number)=><p key={i}><strong>{b.title}</strong><span>{short(String(b.text||''),90)}</span></p>)}</div>:<p className="broadcast-no-warning">{advisories?'目前沒有有效警特報':'特報資料讀取中'}</p>}</section>
    <div className="broadcast-source">衛星與雷達為觀測資料　·　颱風路徑為預報<br/>中央氣象署　／　Himawari-9</div>
   </aside>
  </div>

  <footer className="broadcast-footer"><b>氣象快訊</b><div className="broadcast-ticker" aria-label={ticker}><span>{ticker}</span><span aria-hidden="true">{ticker}</span></div><time>{clock?clock.toLocaleTimeString('zh-TW',{timeZone:'Asia/Taipei',hour12:false}):'--:--:--'}</time></footer>
 </div>;
}
