'use client';
import dynamic from 'next/dynamic';
const WeatherExplorer=dynamic(()=>import('@/components/WeatherExplorer'),{ssr:false});
export default function Page(){return <WeatherExplorer/>}
