import { json, failed } from "@/lib/upstream";

const hosts = ["https://himawari8.nict.go.jp", "https://himawari.asia"];

async function latest(host: string) {
  const response = await fetch(`${host}/img/D531106/latest.json`, { signal: AbortSignal.timeout(4500) });
  if (!response.ok) throw new Error(`NICT 回覆 ${response.status}`);
  const data: any = await response.json();
  const time = String(data.date || "").replace(" ", "T") + "Z";
  if (!Number.isFinite(Date.parse(time))) throw new Error("來源時間格式異常");
  return { time, host };
}

export async function GET() {
  try {
    // Read both NICT entry points; the older one can lag even while returning 200.
    // RGB tiles are naturally blank at night and must not gate the observation time.
    const results = await Promise.allSettled(hosts.map(latest));
    const available = results.filter((r): r is PromiseFulfilledResult<{time:string;host:string}> => r.status === "fulfilled").map(r => r.value);
    if (!available.length) throw new Error("NICT 衛星資料源暫時未回應");
    const newest = available.sort((a,b) => Date.parse(b.time)-Date.parse(a.time))[0];
    return json({
      time: newest.time,
      source: "NICT Himawari",
      availableHosts: available.map(r => ({ host: new URL(r.host).host, time: r.time })),
      checkedAt: new Date().toISOString(),
      cadenceMinutes: 10,
      archiveNote: "真實色需要日照；夜間自動切換黑白紅外線。缺圖不會以舊時刻冒充最新影像。",
    }, 60);
  } catch (e) {
    return failed(e);
  }
}
