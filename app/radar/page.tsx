"use client";
import dynamic from "next/dynamic";
const RadarExplorer = dynamic(() => import("@/components/RadarExplorer"), {
  ssr: false,
});
export default function Page() {
  return <RadarExplorer />;
}
