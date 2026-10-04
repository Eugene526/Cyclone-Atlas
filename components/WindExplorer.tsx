'use client';
import {useEffect,useRef,useState} from 'react';
import {Wind,Satellite,ChevronDown,Play,Pause,Plus,Minus,Info,X,ArrowUpRight,RefreshCw,Layers} from 'lucide-react';
import WindMap from './WindMap';
import {WIND_MODELS,WIND_LEVELS,timeLimits} from '@/lib/wind-data.mjs';
import './wind.css';
import {nextPlaybackTime} from '@/lib/wind-playback.mjs';
import {loadGEPS} from '@/lib/geps-client';
import {loadICON} from '@/lib/icon-client';
import {loadERA5} from '@/lib/era5-client';
import {loadRaw} from '@/lib/raw-client';
import {loadJMA} from '@/lib/jma-client';
import {loadGFS} from '@/lib/gfs-client';
export default function WindExplorer(){
 const [kind,setKind]=useState('forecast'),[model,setModel]=useState('gfs'),[level,setLevel]=useState('10m'),[date,setDate]=useState(new Date().toISOString().slice(0,10)),[hour,setHour]=useState(new Date().getUTCHours()),[bounds,setBounds]=useState<number[]>([]),[data,setData]=useState<any>(null),[loading,setLoading]=useState(false),[error,setError]=useState(''),[play,setPlay]=useState(false),[motion,setMotion]=useState(true),[units,setUnits]=useState('ms'),[zone,setZone]=useState('tw'),[point,setPoint]=useState<any>(null),[info,setInfo]=useState(false),[expanded,setExpanded]=useState(false),[refresh,setRefresh]=useState(0);
 const [rangeOpen,setRangeOpen]=useState(false),[rangeStart,setRangeStart]=useState(date+'T00:00'),[rangeEnd,setRangeEnd]=useState(date+'T23:00');
 const dialog=useRef<HTMLDialogElement>(null);
 const api=useRef<any>(null),active=WIND_MODELS.find(m=>m.id===model)!,limits=timeLimits(kind,active),height=WIND_LEVELS.find(l=>l.id===level)!;
 useEffect(()=>{if(info)dialog.current?.showModal()},[info]);
 useEffect(()=>{setMotion(!window.matchMedia('(prefers-reduced-motion: reduce)').matches)},[]);
 useEffect(()=>{const t=setInterval(()=>{if(kind==='forecast')setRefresh(r=>r+1)},1800000);return()=>clearInterval(t)},[kind]);
 useEffect(()=>{setRangeStart(date+'T00:00');setRangeEnd(date+'T23:00')},[kind,model]);
 const raw=kind==='history'||Boolean(active.raw);
 const rawLoad=(date:string,hour:number,level:string,signal:AbortSignal)=>kind==='history'?loadERA5(date,hour,level,signal):model==='jma'?loadJMA(date,hour,level,signal):model==='gfs'?loadGFS(date,hour,level,signal):model==='cmce'?loadGEPS(date,hour,level,signal):model==='icon'?loadICON(date,hour,level,signal):loadRaw(model,date,hour,level,signal);
 const rawSource=kind==='history'?{url:'https://github.com/google-research/arco-era5',label:'ARCO-ERA5 原始 Zarr'}:({jma:{url:'https://www.wis-jma.go.jp/cms/news/news-detail.php?id=92',label:'JMA GSM 原始 GRIB2'},gfs:{url:'https://registry.opendata.aws/noaa-gfs-bdp-pds/',label:'NOAA GFS 原始 GRIB2'},gefs:{url:'https://registry.opendata.aws/noaa-gefs/',label:'NOAA GEFS 原始平均'},aigefs:{url:'https://www.nco.ncep.noaa.gov/pmb/products/aigefs/',label:'NOAA AIGEFS 原始平均'},icon:{url:'https://opendata.dwd.de/weather/nwp/icon/',label:'DWD ICON 原始 GRIB2'},cmce:{url:'https://eccc-msc.github.io/open-data/msc-data/nwp_geps/readme_geps-datamart_en/',label:'ECCC GEPS 原始成員'}}[model]||{url:'https://www.ecmwf.int/en/forecasts/datasets/open-data',label:'ECMWF 原始 GRIB2'});
 const key=[kind,model,level,date,raw?(bounds.length===4?'ready:'+hour:'waiting'):bounds.join(','),refresh].join('|');
 useEffect(()=>{
  if(bounds.length!==4)return;let current=true;const controller=new AbortController();setLoading(true);setError('');setData(null);setPoint(null);
  const t=setTimeout(async()=>{try{
   let result:any=null;
   if(!result&&raw){result=await rawLoad(date,hour,level,controller.signal)}
   if(!result)throw Error('此模式尚未接入原始格點風場；未以二手 API 或其他模式替代。');
   if(current){setData(result);setHour(h=>Math.min(h,result.frames.length-1));setLoading(false)}
  }catch(e){if(current){setLoading(false);setPlay(false);setError(e instanceof Error?e.message:'讀取失敗')}}},raw?0:650);
  return()=>{current=false;clearTimeout(t);controller.abort()};
 },[key]);
 useEffect(()=>{if(!play||!data||loading)return;
  const next=nextPlaybackTime(date,hour,rangeStart,rangeEnd,limits.min,limits.max);
  if(!next){setPlay(false);setError('請選擇可用日期內的起訖時間，結束不可早於起始');return;}
  const nextHour=next.hour,nextDate=next.date;
  const controller=new AbortController();let current=true;
  // Decode the next raw field before advancing the clock: no blank in-between frame.
  const ready=raw?rawLoad(nextDate,nextHour,level,controller.signal):Promise.resolve(null);
  const t=setTimeout(async()=>{try{await ready;if(current){setHour(nextHour);setDate(nextDate)}}catch(e){if(current){setPlay(false);setError(e instanceof Error?e.message:'下一張風場未到齊')}}},850);
  ready.catch(()=>{});return()=>{current=false;clearTimeout(t);controller.abort()};
 },[play,data,loading,hour,date,limits.max,limits.min,raw,level,rangeStart,rangeEnd]);
 const factor=units==='kmh'?3.6:units==='kt'?1.943844:1,unit=units==='kmh'?'公里／時':units==='kt'?'節':'公尺／秒';
 const valid=data?.frames?.[hour],stamp=valid?.time||date+'T'+String(hour).padStart(2,'0')+':00:00Z';
 const format=(t:string)=>new Date(t).toLocaleString('zh-TW',{timeZone:zone==='tw'?'Asia/Taipei':'UTC',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false});
 const span=data?`${data.grid.lonStep.toFixed(2)}° × ${data.grid.latStep.toFixed(2)}°`:(raw?'載入中':'依目前視窗取樣');
 const modelName=kind==='history'?'ERA5 再分析':active.name;
 const missing=data?.raw?1-data.validFraction:valid?.u?valid.u.filter((x:any)=>!Number.isFinite(x)).length/valid.u.length:0;
 function changeKind(next:string){setKind(next);setPlay(false);const lim=timeLimits(next,active);setDate(next==='history'?lim.max:lim.min);}
 function changeModel(id:string){const chosen=WIND_MODELS.find(m=>m.id===id)!;setModel(id);setPlay(false);if((chosen.surfaceOnly&&!height.surface)||(chosen.no100&&level==='100m'))setLevel('10m');const lim=timeLimits(kind,chosen);if(date>lim.max||date<lim.min)setDate(lim.min)}
 const popupStyle=point?{left:Math.max(12,Math.min(point.width-248,point.x+16)),top:Math.max(110,Math.min(point.height-180,point.y-40))}:{};
 return <main className="wind-explorer">
  <header className="wind-header"><a href="/" className="wind-brand"><span>◉</span><div>颱風觀測室<small>CYCLONE ATLAS</small></div></a><nav aria-label="觀測頁面"><a href="/"><Satellite size={15}/>衛星</a><a href="/wind" aria-current="page"><Wind size={16}/>風場</a></nav><button className="wind-icon" aria-label="全球風場資料說明" onClick={()=>setInfo(true)}><Info size={19}/></button></header>
  <section className="wind-workspace">
   <WindMap selected={point} data={data} hour={hour} motion={motion} onBounds={b=>setBounds(previous=>previous.join(',')===b.join(',')?previous:b)} onPoint={setPoint} onReady={a=>api.current=a}/>
   <div className="wind-heading"><span className="wind-kicker">大氣流動 · 全球探索</span><h1>看見風的形狀</h1><p>{modelName} <span>／</span> {height.label}</p></div>
   <section className={'wind-settings '+(expanded?'is-open':'')} aria-label="風場設定">
    <button className="wind-settings-toggle" aria-expanded={expanded} onClick={()=>setExpanded(!expanded)}><Layers size={16}/><span>{modelName} · {level}</span><ChevronDown size={16}/></button>
    <div className="wind-settings-body">
     <div className="wind-segments"><button className={kind==='forecast'?'selected':''} onClick={()=>changeKind('forecast')}>未來預報</button><button className={kind==='history'?'selected':''} onClick={()=>changeKind('history')}>歷史再分析</button></div>
     <label>預報模式<select aria-label="風場模式" value={kind==='history'?'era5':model} disabled={kind==='history'} onChange={e=>changeModel(e.target.value)}>{kind==='history'?<option value="era5">ERA5 · 天氣重建</option>:<>{WIND_MODELS.filter(m=>m.api).map(m=><option key={m.id} value={m.id}>{m.name} · {m.provider} · 原始資料</option>)}<optgroup label="原始風場尚未接入">{WIND_MODELS.filter(m=>!m.api).map(m=><option disabled key={m.id}>{m.name}（{m.reason||'尚未接入原始格點'}）</option>)}</optgroup></>}</select></label>
     <label>高度<select aria-label="風場高度" value={level} onChange={e=>{setLevel(e.target.value);setPlay(false)}}>{WIND_LEVELS.map(l=><option key={l.id} value={l.id} disabled={(!l.surface&&(kind==='forecast'&&active.surfaceOnly))||(kind==='forecast'&&l.id==='100m'&&active.no100)}>{l.label}{(!l.surface&&(kind==='forecast'&&active.surfaceOnly))||(kind==='forecast'&&l.id==='100m'&&active.no100)?' · 未提供':''}</option>)}</select></label>
     <div className="wind-small-row"><label>單位<select aria-label="風速單位" value={units} onChange={e=>setUnits(e.target.value)}><option value="ms">公尺／秒</option><option value="kmh">公里／時</option><option value="kt">節</option></select></label><label>區域<select aria-label="風場區域" defaultValue="pacific" onChange={e=>api.current?.region(e.target.value)}><option value="pacific">西太平洋</option><option value="world">全球</option><option value="taiwan">臺灣</option><option value="europe">歐洲</option><option value="atlantic">大西洋</option></select></label></div>
     <label className="wind-check"><input type="checkbox" checked={motion} onChange={e=>setMotion(e.target.checked)}/>顯示流動粒子</label>
     <p className="wind-help">{kind==='history'?'ERA5 原始 0.25° Zarr；逐時重建，約延遲 5–6 天。':raw?(model==='jma'?'JMA 公開 1.25° 全球風場，每 6 小時；高空資料可能包含地形以下的外推值。':model==='aigefs'?'NOAA 原始 0.25° 系集平均，每 6 小時；目前驗證 10 公尺風場。':model==='cmce'?'ECCC 原始 21 成員，以完整 u/v 格點計算平均；0.5° 全球風場。':model==='gefs'?'NOAA 原始 0.5° 系集平均風分量，前 240 小時每 3 小時，其後每 6 小時。':model==='icon'?'DWD 原始 13 km 格點，以官方索引重投影到 0.25°；首次需載入解碼器。':model==='gfs'?'NOAA 原始 0.25° 全球格點；前 120 小時逐時，其後每 3 小時。移動地圖不重新查詢。':'ECMWF 原始 0.25° 格點，依原生時間間隔顯示；首次需載入解碼器。'):kind==='history'?'最近三個月的 ERA5 天氣重建；約延遲 5–6 天，已接上地面與高空原始格點。':active.ensemble?'系集平均風場，不是單一成員；強風中心可能被平均平滑。':'各模式的預報時限不同，缺測不以其他模式替代。'}</p>
    </div>
   </section>
   <div className="wind-zoom"><button aria-label="放大風場地圖" onClick={()=>api.current?.zoom(1)}><Plus size={19}/></button><button aria-label="縮小風場地圖" onClick={()=>api.current?.zoom(-1)}><Minus size={19}/></button></div>
   {point&&<aside className="wind-point" style={popupStyle} aria-label="選取位置風場資訊"><button aria-label="關閉風場資訊" onClick={()=>setPoint(null)}><X size={15}/></button><small>{point.lat.toFixed(2)}° {point.lon.toFixed(2)}°</small>{point.value?<><strong>{(point.value.speed*factor).toFixed(1)} <em>{unit}</em></strong><p>風從 {point.value.direction.toFixed(0)}° 吹來</p></>:<p>此格點無有效資料</p>}<footer>{modelName} · {level}<br/>{format(stamp)} · {zone==='tw'?'UTC+8':'UTC'}</footer></aside>}
   <div className="wind-legend"><div><span>風速 <small>{unit}</small></span><span>{level}</span></div><div className="wind-gradient"/><div className="wind-ticks">{[0,7,18,35,50].map(v=><span key={v}>{Math.round(v*factor)}</span>)}</div><p>{raw?'來源原始格點':'原始資料未接入'} {span} · 原生 {data?.nativeResolution||(kind==='history'?'0.25°':active.native)||'0.25°'}<br/>顏色與粒子為插值呈現，不新增觀測細節。</p></div>
   <section className="wind-time" aria-label="風場時間控制">
    <div className="wind-time-top"><div><span className={'wind-badge '+(kind==='history'?'historical':'')}>{kind==='history'?'再分析':'模式預報'}</span><strong>{format(stamp)}</strong><select aria-label="風場時區" value={zone} onChange={e=>setZone(e.target.value)}><option value="tw">UTC+8 臺灣</option><option value="utc">UTC 世界時</option></select></div><label className="wind-date">日期<input aria-label="風場日期（UTC）" type="date" value={date} min={limits.min} max={limits.max} onChange={e=>{const v=e.target.value;if(v>=limits.min&&v<=limits.max){setDate(v);setPlay(false)}}}/><small>UTC 日期</small></label></div>
    <button className="wind-range-toggle" aria-expanded={rangeOpen} onClick={()=>setRangeOpen(!rangeOpen)}>動畫區間 · UTC <ChevronDown size={14}/></button>
    {rangeOpen&&<div className="wind-range-fields"><label>起始時間（UTC）<input aria-label="動畫起始時間（UTC）" type="datetime-local" step="3600" min={limits.min+'T00:00'} max={limits.max+'T23:00'} value={rangeStart} onChange={e=>{setRangeStart(e.target.value);setPlay(false)}}/></label><label>結束時間（UTC）<input aria-label="動畫結束時間（UTC）" type="datetime-local" step="3600" min={rangeStart} max={limits.max+'T23:00'} value={rangeEnd} onChange={e=>{setRangeEnd(e.target.value);setPlay(false)}}/></label><small>播放到結束後回到起始；資料依模式原生間隔顯示。</small></div>}
    <div className="wind-time-track"><button className="wind-play" aria-label={play?'暫停風場回放':'播放風場回放'} disabled={!data||loading} onClick={()=>setPlay(!play)}>{play?<Pause size={19}/>:<Play size={19}/>}</button><div className="wind-slider-wrap"><input aria-label="風場時間軸" type="range" min="0" max={data?data.frames.length-1:23} step="1" value={hour} disabled={!data||loading} onChange={e=>{setHour(+e.target.value);setPlay(false);setPoint(null)}}/><div><span>00:00 UTC</span><span>12:00 UTC</span><span>23:00 UTC</span></div></div><button className="wind-icon" aria-label="重新讀取風場" onClick={()=>{setRefresh(r=>r+1);setPlay(false)}}><RefreshCw size={17}/></button></div>
    <div className="wind-status" role="status"><span className={loading?'loading':''}>{loading?'讀取來源原始風場…':error||`${data?.raw?(kind==='history'?'ERA5 原始格點已載入':'原始格點已載入 · 起報 '+format(data.run)+' · +'+data.step+'h'):'此模式尚未接入原始風場資料'}${missing>.05?' · 部分格點缺測或位於地形下方':''}`}</span><a href={raw?(data?.source||rawSource.url):'https://www.ecmwf.int/en/forecasts/datasets/open-data'} target="_blank" rel="noreferrer">{raw?(data?.sourceName||rawSource.label):'查看原始資料可用性'} <ArrowUpRight size={11}/></a></div>
   </section>
  </section>
  {info&&<div className="wind-modal-backdrop" onClick={()=>setInfo(false)}><dialog ref={dialog} className="wind-modal" aria-labelledby="wind-info-title" onCancel={()=>setInfo(false)} onClick={e=>e.stopPropagation()}><button className="wind-icon" aria-label="關閉風場資料說明" onClick={()=>setInfo(false)}><X/></button><span className="wind-kicker">使用指南</span><h2 id="wind-info-title">如何閱讀風場地圖</h2><h3>顏色與流動線</h3><p>顏色代表風速，請對照右側或下方色條。流動線表示風吹向哪裡，播放速度經過加速，不代表空氣實際移動速度。點選地圖可查看位置、風速與來向。</p><h3>選擇模式與高度</h3><p>不同模式的結果可能不同；系集平均是多個預報成員的平均，強風中心可能較平滑。10 公尺與 100 公尺表示距地面高度；百帕表示氣壓層，不是固定海拔。JMA 公開風場格距為 1.25°，不等於模式內部的計算解析度；高空格點可能含地形以下外推值。</p><h3>時間與動畫</h3><p>未來預報顯示模式預測，歷史再分析顯示 ERA5 重建風場，最新資料約延遲五至六天。日期及動畫起訖以 UTC 選擇，顯示時區可切換臺灣時間。展開「動畫區間」設定開始與結束時間，按播放後循環；畫面顯示實際可用資料時刻，各模式時間間隔不同。</p><h3>地圖操作</h3><p>拖曳移動地圖，滾輪或雙指縮放。地圖保持北方朝上，旋轉手勢已停用。手機可點左上設定列展開模式與高度選項，再次點選即可收合。</p><h3>使用須知</h3><p>放大可看清地圖，但不會增加資料本身的解析度。缺測區域不代表無風；預報會隨新起報更新。此頁供天氣探索，防災與出行請參考中央氣象署及所在地官方警報。</p><a href="https://www.cwa.gov.tw/" target="_blank" rel="noreferrer">中央氣象署 ↗</a></dialog></div>}
 </main>;
}
