import { json, failed } from "@/lib/upstream";

const hosts = ["https://jh190005-4.kudpc.kyoto-u.ac.jp/himawari", "https://himawari.asia"];
async function latest(host: string) {
  const response = await fetch(`${host}/img/D531106/latest.json`, {signal: AbortSignal.timeout(6000)});
  if (!response.ok) throw new Error(`衛星來源回覆 ${response.status}`);
  const data: any = await response.json();
  const time = String(data.date || "").replace(" ", "T") + "Z";
  if (!Number.isFinite(Date.parse(time))) throw new Error("衛星時間格式異常");
  return {time, host};
}
export async function GET() {
  try {
    const results = await Promise.allSettled(hosts.map(latest));
    const available = results.filter((r): r is PromiseFulfilledResult<{time:string;host:string}> => r.status === "fulfilled").map(r => r.value);
    if (!available.length) throw new Error("衛星資料源暫時未回應");
    const newest = available.sort((a,b) => Date.parse(b.time)-Date.parse(a.time))[0];
    return json({time:newest.time,source:"Himawari tile mirror",availableHosts:available.map(r=>({host:new URL(r.host).host,time:r.time})),checkedAt:new Date().toISOString(),cadenceMinutes:10,archiveNote:"真實色需要日照；夜間自動切換黑白紅外線。缺圖不會以舊時刻冒充最新影像。"},60);
  } catch (e) {return failed(e);}
}
