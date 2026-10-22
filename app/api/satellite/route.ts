import { json, failed } from "@/lib/upstream";

export async function GET() {
  try {
    const response = await fetch("https://www.jma.go.jp/bosai/himawari/data/satimg/targetTimes_fd.json", { signal: AbortSignal.timeout(7000) });
    if (!response.ok) throw new Error(`JMA 回覆 ${response.status}`);
    const frames: unknown = await response.json();
    if (!Array.isArray(frames)) throw new Error("JMA 時間列表格式異常");
    const times = frames.map((item: any) => item?.validtime).filter((value): value is string => typeof value === "string" && /^\d{14}$/.test(value)).sort();
    if (!times.length) throw new Error("JMA 尚未提供影像時間");
    const latest = times[times.length - 1];
    const time = `${latest.slice(0,4)}-${latest.slice(4,6)}-${latest.slice(6,8)}T${latest.slice(8,10)}:${latest.slice(10,12)}:00Z`;
    return json({time,source:"JMA Himawari",checkedAt:new Date().toISOString(),cadenceMinutes:10,archiveNote:"所有衛星模式使用同一 JMA 觀測時間；真實色夜間無日照，自動模式切換黑白紅外線。"},60);
  } catch (e) { return failed(e); }
}
