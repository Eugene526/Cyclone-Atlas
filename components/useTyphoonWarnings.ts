'use client';
import {useEffect,useState} from 'react';
export function useTyphoonWarnings(){
 const [data,setData]=useState<any>(null),[error,setError]=useState(false);
 useEffect(()=>{let alive=true,controller:AbortController|null=null;async function update(){controller?.abort();controller=new AbortController();try{const r=await fetch('/api/cwa-typhoon',{cache:'no-store',signal:controller.signal});if(!r.ok)throw Error();const d:any=await r.json();if(!d.warning||!Array.isArray(d.storms))throw Error();if(alive){setData(d);setError(false)}}catch(e:any){if(alive&&e.name!=='AbortError')setError(true)}}update();const t=setInterval(()=>{if(document.visibilityState==='visible')update()},60000);const resume=()=>{if(document.visibilityState==='visible')update()};document.addEventListener('visibilitychange',resume);return()=>{alive=false;clearInterval(t);controller?.abort();document.removeEventListener('visibilitychange',resume)}},[]);
 return {data,error};
}
