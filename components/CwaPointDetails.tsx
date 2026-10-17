'use client';
import {X} from 'lucide-react';import {tw} from '@/lib/satellite';
export default function CwaPointDetails({data:d,onClose}:{data:any,onClose:()=>void}){
 const p=d.point,pos=d.popupPosition,w=pos?Math.min(300,pos.width-24):300,h=pos?Math.min(pos.height*.5,400):400;
 const style=pos?{left:Math.max(8,Math.min(pos.x+14,pos.width-w-8)),top:Math.max(8,Math.min(pos.y-50,pos.height-h-8)),width:w,maxHeight:h}:undefined;
 return <article className={`point-popup cwa-popup ${pos?'point-popup-anchored':''}`} style={style}><button className="icon-button close" onClick={onClose} aria-label="關閉資訊"><X size={16}/></button><h3>{d.name}</h3>
 {d.kind==='warning-area'?<><p>{d.text}</p>{d.items?.map((v:any,i:number)=><p key={i}>{v.storm} · 約 {tw(v.time)} UTC+8</p>)}</>:<><p className="point-time">CWA {p.history?'歷史定位':p.lead?`預測 +${p.lead}h`:'最新分析'}<br/>{tw(p.time)} · 臺灣 UTC+8</p><dl><dt>中心氣壓</dt><dd>{p.pressure??'未提供'} hPa</dd><dt>最大風速</dt><dd>{p.windMs??'未提供'} m/s</dd><dt>最大陣風</dt><dd>{p.gustMs??'未提供'} m/s</dd><dt>位置</dt><dd>{p.lat.toFixed(2)}°N {p.lon.toFixed(2)}°E</dd><dt>中心70%機率圓半徑</dt><dd>{p.probabilityKm??'未提供'} km</dd></dl>
 {(['r15','r25'] as const).map((key,i)=>{const r=p[key];return <div key={key} className="cwa-radii"><b>{i?'十級風（25 m/s）':'七級風（15 m/s）'}</b>{!r?<p>未提供風圈</p>:<p>平均半徑 {r.mean??'未提供'} km<br/>東北／東南／西南／西北：<br/>{r.quadrants.map((v:any)=>v??'—').join(' / ')} km{!r.asymmetric&&<><br/>來源未提供完整四象限；地圖使用平均半徑。</>}</p>}</div>})}<p className="source-note">70% 圓是颱風中心位置的不確定範圍，不是暴風圈。CWA 與 JMA 風速定義不同。</p><p className="source-note">發布 {tw(d.issue)} UTC+8</p><details><summary>資料欄位</summary><pre>{JSON.stringify(p,null,2)}</pre></details></>}
 </article>
}
