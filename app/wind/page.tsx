'use client';
import dynamic from 'next/dynamic';
const WindExplorer=dynamic(()=>import('@/components/WindExplorer'),{ssr:false});
export default function Page(){return <WindExplorer/>}
