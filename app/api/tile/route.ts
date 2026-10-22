import { upstream, failed } from "@/lib/upstream";
export async function GET(req: Request) {
  const p = new URL(req.url).searchParams;
  const mode = p.get("mode"),
    time = p.get("time") ?? "",
    n = Number(p.get("n")),
    x = Number(p.get("x")),
    y = Number(p.get("y"));
  if (
    !["rgb", "ir"].includes(mode ?? "") ||
    !/^\d{12}$/.test(time) ||
    ![1, 2, 4, 8, ...(mode === "rgb" ? [16, 20] : [10])].includes(n) ||
    ![x, y].every((v) => Number.isInteger(v) && v >= 0 && v < n)
  )
    return Response.json({ error: "無效圖磚參數" }, { status: 400 });
  const stamp = `${time.slice(0, 4)}/${time.slice(4, 6)}/${time.slice(6, 8)}/${time.slice(8)}00`;
  const product = mode === "ir" ? "FULL_24h/B13" : "D531106";
  const path = `/img/${product}/${n}d/550/${stamp}_${x}_${y}.png`;
  const hosts = ["https://himawari8.nict.go.jp", "https://himawari.asia"];
  try {
    for (const host of hosts) {
      const url = `${host}${path}`;
      try {
        const r = await upstream(url);
        if (!(r.headers.get("content-type") ?? "").includes("image/png")) continue;
        const data = new Uint8Array(await r.arrayBuffer());
        const png = data.length > 26 && data.slice(0, 8).every((v, i) => v === [137,80,78,71,13,10,26,10][i]);
        if (!png) continue;
        // NICT B13 temperatures are encoded in PNG alpha. Its small, opaque RGB
        // placeholder is HTTP 200 too; passing it to the LUT paints the map white.
        if (mode === "ir" && ![4,6].includes(data[25])) continue;
        return new Response(data, {
          headers: {
            "Content-Type": "image/png",
            "Cache-Control": "public, max-age=600",
            "X-Imagery-Source": url,
            "X-Observation-UTC": time,
          },
        });
      } catch { /* try the next NICT entry point */ }
    }
    throw new Error("NICT 此時刻尚無有效的紅外線圖磚");
  } catch (e) {
    return failed(e);
  }
}
