import { upstream, json, failed } from "@/lib/upstream";

export async function GET() {
  try {
    // NICT's Himawari mirror uses the same D531106/FULL_24h tile scheme.
    // Do not gate the timestamp on visible-light RGB tiles: they are blank at night.
    const data: any = await (await upstream("https://himawari.asia/img/D531106/latest.json")).json();
    const time = data.date.replace(" ", "T") + "Z";
    if (!Number.isFinite(Date.parse(time))) throw new Error("來源時間格式異常");
    return json({
      time,
      source: "NICT Himawari",
      checkedAt: new Date().toISOString(),
      cadenceMinutes: 10,
      archiveNote: "真實色需要日照；夜間自動切換黑白紅外線。缺圖不會以舊時刻冒充最新影像。",
    }, 60);
  } catch (e) {
    return failed(e);
  }
}
