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
export function normalizeWarning(raw,now=Date.now()) {
 if(raw?.success!=='true'&&raw?.success!==true)throw Error('CWA 警報資料格式異常');
 if(!raw.records||!('info' in raw.records))throw Error('CWA 警報狀態缺漏');
 const infos=arr(raw.records.info).filter(v=>v.language==='zh-TW'||!v.language).sort((a,b)=>Date.parse(b.effective)-Date.parse(a.effective));
 if(!infos.length)return {state:'none',active:false,headline:'目前未發布颱風警報',sections:[],polygons:[],officialCounties:[]};
 const i=infos[0], sections=arr(i.description?.section).map(s=>({title:String(s.title||''),text:String(s.value||'')}));
 const type=arr(i.description?.['typhoon-info']).flatMap(t=>arr(t.section)).find(s=>s.title==='警報類別')?.value;
 const issuedAt=iso(i.effective),expires=iso(i.expires),ended=type==='END'||/解除/.test(i.headline||'')||i.urgency==='Past';
 const valid=issuedAt&&expires&&Date.parse(issuedAt)<=now&&Date.parse(expires)>now;
 const active=!!valid&&!ended;
 const state=active?'active':ended?'ended':!valid?'expired':'unknown';
 // CAP delivery geocodes often list all Taiwan. Use explicit LAND warning text, not delivery areas.
 const landText=sections.filter(s=>/陸上警戒|陸上警報|陸上警戒區/.test(s.title)).map(s=>s.text).join(' ').replaceAll('台','臺');
 const seaText=sections.filter(s=>/海上警戒|海上警報|海上警戒區/.test(s.title)).map(s=>s.text).join(' ');
 const polygons=active?arr(i.area).flatMap(a=>arr(a.polygon).map(capPolygon).filter(Boolean).map(geometry=>({type:'Feature',properties:{name:a.areaDesc||'CWA警戒範圍',official:true},geometry}))):[];
 return {state,active,headline:active?String(i.headline||'颱風警報'):ended?'目前未發布颱風警報（前次已解除）':'警報資料已逾有效時間，請查官方最新資訊',lastHeadline:i.headline,issuedAt,expires,type,sections,seaText,landText,officialCounties:active?countyNames.filter(n=>landText.includes(n)):[],polygons,web:'https://www.cwa.gov.tw/V8/C/P/Typhoon/TY_WARN.html'};
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
