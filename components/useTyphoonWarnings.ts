'use client';
import {useEffect,useState} from 'react';
import {makeSimulatedTyphoonData} from '@/lib/simulated-typhoon';
export function useTyphoonWarnings(simulate=false){
 const [data,setData]=useState<any>(null),[error,setError]=useState(false);
 useEffect(()=>{let alive=true,controller:AbortController|null=null;if(simulate){Promise.all([fetch('/data/taiwan-counties.json').then(r=>r.json()),fetch('/data/taiwan-sea-zone.json').then(r=>r.json())]).then(([counties,seaZone])=>{if(alive){setData(makeSimulatedTyphoonData(counties,seaZone));setError(false)}}).catch(()=>{if(alive)setError(true)});return()=>{alive=false}}async function update(){controller?.abort();controller=new AbortController();try{const r=await fetch('/api/cwa-typhoon',{signal:controller.signal});if(!r.ok)throw Error();const d:any=await r.json();if(!d.warning||!Array.isArray(d.storms))throw Error();if(alive){setData(d);setError(false)}}catch(e:any){if(alive&&e.name!=='AbortError')setError(true)}}update();const t=setInterval(()=>{if(document.visibilityState==='visible')update()},180000);const resume=()=>{if(document.visibilityState==='visible')update()};document.addEventListener('visibilitychange',resume);return()=>{alive=false;clearInterval(t);controller?.abort();document.removeEventListener('visibilitychange',resume)}},[simulate]);
 return {data,error};
}
