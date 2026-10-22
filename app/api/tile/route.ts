import sharp from "sharp";
import { failed } from "@/lib/upstream";

const hosts = ["https://jh190005-4.kudpc.kyoto-u.ac.jp/himawari", "https://himawari.asia"];
const rgbLevels = [1, 2, 4, 8, 16, 20];
const tileSize = 550;
type Product = "rgb" | "ir";

async function fetchTile(mode: Product, time: string, n: number, x: number, y: number) {
  const product = mode === "rgb" ? "D531106" : "FULL_24h/B13";
  const dated = `${time.slice(0,4)}/${time.slice(4,6)}/${time.slice(6,8)}/${time.slice(8)}00`;
  const path = `/img/${product}/${n}d/${tileSize}/${dated}_${x}_${y}.png`;
  for (const host of hosts) {
    try {
      const response = await fetch(`${host}${path}`, { signal: AbortSignal.timeout(6500) });
      if (!response.ok || !(response.headers.get("content-type") || "").includes("image/png")) continue;
      const data = Buffer.from(await response.arrayBuffer());
      if (data.length < 100 || !data.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) continue;
      const type = data[25];
      if (data.readUInt32BE(16) !== tileSize || data.readUInt32BE(20) !== tileSize) continue;
      if (mode === "rgb" && (data.length < 5000 || ![2,6].includes(type))) continue;
      if (mode === "rgb") {
        const stats = await sharp(data).resize(64,64).stats();
        const brightness = stats.channels.slice(0,3).reduce((sum, channel) => sum + channel.mean, 0) / 3;
        const variation = stats.channels.slice(0,3).reduce((sum, channel) => sum + channel.stdev, 0) / 3;
        if (brightness < 5 && variation < 12) continue; // night/black tile
      }
      if (mode === "ir" && ![4,6].includes(type)) continue;
      return { data, host };
    } catch { /* use next mirror */ }
  }
  return null;
}

async function infraredGrayscale(data: Buffer) {
  // libvips expands luminance-alpha PNG to RGBA. The source luminance is
  // always white; the thermal signal lives in byte 3, not RGB channels.
  const raw = await sharp(data).raw().toBuffer({resolveWithObject:true});
  const gray = Buffer.alloc(tileSize * tileSize * 3);
  for (let i = 0; i < tileSize * tileSize; i++) {
    const alpha = raw.data[i * raw.info.channels + raw.info.channels - 1];
    gray[i * 3] = alpha;
    gray[i * 3 + 1] = alpha;
    gray[i * 3 + 2] = alpha;
  }
  return sharp(gray,{raw:{width:tileSize,height:tileSize,channels:3}}).png().toBuffer();
}

// The reference script crops the geostationary grid to the viewport. When a
// 20d tile is absent, crop its exact footprint from a lower native level at
// the same observation time rather than showing a hole or inventing pixels.
async function resampleTile(mode: Product, time: string, targetN: number, x: number, y: number, sourceN: number) {
  const left = x * tileSize * sourceN / targetN;
  const top = y * tileSize * sourceN / targetN;
  const right = (x + 1) * tileSize * sourceN / targetN;
  const bottom = (y + 1) * tileSize * sourceN / targetN;
  const firstX = Math.floor(left / tileSize), lastX = Math.ceil(right / tileSize) - 1;
  const firstY = Math.floor(top / tileSize), lastY = Math.ceil(bottom / tileSize) - 1;
  const columns = lastX - firstX + 1;
  const tiles = await Promise.all(Array.from({length: columns * (lastY - firstY + 1)}, async (_, i) => {
    const tx = firstX + i % columns, ty = firstY + Math.floor(i / columns);
    return { tx, ty, result: await fetchTile(mode, time, sourceN, tx, ty) };
  }));
  if (tiles.some(tile => !tile.result)) return null;
  const width = columns * tileSize, height = (lastY - firstY + 1) * tileSize;
  const overlays = await Promise.all(tiles.map(async ({ tx, ty, result }) => ({
    input: mode === "ir"
      ? await infraredGrayscale(result!.data)
      : result!.data,
    left: (tx - firstX) * tileSize, top: (ty - firstY) * tileSize,
  })));
  const stitched = await sharp({ create: {width, height, channels: 4, background: "#000"} })
    .composite(overlays).png().toBuffer();
  const cropLeft = Math.max(0, Math.floor(left - firstX * tileSize));
  const cropTop = Math.max(0, Math.floor(top - firstY * tileSize));
  const cropRight = Math.min(width, Math.ceil(right - firstX * tileSize));
  const cropBottom = Math.min(height, Math.ceil(bottom - firstY * tileSize));
  return sharp(stitched).extract({left:cropLeft,top:cropTop,width:cropRight-cropLeft,height:cropBottom-cropTop})
    .resize(tileSize,tileSize,{fit:"fill",kernel:"lanczos3"}).png().toBuffer();
}

export async function GET(req: Request) {
  const p = new URL(req.url).searchParams;
  const mode = p.get("mode"), time = p.get("time") ?? "";
  const n = Number(p.get("n")), x = Number(p.get("x")), y = Number(p.get("y"));
  if ((mode !== "rgb" && mode !== "ir") || !/^\d{12}$/.test(time) ||
      !(mode === "rgb" ? rgbLevels : [1,2,4,8,10]).includes(n) ||
      ![x,y].every(v => Number.isInteger(v) && v >= 0 && v < n))
    return Response.json({error:"無效圖磚參數"},{status:400});
  try {
    const exact = await fetchTile(mode,time,n,x,y);
    if (exact) return new Response(new Uint8Array(exact.data),{headers:{
      "Content-Type":"image/png","Cache-Control":"public, max-age=600",
      "X-Imagery-Source":exact.host,"X-Observation-UTC":time,"X-Imagery-Level":`${n}d`,
    }});
    if (mode === "rgb") {
      for (const level of [16,8,4,2,1].filter(level => level < n)) {
        const data = await resampleTile("rgb",time,n,x,y,level);
        if (data) return new Response(new Uint8Array(data),{headers:{
          "Content-Type":"image/png","Cache-Control":"public, max-age=600",
          "X-Imagery-Source":"Himawari true-color lower-level fallback",
          "X-Observation-UTC":time,"X-Imagery-Level":`${level}d resampled to ${n}d`,
        }});
      }
      // At night true color cannot exist; the same-time B13 image is still
      // preferable to an empty cell. Its grayscale appearance is intentional.
      for (const level of [10,8,4]) {
        const data = await resampleTile("ir",time,n,x,y,level);
        if (data) return new Response(new Uint8Array(data),{headers:{
          "Content-Type":"image/png","Cache-Control":"public, max-age=600",
          "X-Imagery-Source":"Himawari B13 infrared fallback (not true color)",
          "X-Observation-UTC":time,"X-Imagery-Level":`${level}d resampled to ${n}d`,
        }});
      }
    }
    throw new Error("此時刻所有可用層級均無有效衛星圖磚");
  } catch (error) { return failed(error); }
}
