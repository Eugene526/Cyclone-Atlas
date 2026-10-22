import { upstream, json, failed } from "@/lib/upstream";
const root = "https://himawari.asia/img";
let selected: { time: string; latestObservation: string; checkedAt: string } | null = null;
async function hasHighResolution(time: Date) {
  const stamp = time.toISOString().replace(/[-:T]/g, "").slice(0, 12);
  const path = `${stamp.slice(0,4)}/${stamp.slice(4,6)}/${stamp.slice(6,8)}/${stamp.slice(8)}00`;
  const probes = [["D531106",20,10],["FULL_24h/B13",10,5]] as const;
  const sizes = await Promise.all(probes.map(async ([product,n,tile]) => {
    try {
      const r = await fetch(`${root}/${product}/${n}d/550/${path}_${tile}_${tile}.png`, {method:"HEAD",signal:AbortSignal.timeout(3500),cache:"no-store"});
      return r.ok ? Number(r.headers.get("content-length")) : 0;
    } catch { return 0; }
  }));
  // NICT returns a tiny transparent PNG for tiles not yet processed. HTTP 200 alone is not enough.
  return sizes.every(size => size > 1000);
}
export async function GET() {
  try {
    const data: any = await (
      await upstream(`${root}/D531106/latest.json`)
    ).json();
    const latestObservation = data.date.replace(" ", "T") + "Z";
    if (!Number.isFinite(Date.parse(latestObservation))) throw new Error("來源時間格式異常");
    if (!selected || Date.now() - Date.parse(selected.checkedAt) > 60000 || selected.latestObservation !== latestObservation) {
      let hour = new Date(latestObservation);
      hour.setUTCMinutes(0,0,0);
      let ready: Date | null = null;
      for (let i=0;i<=12;i++) {
        if (await hasHighResolution(hour)) { ready = hour; break; }
        hour = new Date(hour.getTime()-3600000);
      }
      if (!ready) throw new Error("NICT 高解析度圖磚尚未備妥");
      const baseHour = ready.getTime();
      for (let minute=10;minute<60;minute+=10) {
        const candidate = new Date(baseHour+minute*60000);
        if (candidate <= new Date(latestObservation) && await hasHighResolution(candidate)) ready = candidate;
      }
      selected = {time:ready.toISOString(),latestObservation,checkedAt:new Date().toISOString()};
    }
    return json(
      {
        time: selected.time,
        source: "NICT Himawari",
        latestObservation,
        checkedAt: selected.checkedAt,
        cadenceMinutes: 10,
        archiveNote: "只選用真實色與紅外線高解析度圖磚均已備妥的觀測時間；來源處理延遲時顯示實際影像時間。",
      },
      60,
    );
  } catch (e) {
    return failed(e);
  }
}
