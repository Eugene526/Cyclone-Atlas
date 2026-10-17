import {useEffect} from 'react';
import VectorLayer from 'ol/layer/Vector';import VectorSource from 'ol/source/Vector';import GeoJSON from 'ol/format/GeoJSON';
import {Style,Stroke,Fill,Text} from 'ol/style';
export function useTyphoonWarningLayer(mapRef:any,data:any,layers:any,error:boolean){
 useEffect(()=>{const map=mapRef.current;if(!map)return;const source=new VectorSource(),layer=new VectorLayer({source,zIndex:12});map.addLayer(layer);let alive=true;
 const add=(json:any,color:string,fill:string,dash?:number[],kind='reference')=>{const fs=new GeoJSON().readFeatures(json,{featureProjection:'EPSG:3857'});for(const f of fs){f.setStyle(new Style({stroke:new Stroke({color,width:1.7,lineDash:dash}),fill:new Fill({color:fill})}));if(kind!=='reference')f.set('info',{kind:'warning-area',name:f.get('name'),text:kind==='impact'?'本站依 CWA 預測七級風圈估算，非官方警報。':kind==='official'?'CWA 官方有效警戒範圍。':'近海約100公里參考範圍，非官方海上警戒區。',items:data?.impacts?.items?.filter((v:any)=>v.name===f.get('name'))||[]});}source.addFeatures(fs)};
 if(layers.nearshore)fetch('/data/taiwan-nearshore.json').then(r=>r.json()).then((d:any)=>{if(alive)add(d,'#eab768','#eab7680a',[7,5])}).catch(()=>{});
 if(data&&!error){if(layers.official&&data.warning?.active)add({type:'FeatureCollection',features:data.warning.polygons||[]},'#ff8059','#ff805930',undefined,'official');
 if(layers.impact||layers.official)fetch('/data/taiwan-counties.json').then(r=>r.json()).then((d:any)=>{if(!alive)return;const names=new Set(layers.impact?data.impacts?.items?.map((v:any)=>v.name):[]);if(layers.impact)add({...d,features:d.features.filter((f:any)=>names.has(f.properties.name))},'#ff6f7e','#ee334a39',[4,3],'impact');if(layers.official&&data.warning.active)add({...d,features:d.features.filter((f:any)=>data.warning.officialCounties.includes(f.properties.name))},'#ff8059','#ff805930',undefined,'official')}).catch(()=>{});}
 return()=>{alive=false;map.removeLayer(layer)};
 },[mapRef,data,layers,error]);
}
