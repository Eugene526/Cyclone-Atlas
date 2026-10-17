'use client';
import {useState,useEffect} from 'react';
import {ChevronDown,ChevronUp,TriangleAlert,LocateFixed,ExternalLink} from 'lucide-react';
import {tw} from '@/lib/satellite';
export default function TyphoonWarning({data,error,agency,setAgency,layers,setLayers,onLocate}:{data:any,error:boolean,agency:string,setAgency:(v:string)=>void,layers:any,setLayers:(v:any)=>void,onLocate:()=>void}){
 const [open,setOpen]=useState(false),[imageError,setImageError]=useState(false);
 useEffect(()=>setImageError(false),[data?.warning?.issuedAt]);
 const w=data?.warning, active=w?.active&&!error&&Date.parse(w.expires)>Date.now(),unknown=error||!w||w.state==='unknown'||w.state==='expired';
 const impacted=[...new Set((data?.impacts?.items||[]).map((x:any)=>x.name))] as string[];
 return <section className={`typhoon-warning ${active?'warning-active':''}`} aria-label="颱風警報">
 <button className="warning-summary" onClick={()=>setOpen(!open)} aria-expanded={open} aria-controls="warning-content"><TriangleAlert size={18}/><span><strong>颱風警報</strong><small role="status">{unknown?'警報狀態待確認':active?w.headline:'目前未發布'}{impacted.length?` · ${impacted.length}縣市預測風圈可能觸及`:''}</small></span>{open?<ChevronUp size={18}/>:<ChevronDown size={18}/>}</button>
 <div className="agency-switch" role="group" aria-label="颱風資料來源">{['cwa','jma'].map(v=><button key={v} aria-pressed={agency===v} onClick={()=>setAgency(v)}>{v==='cwa'?'CWA 氣象署':'JMA 氣象廳'}</button>)}</div>
 {open&&<div id="warning-content" className="warning-content">
 <p className="warning-note">警報與影響區一律依 CWA 最新資料，不隨衛星回放時間改變。</p>
 <p className="warning-time">{data?.checkedAt?`查詢 ${tw(data.checkedAt)} · UTC+8`:'正在取得資料…'}</p>
 {unknown&&<p>連線或資料有效時間尚未確認，請以中央氣象署官網為準。</p>}
 {active&&<><p><b>發布：</b>{tw(w.issuedAt)} UTC+8<br/><b>有效至：</b>{tw(w.expires)} UTC+8</p>{w.sections.map((s:any,i:number)=><details key={i} className="warning-detail"><summary>{s.title}</summary><p>{s.text}</p></details>)}<details className="warning-detail"><summary>官方警報圖</summary>{w.imageUrl&&!imageError?<a href={w.web} target="_blank" rel="noreferrer"><img src={w.imageUrl} alt="中央氣象署最新颱風警報圖" loading="lazy" onError={()=>setImageError(true)}/></a>:<p>警報圖尚未完成時間核對，請查看官方警報頁。</p>}</details></>}
 {!active&&!unknown&&w?.issuedAt&&<p className="warning-note">前次公告：{w.lastHeadline} · {tw(w.issuedAt)} UTC+8。舊警報不當作目前警報。</p>}
 <details className="warning-detail" open><summary>地圖警示圖層</summary>
 {[['nearshore','近海約100公里參考範圍'],['official','CWA 官方警戒範圍'],['impact','預測風圈可能影響縣市']].map(([id,label])=><label className="warning-toggle" key={id}><input type="checkbox" checked={layers[id]} onChange={e=>setLayers({...layers,[id]:e.target.checked})}/>{label}</label>)}
 <p className="warning-note">橙色虛線為本站估算的近海參考線，不是官方海上警戒區。橙紅色實線為 API 提供的有效警戒多邊形；缺少座標時不代畫。</p>
 {active&&!w.polygons?.length&&<p className="warning-note">本報未提供可定位的警戒多邊形，海上範圍請看警報文字與官方警報圖。</p>}
 <button className="warning-locate" onClick={onLocate}><LocateFixed size={15}/>定位臺灣警戒範圍</button></details>
 <details className="warning-detail" open><summary>可能影響縣市 <span>本站估算</span></summary>
 {data?.trackStatus!=='ready'?<p>路徑資料尚未取得或已過期，暫不估算。</p>:impacted.length?<ul className="impact-list">{impacted.map(name=>{const entries=data.impacts.items.filter((x:any)=>x.name===name);return <li key={name}><b>{name}</b><span>{entries.map((x:any)=>`${x.storm} · 約 ${tw(x.time)} UTC+8`).join('；')}</span></li>})}</ul>:<p>{data?.impacts?.checked?'已提供的預測風圈未與縣市界相交；不代表沒有風雨影響。':'目前沒有可用的未來風圈資料。'}</p>}
 <p className="warning-note">{data?.impacts?.method}</p>{data?.impacts?.missing>0&&<p className="warning-note">部分時段缺少風圈，已跳過，不沿用現在的半徑。</p>}</details>
 <a className="warning-official-link" href="https://www.cwa.gov.tw/V8/C/P/Typhoon/TY_WARN.html" target="_blank" rel="noreferrer">中央氣象署官方警報 <ExternalLink size={13}/></a>
 </div>}
 </section>
}
