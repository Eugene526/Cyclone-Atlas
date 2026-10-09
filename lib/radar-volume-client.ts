import { readJsonResponse as readJson } from "./http-json.mjs";
const cache = new Map<string, any>(),
  pending = new Map<string, Promise<any>>();
export async function radarVolume(
  task: string,
  args: Record<string, string>,
  signal?: AbortSignal,
) {
  const url =
    "/api/radar-volume?" +
    new URLSearchParams({ region: "guam", task, ...args });
  if (cache.has(url)) {
    const v = cache.get(url);
    cache.delete(url);
    cache.set(url, v);
    return v;
  }
  if (pending.has(url)) return pending.get(url);
  const work = (async () => {
    const r = await fetch(url, {
      signal: AbortSignal.timeout(task === "profile" ? 115000 : 45000),
    });
    if (!r.ok) throw Error((await readJson(r)).error || "雷達原始資料尚未就緒");
    if (task !== "slice") return readJson(r);
    let bytes = new Uint8Array(await r.arrayBuffer());
    if (bytes[0] === 31 && bytes[1] === 139)
      bytes = new Uint8Array(
        await new Response(
          new Blob([bytes])
            .stream()
            .pipeThrough(new DecompressionStream("gzip")),
        ).arrayBuffer(),
      );
    const n = new DataView(bytes.buffer, bytes.byteOffset).getUint32(0, true);
    if (n > 10000 || bytes.length < 4 + n) throw Error("雷達格點資料格式不符");
    const meta = JSON.parse(new TextDecoder().decode(bytes.subarray(4, 4 + n))),
      part = bytes.slice(4 + n);
    if (
      part.byteLength !== meta.grid.cols * meta.grid.rows * 4 ||
      Date.parse(meta.time) !== Date.parse(args.time) ||
      meta.height !== Number(args.height)
    )
      throw Error("雷達格點時間／高度不符");
    return { ...meta, values: new Float32Array(part.buffer) };
  })();
  pending.set(url, work);
  try {
    const v = await work;
    if (task !== "manifest") {
      cache.set(url, v);
      while (cache.size > 6) cache.delete(cache.keys().next().value!);
    }
    return v;
  } finally {
    pending.delete(url);
  }
}
