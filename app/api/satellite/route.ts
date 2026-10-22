import { json, failed } from "@/lib/upstream";
const jmaRoot = "https://www.data.jma.go.jp/mscweb/data/himawari";
async function latestJma() {
  const response = await fetch(`${jmaRoot}/sat_img.php`, { signal: AbortSignal.timeout(7000), cache: "no-store" });
  if (!response.ok) throw new Error("JMA 衛星影像目錄暫時未回應");
  const html = await response.text();
  const match = html.match(/<option\s+value=(["']?)(\d{4})\1[^>]*>\s*(\d{2}):(\d{2}) UTC (\d{1,2}) ([A-Za-z]+) (\d{4})/i);
  if (!match) throw new Error("JMA 衛星影像時間格式異常");
  const [, , , hour, minute, day, month, year] = match;
  const time = new Date(`${month} ${day}, ${year} ${hour}:${minute}:00 UTC`).toISOString();
  return { time, source: "JMA MSC Himawari Real-Time Image", fallback: true, fallbackArea: "se2", checkedAt: new Date().toISOString(), cadenceMinutes: 10 };
}
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  try {
    if (params.has("image")) {
      const stamp = params.get("time") || "";
      const mode = params.get("mode") || "bw";
      if (!/^\d{12}$/.test(stamp) || !["rgb", "bw", "ott"].includes(mode))
        return Response.json({ error: "無效衛星備援影像參數" }, { status: 400 });
      // JMA MSC's public Southeast Asia 2 image covers Taiwan and the western North Pacific.
      const product = mode === "rgb" ? "trm" : "b13";
      const url = `${jmaRoot}/img/se2/se2_${product}_${stamp.slice(8, 12)}.jpg`;
      const image = await fetch(url, { signal: AbortSignal.timeout(10000), cache: "no-store" });
      if (!image.ok || !image.headers.get("content-type")?.startsWith("image/"))
        return Response.json({ error: "JMA 此時刻的備援衛星影像不可用" }, { status: 404 });
      return new Response(image.body, { headers: { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=600", "X-Imagery-Source": "JMA MSC" } });
    }
    const data: any = await (
      await fetch("https://himawari8.nict.go.jp/img/D531106/latest.json", { signal: AbortSignal.timeout(3500), cache: "no-store" })
    ).json();
    const time = data.date.replace(" ", "T") + "Z";
    if (!Number.isFinite(Date.parse(time))) throw new Error("來源時間格式異常");
    return json(
      {
        time,
        file: data.file,
        source: "NICT / JMA Himawari",
        checkedAt: new Date().toISOString(),
        cadenceMinutes: 10,
        archiveNote: "歷史資料可用性依來源；缺圖不會以其他時刻取代。",
      },
      60,
    );
  } catch {
    if (params.has("image")) return Response.json({ error: "JMA 此時刻的備援衛星影像不可用" }, { status: 404 });
    try { return json(await latestJma(), 60); }
    catch (e) { return failed(e); }
  }
}
