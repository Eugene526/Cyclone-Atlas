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
  const url = `https://himawari8.nict.go.jp/img/${product}/${n}d/550/${stamp}_${x}_${y}.png`;
  try {
    const r = await upstream(url);
    if (!(r.headers.get("content-type") ?? "").includes("image/"))
      throw new Error("來源未回傳影像");
    return new Response(r.body, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=86400",
        "X-Imagery-Source": url,
        "X-Observation-UTC": time,
      },
    });
  } catch (e) {
    return failed(e);
  }
}
