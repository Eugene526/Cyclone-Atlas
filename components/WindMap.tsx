'use client';
import {useEffect,useRef} from 'react';
import Map from 'ol/Map';import View from 'ol/View';import VectorLayer from 'ol/layer/Vector';import VectorSource from 'ol/source/Vector';import GeoJSON from 'ol/format/GeoJSON';import {Style,Stroke,Fill} from 'ol/style';import {fromLonLat} from 'ol/proj';import {defaults as controls} from 'ol/control';
import {sampleWind,windColor} from '@/lib/wind-data.mjs';
import 'ol/ol.css';
const M=111319.49079327358;
const geo=(c:number[])=>[c[0]/M,(2*Math.atan(Math.exp(c[1]/6378137))-Math.PI/2)*180/Math.PI];
export default function WindMap(p:{data:any;hour:number;motion:boolean;onBounds:(b:number[])=>void;onPoint:(p:any)=>void;onReady:(a:any)=>void}){
 const host=useRef<HTMLDivElement>(null),heat=useRef<HTMLCanvasElement>(null),flow=useRef<HTMLCanvasElement>(null),map=useRef<Map|null>(null),current=useRef(p),dirty=useRef(true);current.current=p;
 useEffect(()=>{
  const m=new Map({target:host.current!,layers:[new VectorLayer({source:new VectorSource({url:'/data/land.json',format:new GeoJSON()}),style:new Style({fill:new Fill({color:'rgba(12,24,39,.12)'})})}),new VectorLayer({source:new VectorSource({url:'/data/coastline.json',format:new GeoJSON()}),style:new Style({stroke:new Stroke({color:'rgba(224,237,240,.7)',width:.8})})})],view:new View({center:fromLonLat([135,21]),zoom:3.8,minZoom:1,maxZoom:8,multiWorld:true}),controls:controls({zoom:false,rotate:false,attribution:false})});map.current=m;
  const bounds=()=>{const e=m.getView().calculateExtent(m.getSize()),w=(e[0]+e[2])/2/M,span=Math.min(360,(e[2]-e[0])/M*1.04),s=geo([0,e[1]])[1],n=geo([0,e[3]])[1];current.current.onBounds([Math.floor((w-span/2)*4)/4,Math.max(-85,Math.floor(s*4)/4),Math.ceil((w+span/2)*4)/4,Math.min(85,Math.ceil(n*4)/4)].map((x,i)=>i===2&&span>=359.99?Math.floor((w-span/2)*4)/4+360:x));dirty.current=true;};
  m.on('moveend',bounds);m.on('postrender',()=>{dirty.current=true});m.on('singleclick',e=>{const [lon,lat]=geo(e.coordinate),q=current.current,d=q.data,frame=d?.frames[q.hour],value=frame?sampleWind(d.grid,frame,lon,lat):null;current.current.onPoint({lon:((lon+180)%360+360)%360-180,lat,value,x:e.pixel[0],y:e.pixel[1],width:m.getSize()?.[0],height:m.getSize()?.[1]});});
  current.current.onReady({zoom:(d:number)=>m.getView().animate({zoom:(m.getView().getZoom()||3)+d,duration:200}),region:(id:string)=>{const presets:any={taiwan:[121,23,5],pacific:[140,20,3],world:[0,10,1.5],europe:[10,45,3.5],atlantic:[-65,25,3]};const [lon,lat,z]=presets[id]||presets.pacific;m.getView().animate({center:fromLonLat([lon,lat]),zoom:z,duration:300})}});
  let raf=0,last=0;let particles:{x:number;y:number;life:number}[]=[];let oldSize='';
  const draw=(now:number)=>{
   raf=requestAnimationFrame(draw);if(now-last<33||document.hidden)return;const dt=Math.min(.06,(now-last)/1000||.033);last=now;
   const size=m.getSize();if(!size||!heat.current||!flow.current)return;const [w,h]=size,key=w+'|'+h;
   if(key!==oldSize){oldSize=key;for(const c of [heat.current,flow.current]){c.width=Math.ceil(w);c.height=Math.ceil(h)}particles=Array.from({length:Math.min(1300,Math.floor(w*h/600))},()=>({x:Math.random()*w,y:Math.random()*h,life:Math.random()*100}));dirty.current=true;}
   const q=current.current,data=q.data,frame=data?.frames[q.hour];const ctx=flow.current.getContext('2d')!;
   if(dirty.current){dirty.current=false;ctx.clearRect(0,0,w,h);const hc=heat.current.getContext('2d')!;hc.clearRect(0,0,w,h);
    if(frame){const scale=4,rw=Math.ceil(w/scale),rh=Math.ceil(h/scale),small=document.createElement('canvas');small.width=rw;small.height=rh;const sc=small.getContext('2d')!,image=sc.createImageData(rw,rh),extent=m.getView().calculateExtent(size);
     for(let y=0;y<rh;y++)for(let x=0;x<rw;x++){const lon=(extent[0]+(x+.5)/rw*(extent[2]-extent[0]))/M,lat=geo([0,extent[3]-(y+.5)/rh*(extent[3]-extent[1])])[1],v=sampleWind(data.grid,frame,lon,lat);if(!v)continue;const rgb=windColor(v.speed),i=(y*rw+x)*4;image.data[i]=rgb[0];image.data[i+1]=rgb[1];image.data[i+2]=rgb[2];image.data[i+3]=235;}sc.putImageData(image,0,0);hc.imageSmoothingEnabled=true;hc.drawImage(small,0,0,w,h);
    }
   }
   if(!frame||!q.motion){ctx.clearRect(0,0,w,h);return;}
   ctx.globalCompositeOperation='destination-in';ctx.fillStyle='rgba(0,0,0,.92)';ctx.fillRect(0,0,w,h);ctx.globalCompositeOperation='source-over';ctx.strokeStyle='rgba(245,253,255,.68)';ctx.lineWidth=.85;ctx.beginPath();const resolution=m.getView().getResolution()!;
   for(const particle of particles){const coordinate=m.getCoordinateFromPixel([particle.x,particle.y]),[lon,lat]=geo(coordinate),value=sampleWind(data.grid,frame,lon,lat);
    if(!value||particle.life--<0||particle.x<0||particle.x>w||particle.y<0||particle.y>h){particle.x=Math.random()*w;particle.y=Math.random()*h;particle.life=30+Math.random()*90;continue;}
    // Accelerated visual advection, not a prediction of real parcel travel time.
    const factor=dt*2.2/Math.max(.35,Math.cos(lat*Math.PI/180));const nx=particle.x+value.u*factor,ny=particle.y-value.v*factor;ctx.moveTo(particle.x,particle.y);ctx.lineTo(nx,ny);particle.x=nx;particle.y=ny;
   }ctx.stroke();
  };raf=requestAnimationFrame(draw);bounds();
  const resize=new ResizeObserver(()=>{m.updateSize();dirty.current=true});resize.observe(host.current!);
  return()=>{cancelAnimationFrame(raf);resize.disconnect();m.setTarget(undefined);map.current=null;};
 },[]);
 useEffect(()=>{dirty.current=true},[p.data,p.hour,p.motion]);
 return <div className="wind-stage"><canvas ref={heat} className="wind-raster" aria-hidden="true"/><div ref={host} className="wind-map" aria-label="可移動縮放的全球風場地圖"/><canvas ref={flow} className="wind-flow" aria-hidden="true"/></div>;
}
