import polygonClipping from 'polygon-clipping';
import {destination,windRing} from './cwa-typhoon.mjs';
const circle=(lon,lat,km)=>{const ring=[];for(let a=0;a<360;a+=10)ring.push(destination(lon,lat,a,km));ring.push(ring[0]);return [ring]};
const feature=(name,geometry,extra={})=>({type:'Feature',properties:{name,...extra},geometry});
export function probabilityEnvelope(storm){
 const first=storm.forecast?.find(p=>p.probabilityKm>0);
 const points=[{...storm.current,probabilityKm:first?Math.min(20,Math.max(5,first.probabilityKm*.25)):0},...(storm.forecast||[])].filter(p=>p.probabilityKm!==null&&p.probabilityKm!==undefined);
 if(points.length<2)return null;
 const circles=[];
 for(let i=0;i<points.length-1;i++){
  const a=points[i],b=points[i+1],distance=Math.hypot((b.lon-a.lon)*100,(b.lat-a.lat)*111),steps=Math.max(1,Math.ceil(distance/20));
  for(let k=0;k<steps;k++){const t=k/steps,r=a.probabilityKm+(b.probabilityKm-a.probabilityKm)*t;if(r>=1)circles.push(circle(a.lon+(b.lon-a.lon)*t,a.lat+(b.lat-a.lat)*t,r));}
 }
 const last=points.at(-1);if(last.probabilityKm>=1)circles.push(circle(last.lon,last.lat,last.probabilityKm));
 if(!circles.length)return null;
 const result=polygonClipping.union(...circles);return feature(`${storm.name} 中心位置70%機率範圍連續外緣`,{type:'MultiPolygon',coordinates:result},{kind:'probability-envelope',stormId:storm.id});
}
export function seaWindOverlap(storms,seaZone){
 const geometry=seaZone.features[0].geometry,sea=geometry.type==='Polygon'?[geometry.coordinates]:geometry.coordinates,features=[];
 for(const storm of storms||[]){const polygons=[];
  for(const p of [storm.current,...storm.forecast]){const ring=windRing(p,'r15');if(!ring)continue;
   // 100 km reference zone is around Taiwan; skip distant tracks before clipping.
   const xs=ring.map(v=>v[0]),ys=ring.map(v=>v[1]);if(Math.max(...xs)<116||Math.min(...xs)>125||Math.max(...ys)<20||Math.min(...ys)>27)continue;
   const clipped=polygonClipping.intersection([ring],sea);if(clipped.length)polygons.push(...clipped);
  }
  if(polygons.length){const merged=polygonClipping.union(...polygons);features.push(feature(`${storm.name} 七級風圈與近海參考區重疊`,{type:'MultiPolygon',coordinates:merged},{kind:'wind-sea-overlap',stormId:storm.id,estimate:true}));}
 }
 return {type:'FeatureCollection',features};
}
