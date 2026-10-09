import { gzipSync } from "node:zlib";
import { decodeVolume } from "./radar-volume-decode.mjs";
import {
  VOLUME_HEIGHTS,
  volumeStamp,
  parseVolumeNames,
  parseVolumeLine,
  crossSection,
} from "./radar-volume.mjs";
const BASE = "https://mrms.ncep.noaa.gov/3DRefl/GUAM/";
const cache = new Map<string, { until: number; value: any }>(),
  inflight = new Map<string, Promise<any>>();
async function cached(key: string, ttl: number, fn: () => Promise<any>) {
  const hit = cache.get(key);
  if (hit && hit.until > Date.now()) {
    cache.delete(key);
    cache.set(key, hit);
    return hit.value;
  }
  if (inflight.has(key)) return inflight.get(key);
  const task = fn()
    .then((value) => {
      if (!key.startsWith("raw-"))
        cache.set(key, { until: Date.now() + ttl, value });
      while (cache.size > 12) cache.delete(cache.keys().next().value!);
      return value;
    })
    .finally(() => inflight.delete(key));
  inflight.set(key, task);
  return task;
}
async function get(url: string) {
  const r = await fetch(url, {
    signal: AbortSignal.timeout(20000),
    cache: "no-store",
  });
  if (!r.ok) throw Error("NOAA 原始雷達來源回覆 " + r.status);
  return r;
}
export async function volumeManifest() {
  return cached("manifest", 60000, async () => {
    const html = await (await get(BASE + "MergedReflectivityQC_00.50/")).text(),
      frames = parseVolumeNames(html, 0.5).slice(-60);
    if (!frames.length) throw Error("NOAA 尚未列出可用體積觀測");
    return {
      provider: "NOAA MRMS · GUAM",
      frames,
      heights: VOLUME_HEIGHTS,
      nativeResolution: 0.005,
      unit: "dBZ",
      heightReference: "海拔高度（MSL）",
      bounds: [140.0025, 9.0025, 149.9975, 17.9975],
      checkedAt: new Date().toISOString(),
    };
  });
}
// Small bounded raw-plane cache: never retain all full-resolution 3D planes on the server.
const planes = new Map<string, any>();
let decodeChain = Promise.resolve();
async function plane(time: string, height: number) {
  const key = time + "|" + height;
  if (planes.has(key)) {
    const v = planes.get(key);
    planes.delete(key);
    planes.set(key, v);
    return v;
  }
  return cached("raw-" + key, 600000, async () => {
    const h = height.toFixed(2).padStart(5, "0"),
      bytes = new Uint8Array(
        await (
          await get(
            BASE +
              `MergedReflectivityQC_${h}/MRMS_MergedReflectivityQC_${h}_${volumeStamp(time)}.grib2.gz`,
          )
        ).arrayBuffer(),
      );
    let result: any;
    const task = decodeChain.then(() => {
      result = decodeVolume(bytes, time, height);
    });
    decodeChain = task.catch(() => {});
    await task;
    planes.set(key, result);
    while (planes.size > 3) planes.delete(planes.keys().next().value!);
    return result;
  });
}
// Fetch pool across requests caps pressure on the public origin and server memory.
let active = 0;
const waiters: (() => void)[] = [];
async function limited<T>(fn: () => Promise<T>): Promise<T> {
  if (active >= 3) await new Promise<void>((r) => waiters.push(r));
  else active++;
  try {
    return await fn();
  } finally {
    const next = waiters.shift();
    if (next) next();
    else active--;
  }
}
export async function volumeSlice(time: string, height: number) {
  return cached("slice-" + time + "|" + height, 600000, async () => {
    const d = await limited(() => plane(time, height)),
      factor = 4,
      cols = Math.ceil(d.grid.cols / factor),
      rows = Math.ceil(d.grid.rows / factor),
      values = new Float32Array(cols * rows);
    let peak: any = null;
    for (let y = 0; y < rows; y++)
      for (let x = 0; x < cols; x++) {
        const v = d.values[y * factor * d.grid.cols + x * factor];
        values[y * cols + x] = v;
        if (Number.isFinite(v) && (!peak || v > peak.value))
          peak = {
            value: v,
            lon: d.grid.west + x * factor * d.grid.dx,
            lat: d.grid.north - y * factor * d.grid.dy,
          };
      }
    const meta = {
        time: d.time,
        height,
        grid: {
          ...d.grid,
          cols,
          rows,
          dx: d.grid.dx * factor,
          dy: d.grid.dy * factor,
        },
        nativeResolution: 0.005,
        displaySampling: 0.02,
        peak,
        unit: "dBZ",
        heightReference: "MSL",
      },
      header = new TextEncoder().encode(JSON.stringify(meta)),
      out = new Uint8Array(4 + header.length + values.byteLength);
    new DataView(out.buffer).setUint32(0, header.length, true);
    out.set(header, 4);
    out.set(new Uint8Array(values.buffer), 4 + header.length);
    return gzipSync(out);
  });
}
export async function volumeProfile(time: string, a: number[], b: number[]) {
  const distance = parseVolumeLine(a, b),
    key = "profile-" + time + "|" + a.join(",") + "|" + b.join(",");
  return cached(key, 600000, async () => {
    const layers = await Promise.all(
      VOLUME_HEIGHTS.map((height) =>
        limited(async () => {
          const d = await plane(time, height);
          return { height, values: crossSection(d.values, d.grid, a, b) };
        }),
      ),
    );
    return {
      time: new Date(time).toISOString(),
      a,
      b,
      distance,
      samples: 256,
      layers,
      unit: "dBZ",
      heightReference: "MSL",
      nativeResolution: 0.005,
      sampling: "最近原始格點；垂直層間不補造回波",
      source: BASE,
    };
  });
}
