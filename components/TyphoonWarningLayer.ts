import {useEffect} from 'react';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import GeoJSON from 'ol/format/GeoJSON';
import {Style,Stroke,Fill} from 'ol/style';
export function useTyphoonWarningLayer(mapRef:any,data:any,layers:any,error:boolean,wind:boolean){
 useEffect(()=>{const map=mapRef.current;if(!map)return;const source=new VectorSource(),layer=new VectorLayer({source,zIndex:12});map.addLayer(layer);let alive=true;
 const add=(json:any,style:Style,kind?:string)=>{const fs=new GeoJSON().readFeatures(json,{featureProjection:'EPSG:3857'});for(const f of fs){f.setStyle(style);if(kind)f.set('info',{kind:'warning-area',name:f.get('name'),text:kind==='impact'?'本站依 CWA 預測七級風圈估算，非官方警報。':kind==='official'?'CWA 官方有效警戒範圍。':kind==='overlap'?'CWA 七級風圈與本站近海參考區域重疊，非官方警報。':'依使用者提供示意圖描繪的海警參考線，非官方海警邊界。',items:data?.impacts?.items?.filter((v:any)=>v.name===f.get('name'))||[]});}source.addFeatures(fs)};
 const seaStyle=new Style({stroke:new Stroke({color:'#7bb8e8',width:1.9,lineDash:[5,5]})});
 const countyStyle=new Style({stroke:new Stroke({color:'#dce9ed88',width:0.8}),fill:new Fill({color:'rgba(0,0,0,0)'})});
 const impactStyle=new Style({stroke:new Stroke({color:'#ff666e',width:1.2}),fill:new Fill({color:'rgba(222,44,58,.4)'})});
 const officialStyle=new Style({stroke:new Stroke({color:'#ff8059',width:1.7}),fill:new Fill({color:'rgba(255,128,89,.18)'})});
 const overlapStyle=new Style({stroke:new Stroke({color:'rgba(255,109,119,.45)',width:.7}),fill:new Fill({color:'rgba(255,85,100,.28)'})});
 // All 22 county boundaries are loaded once and drawn without the yellow island/shoreline artifacts.
 fetch('/data/taiwan-counties.json').then(r=>r.json()).then((d:any)=>{if(!alive)return;add(d,countyStyle);if(data&&!error){const names=new Set<string>(layers.impact?(data.impacts?.items||[]).map((v:any)=>v.name):[]);if(names.size)add({...d,features:d.features.filter((f:any)=>names.has(f.properties.name))},impactStyle,'impact');if(layers.official&&data.warning?.active)add({...d,features:d.features.filter((f:any)=>data.warning.officialCounties.includes(f.properties.name))},officialStyle,'official');}}).catch(()=>{});
 if(layers.nearshore)fetch('/data/taiwan-sea-line.json').then(r=>r.json()).then((d:any)=>{if(alive)add(d,seaStyle,'reference')}).catch(()=>{});
 if(data&&!error){if(layers.nearshore&&wind&&data.seaWindOverlap?.features?.length)add(data.seaWindOverlap,overlapStyle,'overlap');if(layers.official&&data.warning?.active&&data.warning.polygons?.length)add({type:'FeatureCollection',features:data.warning.polygons},officialStyle,'official');}
 return()=>{alive=false;map.removeLayer(layer)};
 },[mapRef,data,layers,error,wind]);
}
