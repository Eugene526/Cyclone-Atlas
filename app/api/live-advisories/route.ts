import {upstream} from '@/lib/upstream';
const ids=['W-C0033-001','W-C0033-002','W-C0033-003','W-C0033-004','W-C0033-005','W-C0033-006'];
const countyNames=['臺北市','新北市','桃園市','臺中市','臺南市','高雄市','基隆市','新竹市','新竹縣','苗栗縣','彰化縣','南投縣','雲林縣','嘉義市','嘉義縣','屏東縣','宜蘭縣','花蓮縣','臺東縣','澎湖縣','金門縣','連江縣'];
const county=(s:string)=>countyNames.find(n=>s.replaceAll('台','臺').startsWith(n))||null;
const when=(s:unknown)=>{if(typeof s!=='string')return NaN;return Date.parse(s.includes('T')?s:s.replace(' ','T')+'+08:00')};
const lamp=(info:any)=>{const value=info?.parameter?.find((p:any)=>p.valueName==='alert_color')?.value||'';return /紅/.test(value)?'red':/橙|橘/.test(value)?'orange':/黃/.test(value)?'yellow':/綠/.test(value)?'green':null};
let cache:{until:number,data:any}|null=null;
let pending:Promise<any>|null=null;
async function load(){
 if(cache&&cache.until>Date.now())return cache.data;
 if(pending)return pending;
 pending=(async()=>{
  const key=process.env.CWA_API_KEY;if(!key)throw Error('CWA 授權碼未設定');
  const responses=await Promise.allSettled(ids.map(async id=>{
   const r=await upstream(`https://opendata.cwa.gov.tw/api/v1/rest/datastore/${id}?Authorization=${encodeURIComponent(key)}`);
   if(!r.ok)throw Error(id+' '+r.status);return r.json();
  }));
  const now=Date.now(),items:any[]=[],bulletins:any[]=[],sources:any[]=[];
  responses.forEach((result,index)=>{
   const id=ids[index];sources.push({id,status:result.status==='fulfilled'?'ready':'unavailable'});
   if(result.status!=='fulfilled')return;
   const rec=(result.value as any).records||{};
   if(index===0){for(const loc of rec.location||[])for(const h of loc.hazardConditions?.hazards||[]){
    if(!(when(h.validTime?.startTime)<=now&&when(h.validTime?.endTime)>now))continue;
    const area=county(loc.locationName||'');if(!area)continue;
    items.push({area,title:[h.info?.phenomena,h.info?.significance].filter(Boolean).join(''),level:null,expires:new Date(when(h.validTime.endTime)).toISOString(),source:id});
   }}
   if(index===1){for(const record of rec.record||[]){const info=record.datasetInfo||{};
    if(!(when(info.validTime?.startTime)<=now&&when(info.validTime?.endTime)>now))continue;
    bulletins.push({title:info.datasetDescription||'天氣特報',text:String(record.contents?.content?.contentText||'').trim(),issuedAt:info.issueTime,source:id});
    for(const h of record.hazardConditions?.hazards?.hazard||[])for(const loc of h.info?.affectedAreas?.location||[]){const area=county(loc.locationName||'');if(area)items.push({area,title:[h.info?.phenomena,h.info?.significance].filter(Boolean).join(''),level:null,expires:new Date(when(info.validTime.endTime)).toISOString(),source:id})}
   }}
   if(index>=2){for(const info of rec.info||[]){
    if(!(when(info.effective)<=now&&when(info.expires)>now))continue;
    const title=info.headline||info.event||'天氣特報';
    const level=lamp(info);
    bulletins.push({title,text:info.description||'',level,issuedAt:info.effective,source:id});
    for(const a of info.area||[]){const area=county(a.areaDesc||'');if(area)items.push({area,district:a.areaDesc,title,level,expires:new Date(when(info.expires)).toISOString(),source:id})}
   }}
  });
  const unique=[...new Map(items.map(x=>[x.area+'|'+x.title+'|'+x.level,x])).values()];
  const uniqueBulletins=[...new Map(bulletins.map(x=>[x.title+'|'+x.text,x])).values()];
  const data={items:unique,bulletins:uniqueBulletins,sources,checkedAt:new Date().toISOString()};
  cache={data,until:Date.now()+180000};return data;
 })();try{return await pending}finally{pending=null}
}
export async function GET(){try{return Response.json(await load(),{headers:{'Cache-Control':'public,max-age=60,s-maxage=180'}})}catch{return Response.json({error:'特報資料暫時未取得'},{status:502})}}
