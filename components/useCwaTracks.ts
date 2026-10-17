import {useEffect} from 'react';
import VectorLayer from 'ol/layer/Vector';import VectorSource from 'ol/source/Vector';import Feature from 'ol/Feature';import {Point,LineString,Polygon} from 'ol/geom';import {fromLonLat} from 'ol/proj';import GeoJSON from 'ol/format/GeoJSON';import {Style,Stroke,Fill,Circle,Text} from 'ol/style';import {windRing} from '@/lib/cwa-typhoon.mjs';
export function useCwaTracks(mapRef:any,data:any,enabled:boolean,wind:boolean,forecast:boolean,history:boolean){
 useEffect(()=>{const map=mapRef.current;if(!map||!enabled||!data)return;const source=new VectorSource(),layer=new VectorLayer({source,zIndex:15});map.addLayer(layer);
 const add=(geometry:any,color:string,fill?:string,dash?:number[])=>{const f=new Feature(geometry);f.setStyle(new Style({stroke:new Stroke({color,width:1.5,lineDash:dash}),fill:fill?new Fill({color:fill}):undefined}));source.addFeature(f);return f};
 for(const s of data.storms||[]){
 const point=(p:any)=>fromLonLat([p.lon,p.lat]);
 if(history&&s.history.length>1)add(new LineString(s.history.map(point)),'#e9c775',undefined,[3,4]);
 if(forecast)add(new LineString([s.current,...s.forecast].map(point)),'#fff',undefined,[6,4]);
 if(forecast){const envelope=data.probabilityEnvelopes?.find((v:any)=>v.properties?.stormId===s.id);if(envelope){const fs=new GeoJSON().readFeatures({type:'FeatureCollection',features:[envelope]},{featureProjection:'EPSG:3857'});for(const f of fs){f.setStyle(new Style({stroke:new Stroke({color:'#dbe8f4',width:1.8,lineDash:[5,4]}),fill:new Fill({color:'rgba(219,232,244,.07)'})}));source.addFeature(f)}}}
 const points=[s.current,...(forecast?s.forecast:[])];
 for(const p of points){const current=p===s.current;
 if(wind&&current){for(const [key,color] of [['r15','#f4c460'],['r25','#ff795f']]){const ring=windRing(p,key);if(ring)add(new Polygon([ring.map((v:number[])=>fromLonLat(v))]),color,current?color+'1a':undefined,current?undefined:[3,4])}}

 const f=new Feature(new Point(point(p)));f.set('info',{kind:'cwa',name:s.name,point:p,issue:s.issue});f.setStyle(new Style({image:new Circle({radius:current?6:4,fill:new Fill({color:current?'#ff9c7c':'#fff'}),stroke:new Stroke({color:'#10202f',width:2})}),text:current?new Text({text:s.name,offsetY:-20,font:'600 12px sans-serif',fill:new Fill({color:'#fff'}),stroke:new Stroke({color:'#0e1721',width:3})}):undefined}));source.addFeature(f);
 }
 if(history)for(const p of s.history.slice(0,-1)){const f=new Feature(new Point(point(p)));f.set('info',{kind:'cwa',name:s.name,point:{...p,history:true},issue:s.issue});f.setStyle(new Style({image:new Circle({radius:3,fill:new Fill({color:'#e9c775'}),stroke:new Stroke({color:'#172332',width:1})})}));source.addFeature(f)}
 }
 return()=>{map.removeLayer(layer)};
 },[mapRef,data,enabled,wind,forecast,history]);
}
