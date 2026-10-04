import XYZ from 'ol/source/XYZ';
import TileGrid from 'ol/tilegrid/TileGrid';
import { globalFrame } from './global-satellite.mjs';
import { lut } from './satellite';
const sources=new Map<string,XYZ>();
// The composite is display-coded grayscale, NOT calibrated brightness temperature.
// Preserve one fixed transfer function globally; never histogram-stretch each tile.
export function globalImagery(time:string,mode:string) {
 const frame=globalFrame(time),key=frame+'|'+mode;
 const cached=sources.get(key);if(cached)return cached;
 const source=new XYZ({projection:"EPSG:4326",tileGrid:new TileGrid({extent:[-180,-90,180,90],origin:[-180,90],tileSize:256,resolutions:Array.from({length:7},(_,z)=>360/(256*2**z))}),wrapX:true,crossOrigin:'anonymous',transition:0,
  url:`/api/global-tile?time=${encodeURIComponent(frame)}&mode=${mode==='rgb'?'rgb':'ir'}&z={z}&x={x}&y={y}`,
  tileLoadFunction:(tile:any,url)=>{
   const out=tile.getImage();
   if(mode!=='ott'){out.src=url;return}
   const img=new Image();img.crossOrigin='anonymous';
   img.onload=()=>{
    try{
     const c=document.createElement('canvas');c.width=img.width;c.height=img.height;
     const ctx=c.getContext('2d')!;ctx.drawImage(img,0,0);const data=ctx.getImageData(0,0,c.width,c.height);
     for(let i=0;i<data.data.length;i+=4){const color=lut[data.data[i]];data.data[i]=color[0];data.data[i+1]=color[1];data.data[i+2]=color[2]}
     ctx.putImageData(data,0,0);out.src=c.toDataURL();
    }catch{tile.setState(3)}
   };img.onerror=()=>tile.setState(3);img.src=url;
  }
 });sources.set(key,source);if(sources.size>32)sources.delete(sources.keys().next().value!);return source;
}
