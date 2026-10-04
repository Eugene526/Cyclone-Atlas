'use client';
import dynamic from 'next/dynamic';
const Observatory=dynamic(()=>import('@/components/Observatory'),{ssr:false});
export default function Page(){return <Observatory/>}
