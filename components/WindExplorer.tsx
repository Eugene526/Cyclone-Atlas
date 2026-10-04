'use client';
import {useEffect,useRef,useState} from 'react';
import {Wind,Satellite,ChevronDown,Play,Pause,Plus,Minus,Info,X,ArrowUpRight,RefreshCw,Layers} from 'lucide-react';
import WindMap from './WindMap';
import {WIND_MODELS,WIND_LEVELS,timeLimits} from '@/lib/wind-data.mjs';
import './wind.css';
const cache=new Map<string,any>();
export default function WindExplorer(){
 const [kind,setKind]=useState('forecast'),[model,setModel]=useState('gfs'),[level,setLevel]=useState('10m'),[date,setDate]=useState(new Date().toISOString().slice(0,10)),[hour,setHour]=useState(new Date().getUTCHours()),[bounds,setBounds]=useState<number[]>([]),[data,setData]=useState<any>(null),[loading,setLoading]=useState(false),[error,setError]=useState(''),[play,setPlay]=useState(false),[motion,setMotion]=useState(true),[units,setUnits]=useState('ms'),[zone,setZone]=useState('tw'),[point,setPoint]=useState<any>(null),[info,setInfo]=useState(false),[expanded,setExpanded]=useState(false),[refresh,setRefresh]=useState(0);
 const dialog=useRef<HTMLDialogElement>(null);
 const api=useRef<any>(null),active=WIND_MODELS.find(m=>m.id===model)!,limits=timeLimits(kind,active),height=WIND_LEVELS.find(l=>l.id===level)!;
 useEffect(()=>{if(info)dialog.current?.showModal()},[info]);
 useEffect(()=>{setMotion(!window.matchMedia('(prefers-reduced-motion: reduce)').matches)},[]);
 useEffect(()=>{const t=setInterval(()=>{if(kind==='forecast')setRefresh(r=>r+1)},1800000);return()=>clearInterval(t)},[kind]);
 const key=[kind,model,level,date,bounds.join(','),refresh].join('|');
 useEffect(()=>{
  if(bounds.length!==4)return;let current=true;const controller=new AbortController();setLoading(true);setError('');setData(null);setPoint(null);
  const t=setTimeout(async()=>{try{
   const stored=cache.get(key);let result=stored;
   if(!result){const q=new URLSearchParams({kind,model,level,date,bbox:bounds.join(',')});const r=await fetch('/api/wind?'+q,{signal:controller.signal});result=await r.json();if(!r.ok)throw Error(result.error||'資料讀取失敗');cache.set(key,result);if(cache.size>14)cache.delete(cache.keys().next().value!);}
   if(current){setData(result);setHour(h=>Math.min(h,result.frames.length-1));setLoading(false)}
  }catch(e){if(current){setLoading(false);setPlay(false);setError(e instanceof Error?e.message:'讀取失敗')}}},650);
  return()=>{current=false;clearTimeout(t);controller.abort()};
 },[key]);
 useEffect(()=>{if(!play||!data||loading)return;const t=setInterval(()=>{if(hour<data.frames.length-1)setHour(hour+1);else{const next=new Date(Date.parse(date+'T00:00Z')+86400000).toISOString().slice(0,10);setHour(0);setDate(next<=limits.max?next:limits.min)}},850);return()=>clearInterval(t)},[play,data,loading,hour,date,limits.max,limits.min]);
 const factor=units==='kmh'?3.6:units==='kt'?1.943844:1,unit=units==='kmh'?'公里／時':units==='kt'?'節':'公尺／秒';
 const valid=data?.frames?.[hour],stamp=valid?.time||date+'T'+String(hour).padStart(2,'0')+':00:00Z';
 const format=(t:string)=>new Date(t).toLocaleString('zh-TW',{timeZone:zone==='tw'?'Asia/Taipei':'UTC',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false});
 const span=data?`${data.grid.lonStep.toFixed(2)}° × ${data.grid.latStep.toFixed(2)}°`:'依目前視窗取樣';
 const modelName=kind==='history'?'ERA5 再分析':active.name;
 const missing=valid?valid.u.filter((x:any)=>!Number.isFinite(x)).length/valid.u.length:0;
 function changeKind(next:string){setKind(next);setPlay(false);const lim=timeLimits(next,active);setDate(next==='history'?lim.max:lim.min);if(next==='history'&&!height.surface)setLevel('10m')}
 function changeModel(id:string){const chosen=WIND_MODELS.find(m=>m.id===id)!;setModel(id);setPlay(false);if((chosen.surfaceOnly&&!height.surface)||(chosen.no100&&level==='100m'))setLevel('10m');const lim=timeLimits(kind,chosen);if(date>lim.max||date<lim.min)setDate(lim.min)}
 const popupStyle=point?{left:Math.max(12,Math.min(point.width-248,point.x+16)),top:Math.max(110,Math.min(point.height-180,point.y-40))}:{};
 return <main className="wind-explorer">
  <header className="wind-header"><a href="/" className="wind-brand"><span>◉</span><div>颱風觀測室<small>CYCLONE ATLAS</small></div></a><nav aria-label="觀測頁面"><a href="/"><Satellite size={15}/>衛星</a><a href="/wind" aria-current="page"><Wind size={16}/>風場</a></nav><button className="wind-icon" aria-label="全球風場資料說明" onClick={()=>setInfo(true)}><Info size={19}/></button></header>
  <section className="wind-workspace">
   <WindMap data={data} hour={hour} motion={motion} onBounds={b=>setBounds(previous=>previous.join(',')===b.join(',')?previous:b)} onPoint={setPoint} onReady={a=>api.current=a}/>
   <div className="wind-heading"><span className="wind-kicker">大氣流動 · 全球探索</span><h1>看見風的形狀</h1><p>{modelName} <span>／</span> {height.label}</p></div>
   <section className={'wind-settings '+(expanded?'is-open':'')} aria-label="風場設定">
    <button className="wind-settings-toggle" aria-expanded={expanded} onClick={()=>setExpanded(!expanded)}><Layers size={16}/><span>{modelName} · {level}</span><ChevronDown size={16}/></button>
    <div className="wind-settings-body">
     <div className="wind-segments"><button className={kind==='forecast'?'selected':''} onClick={()=>changeKind('forecast')}>未來預報</button><button className={kind==='history'?'selected':''} onClick={()=>changeKind('history')}>歷史再分析</button></div>
     <label>預報模式<select aria-label="風場模式" value={kind==='history'?'era5':model} disabled={kind==='history'} onChange={e=>changeModel(e.target.value)}>{kind==='history'?<option value="era5">ERA5 · 天氣重建</option>:<>{WIND_MODELS.filter(m=>m.api).map(m=><option key={m.id} value={m.id}>{m.name} · {m.provider}</option>)}<optgroup label="現有路徑模式 · 風場尚未接入">{WIND_MODELS.filter(m=>!m.api).map(m=><option disabled key={m.id}>{m.name}（未接入）</option>)}</optgroup></>}</select></label>
     <label>高度<select aria-label="風場高度" value={level} onChange={e=>{setLevel(e.target.value);setPlay(false)}}>{WIND_LEVELS.map(l=><option key={l.id} value={l.id} disabled={(!l.surface&&(kind==='history'||active.surfaceOnly))||(kind==='forecast'&&l.id==='100m'&&active.no100)}>{l.label}{(!l.surface&&(kind==='history'||active.surfaceOnly))||(kind==='forecast'&&l.id==='100m'&&active.no100)?' · 未提供':''}</option>)}</select></label>
     <div className="wind-small-row"><label>單位<select aria-label="風速單位" value={units} onChange={e=>setUnits(e.target.value)}><option value="ms">公尺／秒</option><option value="kmh">公里／時</option><option value="kt">節</option></select></label><label>區域<select aria-label="風場區域" defaultValue="pacific" onChange={e=>api.current?.region(e.target.value)}><option value="pacific">西太平洋</option><option value="world">全球</option><option value="taiwan">臺灣</option><option value="europe">歐洲</option><option value="atlantic">大西洋</option></select></label></div>
     <label className="wind-check"><input type="checkbox" checked={motion} onChange={e=>setMotion(e.target.checked)}/>顯示流動粒子</label>
     <p className="wind-help">{kind==='history'?'最近三個月的 ERA5 天氣重建；約延遲 5–6 天，免費接口僅提供 10m／100m。':active.ensemble?'系集平均風場，不是單一成員；強風中心可能被平均平滑。':'各模式的預報時限不同，缺測不以其他模式替代。'}</p>
    </div>
   </section>
   <div className="wind-zoom"><button aria-label="放大風場地圖" onClick={()=>api.current?.zoom(1)}><Plus size={19}/></button><button aria-label="縮小風場地圖" onClick={()=>api.current?.zoom(-1)}><Minus size={19}/></button></div>
   {point&&<aside className="wind-point" style={popupStyle} aria-label="選取位置風場資訊"><button aria-label="關閉風場資訊" onClick={()=>setPoint(null)}><X size={15}/></button><small>{point.lat.toFixed(2)}° {point.lon.toFixed(2)}°</small>{point.value?<><strong>{(point.value.speed*factor).toFixed(1)} <em>{unit}</em></strong><p>風從 {point.value.direction.toFixed(0)}° 吹來</p></>:<p>此格點無有效資料</p>}<footer>{modelName} · {level}<br/>{format(stamp)} · {zone==='tw'?'UTC+8':'UTC'}</footer></aside>}
   <div className="wind-legend"><div><span>風速 <small>{unit}</small></span><span>{level}</span></div><div className="wind-gradient"/><div className="wind-ticks">{[0,7,18,35,50].map(v=><span key={v}>{Math.round(v*factor)}</span>)}</div><p>顯示取樣 {span} · 原生 {data?.nativeResolution||(kind==='history'?'0.25°':active.native)||'0.25°'}<br/>顏色與粒子為插值呈現，不新增觀測細節。</p></div>
   <section className="wind-time" aria-label="風場時間控制">
    <div className="wind-time-top"><div><span className={'wind-badge '+(kind==='history'?'historical':'')}>{kind==='history'?'再分析':'模式預報'}</span><strong>{format(stamp)}</strong><select aria-label="風場時區" value={zone} onChange={e=>setZone(e.target.value)}><option value="tw">UTC+8 臺灣</option><option value="utc">UTC 世界時</option></select></div><label className="wind-date">日期<input aria-label="風場日期（UTC）" type="date" value={date} min={limits.min} max={limits.max} onChange={e=>{const v=e.target.value;if(v>=limits.min&&v<=limits.max){setDate(v);setPlay(false)}}}/><small>UTC 日期</small></label></div>
    <div className="wind-time-track"><button className="wind-play" aria-label={play?'暫停風場回放':'播放風場回放'} disabled={!data||loading} onClick={()=>setPlay(!play)}>{play?<Pause size={19}/>:<Play size={19}/>}</button><div className="wind-slider-wrap"><input aria-label="風場時間軸" type="range" min="0" max={data?data.frames.length-1:23} step="1" value={hour} disabled={!data||loading} onChange={e=>{setHour(+e.target.value);setPlay(false);setPoint(null)}}/><div><span>00:00 UTC</span><span>12:00 UTC</span><span>23:00 UTC</span></div></div><button className="wind-icon" aria-label="重新讀取風場" onClick={()=>{setRefresh(r=>r+1);setPlay(false)}}><RefreshCw size={17}/></button></div>
    <div className="wind-status" role="status"><span className={loading?'loading':''}>{loading?'讀取真實風場資料…':error||`已載入 ${data?.frames.length||0} 個小時${missing>.05?' · 部分格點缺測或位於地形下方':''}`}</span><a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo · CC BY 4.0 <ArrowUpRight size={11}/></a></div>
   </section>
  </section>
  {info&&<div className="wind-modal-backdrop" onClick={()=>setInfo(false)}><dialog ref={dialog} className="wind-modal" aria-labelledby="wind-info-title" onCancel={()=>setInfo(false)} onClick={e=>e.stopPropagation()}><button className="wind-icon" aria-label="關閉風場資料說明" onClick={()=>setInfo(false)}><X/></button><span className="wind-kicker">資料與方法</span><h2 id="wind-info-title">漂亮的風場，也要說清楚資料。</h2><h3>預報與再分析分開</h3><p>未來是所選模式的最新可用預報；歷史是 ERA5 再分析，結合觀測與模式重建，並非每個格點的直接觀測。最近三個月可選，約有五至六天資料延遲。免費接口尚未提供 ERA5 高空風場。</p><h3>解析度不是畫面清晰度</h3><p>為控制免費服務用量，每個地圖視窗取樣 20×12 格點，放大後重新取樣；顯示間距與原生解析度分別標示。雙線性插值作用於東西／南北風分量，不會把 359° 和 1° 誤平均成南風。這是風場概覽，不是原生高解析格點全量呈現。</p><h3>高度、地形與粒子</h3><p>10m／100m 是距地面高度；百帕是等壓面，公里數僅為近似海拔。地形以下的等壓面與缺測格點保持空白。流動粒子只表示風向及相對強弱，動畫已加速，不是真實空氣移動時間。</p><h3>模式與免費用量</h3><p>系集顯示資料供應方計算的平均風場，不是每條路徑各自的風。未接入模式會列明原因，不冒充其他模式。免費來源有用量限制，載入失敗會明確顯示；不購買服務或隱藏收費。</p><ul>{WIND_MODELS.filter(m=>m.reason).map(m=><li key={m.id}><strong>{m.name}</strong>：{m.reason}</li>)}</ul><p>日期選擇以 UTC 為基準，畫面時刻可切換臺灣時間。資料時效以成功回覆為準，遠期預報缺測不外推。</p><a href="https://open-meteo.com/en/docs" target="_blank" rel="noreferrer">預報資料文件 ↗</a> · <a href="https://open-meteo.com/en/docs/historical-weather-api" target="_blank" rel="noreferrer">ERA5 再分析文件 ↗</a></dialog></div>}
 </main>;
}
