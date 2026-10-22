import { failed } from "@/lib/upstream";
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
  // Match the supplied generator: Kyoto University's Himawari tile mirror,
  // with its peer mirror as a fallback. Preserve the 20d/10d native grids.
  const hosts = [
    "https://jh190005-4.kudpc.kyoto-u.ac.jp/himawari",
    "https://himawari.asia",
  ];
  try {
    for (const host of hosts) {
      const url = `${host}${path}`;
      try {
        const r = await fetch(url, {signal:AbortSignal.timeout(8000)});
        if (!r.ok || !(r.headers.get("content-type") ?? "").includes("image/png")) continue;
        const data = new Uint8Array(await r.arrayBuffer());
        const png = data.length > 26 && data.slice(0, 8).every((v, i) => v === [137,80,78,71,13,10,26,10][i]);
        if (!png) continue;
        if (mode === "rgb" && data.length < 5000) continue;
        // B13 is luminance-alpha: alpha carries the thermal index. Reject
        // opaque placeholders that otherwise turn the map white.
        if (mode === "ir" && ![4,6].includes(data[25])) continue;
        return new Response(data, {
          headers: {
            "Content-Type": "image/png",
            "Cache-Control": "public, max-age=600",
            "X-Imagery-Source": url,
            "X-Observation-UTC": time,
          },
        });
      } catch { /* try the next mirror */ }
    }
    throw new Error("此時刻尚無有效的衛星圖磚");
  } catch (e) {
    return failed(e);
  }
}
