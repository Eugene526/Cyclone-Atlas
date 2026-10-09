import {
  volumeManifest,
  volumeSlice,
  volumeProfile,
} from "@/lib/radar-volume-server";
import { VOLUME_HEIGHTS, parseVolumeLine } from "@/lib/radar-volume.mjs";
export const runtime = "nodejs";
export const maxDuration = 120;
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  if (q.get("region") !== "guam")
    return Response.json(
      { error: "目前三維原始資料涵蓋關島周邊；臺灣與日本為平面觀測" },
      { status: 400 },
    );
  const task = q.get("task") || "manifest";
  if (!["manifest", "slice", "profile"].includes(task))
    return Response.json({ error: "無效的雷達產品" }, { status: 400 });
  try {
    if (task === "manifest")
      return Response.json(await volumeManifest(), {
        headers: { "Cache-Control": "public,max-age=60" },
      });
    const time = q.get("time") || "",
      height = Number(q.get("height"));
    let a: number[] = [],
      b: number[] = [];
    if (task === "profile") {
      a = (q.get("a") || "").split(",").map(Number);
      b = (q.get("b") || "").split(",").map(Number);
      try {
        parseVolumeLine(a, b);
      } catch (e) {
        return Response.json({ error: (e as Error).message }, { status: 400 });
      }
    } else if (!VOLUME_HEIGHTS.includes(height))
      return Response.json({ error: "請選擇原生雷達高度層" }, { status: 400 });
    const m = await volumeManifest();
    if (!m.frames.some((f: any) => Date.parse(f.time) === Date.parse(time)))
      return Response.json(
        { error: "此時間已超出來源保留清單，請重新整理時間列表" },
        { status: 404 },
      );
    if (task === "profile")
      return Response.json(await volumeProfile(time, a, b), {
        headers: { "Cache-Control": "public,max-age=86400" },
      });
    return new Response(new Uint8Array(await volumeSlice(time, height)), {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Encoding": "gzip",
        "Cache-Control": "public,max-age=86400",
      },
    });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "三維雷達資料暫未就緒" },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}
