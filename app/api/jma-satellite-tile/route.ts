import { failed } from "@/lib/upstream";

export async function GET(req: Request) {
  const p = new URL(req.url).searchParams;
  const time = p.get("time") || "";
  const mode = p.get("mode") || "rgb";
  const z = Number(p.get("z")), x = Number(p.get("x")), y = Number(p.get("y"));
  if (!["rgb", "bw", "ott"].includes(mode) || !/^\d{12}$/.test(time) || !Number.isInteger(z) || z < 3 || z > 5 ||
      !Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= 2 ** z || y >= 2 ** z)
    return Response.json({error:"無效的衛星圖磚參數"},{status:400});
  const observation = `${time}00`;
  const product = mode === "bw" ? "B13/TBB" : mode === "ott" ? "SND/ETC" : "REP/ETC";
  const url = `https://www.jma.go.jp/bosai/himawari/data/satimg/${observation}/fd/${observation}/${product}/${z}/${x}/${y}.jpg`;
  try {
    const response = await fetch(url,{signal:AbortSignal.timeout(10000)});
    if (!response.ok || !(response.headers.get("content-type") || "").includes("image/jpeg"))
      throw new Error(`JMA 衛星圖磚暫缺 (${response.status})`);
    return new Response(response.body,{headers:{"Content-Type":"image/jpeg","Cache-Control":"public, max-age=3600","X-Imagery-Source":`JMA Himawari ${product}`,"X-Observation-UTC":time}});
  } catch (e) { return failed(e); }
}
