import {forecastImpacts} from '@/lib/cwa-typhoon.mjs';
import {probabilityEnvelope,seaWindOverlap} from '@/lib/cwa-geometries.mjs';

const radius=(mean:number)=>({mean,quadrants:[mean*1.15,mean*.9,mean*.8,mean*1.05],asymmetric:true});

/** Synthetic, clearly labelled fixture for previewing warning and map UI. */
export function makeSimulatedTyphoonData(counties:any,seaZone:any,now=Date.now()){
 const issuedAt=new Date(now-30*60_000).toISOString();
 const currentTime=new Date(now-3*60*60_000).toISOString();
 const track=[
  {lead:0,lon:124.4,lat:20.8,windMs:35,gustMs:48,pressure:970,km15:210,km25:95,probabilityKm:0},
  {lead:6,lon:123.5,lat:21.8,windMs:38,gustMs:52,pressure:965,km15:225,km25:105,probabilityKm:55},
  {lead:12,lon:122.5,lat:22.8,windMs:40,gustMs:55,pressure:960,km15:235,km25:115,probabilityKm:85},
  {lead:18,lon:121.7,lat:23.7,windMs:38,gustMs:52,pressure:965,km15:225,km25:105,probabilityKm:115},
  {lead:24,lon:121.3,lat:24.7,windMs:33,gustMs:45,pressure:975,km15:200,km25:90,probabilityKm:145},
 ].map(p=>({lon:p.lon,lat:p.lat,time:new Date(Date.parse(currentTime)+p.lead*3600_000).toISOString(),lead:p.lead,windMs:p.windMs,gustMs:p.gustMs,pressure:p.pressure,r15:radius(p.km15),r25:radius(p.km25),probabilityKm:p.probabilityKm,movement:'西北西',speedKmh:18,direction:'西北西'}));
 const storm={id:'SIM-2026-01',name:'模擬颱風・海棠',en:'SIMULATED TYPHOON',number:'SIM01',issue:issuedAt,current:track[0],history:[
  {...track[0],time:new Date(Date.parse(currentTime)-12*3600_000).toISOString(),lon:126.0,lat:19.6,lead:-12},
  {...track[0],time:new Date(Date.parse(currentTime)-6*3600_000).toISOString(),lon:125.2,lat:20.1,lead:-6},
 ],forecast:track.slice(1)};
 const impacts=forecastImpacts([storm],counties,now);
 const envelope=probabilityEnvelope(storm);
 const warningPolygon={type:'Feature',properties:{name:'模擬海上警戒範圍',official:true},geometry:{type:'Polygon',coordinates:[[[119.5,20.1],[123.8,20.1],[124.7,22.7],[123.1,25.7],[121.6,25.9],[120.3,24.2],[119.5,20.1]]]}};
 return {
  warning:{state:'active',active:true,headline:'模擬颱風警報｜海棠',lastHeadline:'模擬颱風警報｜海棠',issuedAt,expires:new Date(now+8*3600_000).toISOString(),type:'SIMULATION',sections:[
   {title:'海上颱風警報',text:'模擬情境：預測颱風中心將接近臺灣東南部海域，請留意海上活動與最新天氣資訊。'},
   {title:'陸上警戒資訊',text:'模擬情境：預測風圈可能影響臺東縣、花蓮縣及屏東縣，實際警戒區域以官方公告為準。'},
  ],seaText:'模擬海上警戒範圍',landText:'臺東縣 花蓮縣 屏東縣 宜蘭縣',officialCounties:['臺東縣','花蓮縣','屏東縣','宜蘭縣'],polygons:[warningPolygon],chartAvailable:true,imageUrl:'/data/emulate-warning.svg',web:'https://www.cwa.gov.tw/V8/C/P/Typhoon/TY_WARN.html'},
  storms:[storm],trackStatus:'ready',issuedAt,checkedAt:new Date(now).toISOString(),impacts,
  probabilityEnvelopes:envelope?[envelope]:[],seaWindOverlap:seaWindOverlap([storm],seaZone),
  sources:{warning:'模擬資料',track:'模擬資料'},simulation:true,
 };
}
