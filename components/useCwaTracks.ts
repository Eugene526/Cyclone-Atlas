import {useEffect} from 'react';
import {unwrapTrack} from '@/lib/track-geometry.mjs';
import VectorLayer from 'ol/layer/Vector';import VectorSource from 'ol/source/Vector';import Feature from 'ol/Feature';import {Point,LineString,Polygon} from 'ol/geom';import {fromLonLat} from 'ol/proj';import GeoJSON from 'ol/format/GeoJSON';import {Style,Stroke,Fill,Circle,Text} from 'ol/style';import {windRing} from '@/lib/cwa-typhoon.mjs';
export function useCwaTracks(mapRef:any,data:any,enabled:boolean,wind:boolean,forecast:boolean,history:boolean,showCurrent=true,showForecastTimestamp=false){
 useEffect(()=>{const map=mapRef.current;if(!map||!enabled||!data)return;const source=new VectorSource(),layer=new VectorLayer({source,zIndex:15});map.addLayer(layer);
 const add=(geometry:any,color:string,fill?:string,dash?:number[])=>{const f=new Feature(geometry);f.setStyle(new Style({stroke:new Stroke({color,width:1.5,lineDash:dash}),fill:fill?new Fill({color:fill}):undefined}));source.addFeature(f);return f};
 for(const s of data.storms||[]){
 const point=(p:any)=>fromLonLat([p.lon,p.lat]);
 const callout=(coord:number[],text:string,index:number)=>{const origin=fromLonLat(coord),pixel=map.getPixelFromCoordinate(origin);if(!pixel)return;const side=index%2===0?1:-1,anchor=map.getCoordinateFromPixel([pixel[0]+side*112,pixel[1]+(index%3===0?-34:34)]);if(!anchor)return;add(new LineString([origin,anchor]),'rgba(235,246,250,.9)');const label=new Feature(new Point(anchor));const makeStyle=(size:number)=>new Style({text:new Text({text,font:`700 ${size}px sans-serif`,textAlign:side>0?'left':'right',offsetX:side*5,fill:new Fill({color:'#f4fbff'}),stroke:new Stroke({color:'#10202a',width:size>12?5:3}),backgroundFill:new Fill({color:'rgba(9,25,36,.94)'}),backgroundStroke:new Stroke({color:'rgba(210,233,240,.86)',width:size>12?2:1}),padding:size>12?[8,11,8,11]:[4,6,4,6]})});label.set('exportStyle',makeStyle(25));label.setStyle(makeStyle(11));source.addFeature(label)};
 if(history&&s.history.length>1)add(new LineString(unwrapTrack(s.history).map((v:number[])=>fromLonLat(v))),'#63c5f2');
 if(forecast)add(new LineString(unwrapTrack([s.current,...s.forecast]).map((v:number[])=>fromLonLat(v))),'#ff8c78');
 if(forecast){const envelope=data.probabilityEnvelopes?.find((v:any)=>v.properties?.stormId===s.id);if(envelope){const fs=new GeoJSON().readFeatures({type:'FeatureCollection',features:[envelope]},{featureProjection:'EPSG:3857'});for(const f of fs){f.setStyle(new Style({stroke:new Stroke({color:'#dbe8f4',width:1.8,lineDash:[5,4]}),fill:new Fill({color:'rgba(219,232,244,.07)'})}));source.addFeature(f)}}}
 const points=[s.current,...(forecast?s.forecast:[])];
 for(const [index,p] of points.entries()){const current=p===s.current;
 // The 70% probability circles are replaced by one envelope above; both
 // current and forecast seven-/ten-level wind circles remain independent.
 if(wind){for(const [key,color,fill] of [['r15','#ffdc55','rgba(255,217,72,.20)'],['r25','#ff626f','rgba(255,67,83,.24)']]){const ring=windRing(p,key);if(ring)add(new Polygon([ring.map((v:number[])=>fromLonLat(v))]),color,fill)}}
 if(forecast&&!current){const stamp=showForecastTimestamp&&p.time?`${new Intl.DateTimeFormat('zh-TW',{timeZone:'Asia/Taipei',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(p.time))} UTC+8`:null;const details=[stamp,p.windMs!=null?`${p.windMs} m/s`:null,p.pressure!=null?`${p.pressure} hPa`:null].filter(Boolean).join(' · ');callout([p.lon,p.lat],details,index)}

 if(!current||showCurrent){const f=new Feature(new Point(point(p)));f.set('info',{kind:'cwa',name:s.name,point:p,issue:s.issue});f.setStyle(new Style({image:new Circle({radius:current?6:4,fill:new Fill({color:current?'#ff9c7c':'#fff'}),stroke:new Stroke({color:'#10202f',width:2})}),text:current?new Text({text:s.name,offsetY:-20,font:'600 12px sans-serif',fill:new Fill({color:'#fff'}),stroke:new Stroke({color:'#0e1721',width:3})}):undefined}));source.addFeature(f)}
 }
 if(history)for(const p of s.history.slice(0,-1)){const f=new Feature(new Point(point(p)));f.set('info',{kind:'cwa',name:s.name,point:{...p,history:true},issue:s.issue});f.setStyle(new Style({image:new Circle({radius:3,fill:new Fill({color:'#e9c775'}),stroke:new Stroke({color:'#172332',width:1})})}));source.addFeature(f)}
 }
 return()=>{map.removeLayer(layer)};
 },[mapRef,data,enabled,wind,forecast,history,showCurrent,showForecastTimestamp]);
}
