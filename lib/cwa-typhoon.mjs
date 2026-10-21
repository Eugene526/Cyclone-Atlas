// Pure normalizers: CWA W-C0034-005 (file API) and W-C0034-001 (CAP datastore).
export const arr = v => v == null ? [] : Array.isArray(v) ? v : [v];
const num = v => v == null || v === '' || v === '-' || !Number.isFinite(Number(v)) ? null : Number(v);
const positive = v => {const n=num(v);return n!==null&&n>=0?n:null};
const iso = v => Number.isFinite(Date.parse(v)) ? new Date(v).toISOString() : null;
export function radii(v) {
 if(!v)return null;
 const q=Object.fromEntries(arr(v.QuadrantRadii?.Radius).map(r=>[r['@dir'],positive(r['#text'])]));
 const quadrants=['NE','SE','SW','NW'].map(d=>q[d]??null), mean=positive(v.Radius);
 return mean===null&&quadrants.every(n=>n===null)?null:{mean,quadrants,asymmetric:quadrants.every(n=>n!==null)};
}
function fix(v,lead=0) {
 const lon=num(v.CoordinateLongitude),lat=num(v.CoordinateLatitude);
 const init=iso(v.InitialTime),time=iso(v.DateTime)||(init?new Date(Date.parse(init)+lead*3600000).toISOString():null);
 if(lon===null||lat===null||Math.abs(lat)>90||Math.abs(lon)>180||!time)return null;
 return {lon,lat,time,lead,windMs:positive(v.MaxWindSpeed),gustMs:positive(v.MaxGustSpeed),pressure:positive(v.Pressure),r15:radii(v.Circle15ms),r25:radii(v.Circle25ms),probabilityKm:positive(v.Radius70PercentProbability),movement:arr(v.MovingPrediction).find(x=>x['@lang']==='zh-hant')?.['#text']||'',speedKmh:positive(v.MovingSpeed),direction:v.MovingDirection||''};
}
export function normalizeCyclones(raw) {
 const root=raw?.cwaopendata;
 if(!root?.Dataset||!root.Dataset.TropicalCyclones)throw Error('CWA 路徑資料格式異常');
 const storms=arr(root.Dataset.TropicalCyclones.TropicalCyclone).map(c=>{
 const history=arr(c.AnalysisData?.Fix).map(v=>fix(v)).filter(Boolean).sort((a,b)=>Date.parse(a.time)-Date.parse(b.time));
 const current=history.at(-1);if(!current)return null;
 const forecast=arr(c.ForecastData?.Fix).filter(v=>num(v.ForecastHour)>0&&iso(v.InitialTime)===current.time).map(v=>fix(v,num(v.ForecastHour))).filter(Boolean).sort((a,b)=>a.lead-b.lead);
 return {id:`CWA${c.Year}${c.CwaTyNo||'TD'+c.CwaTdNo}`,name:c.CwaTyphoonName||c.TyphoonName||'熱帶性低氣壓',en:c.TyphoonName||'',number:c.CwaTyNo||null,issue:iso(root.Sent),current,history,forecast};
 }).filter(Boolean);
 return {storms,issuedAt:iso(root.Sent),source:'CWA W-C0034-005'};
}
const countyNames=['基隆市','臺北市','新北市','宜蘭縣','桃園市','新竹縣','新竹市','苗栗縣','臺中市','彰化縣','南投縣','雲林縣','嘉義縣','嘉義市','臺南市','高雄市','屏東縣','臺東縣','花蓮縣','澎湖縣','金門縣','連江縣'];
export function capPolygon(value) {
 const ring=String(value||'').trim().split(/\s+/).map(p=>p.split(',').map(Number)).map(([lat,lon])=>[lon,lat]);
 if(ring.length<3||ring.some(([x,y])=>!Number.isFinite(x)||!Number.isFinite(y)||Math.abs(x)>180||Math.abs(y)>90))return null;
 if(ring[0][0]!==ring.at(-1)[0]||ring[0][1]!==ring.at(-1)[1])ring.push(ring[0]);
 return {type:'Polygon',coordinates:[ring]};
}
function warningCategory(info,kind,now) {
 const sections=arr(info.description?.section).map(s=>({title:String(s.title||''),text:String(s.value||'')}));
 const fields=arr(info.description?.['typhoon-info']).flatMap(t=>arr(t.section));
 const type=String(fields.find(s=>s.title==='警報類別')?.value||'').toUpperCase();
 const headline=String(info.headline||''), token=kind==='sea'?'海上':'陸上';
 const explicit=type==='SEA'?'sea':type==='LAND'?'land':type==='END'?'end':null;
 const genericEnd=type==='END'||/解除颱風警報/.test(headline);
 if(explicit&&explicit!=='end'&&explicit!==kind)return null;
 if(!explicit&&!headline.includes(token)&&!genericEnd)return null;
 const issuedAt=iso(info.effective),expires=iso(info.expires);
 const ended=type==='END'||/解除/.test(`${headline} ${type}`)||info.urgency==='Past';
 const starts=!!issuedAt&&Date.parse(issuedAt)<=now,unexpired=!!expires&&Date.parse(expires)>now;
 const active=starts&&unexpired&&!ended,scheduled=!starts&&unexpired&&!ended;
 const areaNames=arr(info.area).map(a=>String(a.areaDesc||'').trim()).filter(Boolean);
 const bulletin=sections.map(s=>`${s.title}：${s.text}`).filter(Boolean).join('\n');
 const warningArea=sections.filter(s=>/警戒區|警戒事項/.test(s.title)).map(s=>s.text).filter(Boolean).join('；');
 const text=[areaNames.length?`CWA 公告範圍：${areaNames.join('、')}`:'',warningArea].filter(Boolean).join('\n');
 const state=active?'active':scheduled?'scheduled':ended?'ended':unexpired?'none':'expired';
 return {state,active,headline:headline||`${token}颱風警報`,issuedAt,expires,text,sections,bulletin,areaNames,sourceInfo:info};
}
export function normalizeWarning(raw,now=Date.now()) {
 if(raw?.success!=='true'&&raw?.success!==true)throw Error('CWA 警報資料格式異常');
 if(!raw.records||!('info' in raw.records))throw Error('CWA 警報狀態缺漏');
 const infos=arr(raw.records.info).filter(v=>v.language==='zh-TW'||!v.language).sort((a,b)=>Date.parse(b.effective)-Date.parse(a.effective));
 if(!infos.length)return {state:'none',active:false,headline:'目前未發布颱風警報',sections:[],polygons:[],officialCounties:[]};
 const latest=(kind)=>infos.map(i=>({i,warning:warningCategory(i,kind,now)})).find(x=>x.warning)?.warning||{state:'none',active:false,headline:`目前未發布${kind==='sea'?'海上':'陸上'}颱風警報`,issuedAt:null,expires:null,text:'',sections:[]};
 const sea=latest('sea'),land=latest('land'),active=sea.active||land.active;
 const activeInfos=[...new Set([sea,land].filter(x=>x.active).map(x=>x.sourceInfo))];
 const warningInfos=infos.filter(i=>warningCategory(i,'sea',now)||warningCategory(i,'land',now));
 const i=warningInfos[0]||infos[0],sections=arr(i.description?.section).map(s=>({title:String(s.title||''),text:String(s.value||'')}));
 const landText=land.active?land.text.replaceAll('台','臺'):'';
 const polygons=activeInfos.flatMap(info=>arr(info.area).flatMap(a=>arr(a.polygon).map(capPolygon).filter(Boolean).map(geometry=>({type:'Feature',properties:{name:a.areaDesc||'CWA警戒範圍',official:true},geometry}))));
 const state=active?'active':sea.state==='scheduled'||land.state==='scheduled'?'scheduled':sea.state==='expired'||land.state==='expired'?'expired':sea.state==='ended'||land.state==='ended'?'ended':'none';
 const latestActive=[sea,land].filter(x=>x.active).sort((a,b)=>Date.parse(b.issuedAt)-Date.parse(a.issuedAt))[0];
 const headline=active?[sea.active&&'海上颱風警報',land.active&&'陸上颱風警報'].filter(Boolean).join('、'):state==='scheduled'?'颱風警報尚未生效':state==='ended'?'目前未發布颱風警報（前次已解除）':state==='expired'?'警報資料已逾有效時間，請查官方最新資訊':'目前未發布颱風警報';
 const seaView={...sea},landView={...land};delete seaView.sourceInfo;delete landView.sourceInfo;
 return {state,active,headline,lastHeadline:i.headline,issuedAt:latestActive?.issuedAt||iso(i.effective),expires:latestActive?.expires||iso(i.expires),sea:seaView,land:landView,sections,bulletin:sections.map(s=>`${s.title}：${s.text}`).filter(Boolean).join('\n'),seaText:sea.text,landText,officialCounties:land.active?countyNames.filter(n=>landText.includes(n)):[],polygons,web:'https://www.cwa.gov.tw/V8/C/P/Typhoon/TY_WARN.html'};
}
export function destination(lon,lat,bearing,km) {
 const r=Math.PI/180,a=km/6371.0088,p=lat*r,l=lon*r,b=bearing*r;
 const q=Math.asin(Math.sin(p)*Math.cos(a)+Math.cos(p)*Math.sin(a)*Math.cos(b));
 return [(l+Math.atan2(Math.sin(b)*Math.sin(a)*Math.cos(p),Math.cos(a)-Math.sin(p)*Math.sin(q)))/r,q/r];
}
export function windRing(point,field='r15') {
 const r=point[field];if(!r)return null;
 // Four independent sectors retain published asymmetric radii. Never replace missing quadrants by zero.
 if(!r.asymmetric&&r.mean===null)return null;
 const ring=[];
 for(let q=0;q<4;q++)for(let angle=q*90;angle<=q*90+90;angle+=5)ring.push(destination(point.lon,point.lat,angle,r.asymmetric?r.quadrants[q]:r.mean));
 ring.push(ring[0]);return ring;
}
function bbox(r){return [Math.min(...r.map(v=>v[0])),Math.min(...r.map(v=>v[1])),Math.max(...r.map(v=>v[0])),Math.max(...r.map(v=>v[1]))]}
function pointInside(p,r){let c=false;for(let i=0,j=r.length-1;i<r.length;j=i++){const a=r[i],b=r[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])c=!c}return c}
function cross(a,b,c){return(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])}
function segments(a,b,c,d){const x=cross(a,b,c),y=cross(a,b,d),z=cross(c,d,a),w=cross(c,d,b);if(Math.max(a[0],b[0])<Math.min(c[0],d[0])||Math.max(c[0],d[0])<Math.min(a[0],b[0])||Math.max(a[1],b[1])<Math.min(c[1],d[1])||Math.max(c[1],d[1])<Math.min(a[1],b[1]))return false;return x*y<=0&&z*w<=0}
export function intersects(ring,geometry){
 const b=bbox(ring),polys=geometry.type==='Polygon'?[geometry.coordinates]:geometry.type==='MultiPolygon'?geometry.coordinates:[];
 for(const poly of polys){const outer=poly[0],c=bbox(outer);if(b[2]<c[0]||b[0]>c[2]||b[3]<c[1]||b[1]>c[3])continue;
 if(ring.some(p=>pointInside(p,outer)&&!poly.slice(1).some(h=>pointInside(p,h)))||outer.some(p=>pointInside(p,ring)))return true;
 for(const boundary of poly)for(let i=1;i<ring.length;i++)for(let j=1;j<boundary.length;j++)if(segments(ring[i-1],ring[i],boundary[j-1],boundary[j]))return true;
 }return false;
}
function mixRadius(a,b,t){if(!a||!b)return null;const mean=a.mean!==null&&b.mean!==null?a.mean+(b.mean-a.mean)*t:null;const asymmetric=a.asymmetric&&b.asymmetric;return {mean,asymmetric,quadrants:asymmetric?a.quadrants.map((v,i)=>v+(b.quadrants[i]-v)*t):[null,null,null,null]}}
export function forecastImpacts(storms,counties,now=Date.now()) {
 const found=new Map();let checked=0,missing=0;
 for(const s of storms){if(now-Date.parse(s.current.time)>18*3600000)continue;const points=[s.current,...s.forecast];
 for(let i=0;i<points.length;i++){
 const a=points[i],b=points[i+1];const travel=b?Math.hypot((b.lon-a.lon)*100,(b.lat-a.lat)*111):0;
 const steps=b?Math.min(192,Math.max(1,Math.ceil((Date.parse(b.time)-Date.parse(a.time))/3600000),Math.ceil(travel/10))):1;
 for(let k=0;k<steps;k++){const t=k/steps,p=b?{...a,lon:a.lon+(b.lon-a.lon)*t,lat:a.lat+(b.lat-a.lat)*t,time:new Date(Date.parse(a.time)+(Date.parse(b.time)-Date.parse(a.time))*t).toISOString(),r15:k===0?a.r15:mixRadius(a.r15,b.r15,t)}:a;
 if(Date.parse(p.time)<now)continue;const ring=windRing(p);if(!ring){missing++;continue}checked++;
 for(const f of counties.features){if(intersects(ring,f.geometry)){const name=f.properties.name,key=s.id+'|'+name;if(!found.has(key))found.set(key,{name,storm:s.name,stormId:s.id,time:p.time,estimated:k>0,meanRadius:!p.r15.asymmetric});}}
 }} }
 return {items:[...found.values()].sort((a,b)=>Date.parse(a.time)-Date.parse(b.time)),checked,missing,method:'本站依 CWA 七級風預測風圈與簡化縣市界相交估算；時段間線性插值，約每小時／10公里取樣，不含70%機率圓。不代表官方警報或實際地面風速。'};
}
