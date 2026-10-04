import XYZ from "ol/source/XYZ";
import TileGrid from "ol/tilegrid/TileGrid";
import { stamp, lut } from "./satellite";
const sources = new Map<string, XYZ>();
const blobs = new Map<string, string>();
export function imagery(
  time: string,
  mode: string,
  animation = false,
  overview = false,
) {
  const key = `${time}|${mode}|${animation}|${overview}`;
  const cached = sources.get(key);
  if (cached) return cached;
  const ir = mode !== "rgb",
    ns = overview
      ? [1, 2]
      : animation
        ? [1, 2, 4]
        : ir
          ? [1, 2, 4, 8, 10]
          : [1, 2, 4, 8, 16, 20];
  const grid = new TileGrid({
    extent: [-5500000, -5500000, 5500000, 5500000],
    origin: [-5500000, 5500000],
    tileSize: 550,
    resolutions: ns.map((n) => 11000000 / (550 * n)),
  });
  const source = new XYZ({
    projection: "HIMAWARI",
    tileGrid: grid,
    wrapX: false,
    crossOrigin: "anonymous",
    transition: 0,
    reprojectionErrorThreshold: 0.75,
    tileUrlFunction: (c) =>
      c[1] < 0 || c[2] < 0 || c[1] >= ns[c[0]] || c[2] >= ns[c[0]]
        ? undefined
        : `/api/tile?mode=${ir ? "ir" : "rgb"}&time=${stamp(time)}&n=${ns[c[0]]}&x=${c[1]}&y=${c[2]}`,
    tileLoadFunction: (tile: any, url) => {
      const out = tile.getImage() as HTMLImageElement;
      if (!ir) {
        out.src = url;
        return;
      }
      const bkey = url + "|" + mode;
      if (blobs.has(bkey)) {
        out.src = blobs.get(bkey)!;
        return;
      }
      const img = new Image();
      img.onload = () => {
        const c = document.createElement("canvas");
        c.width = img.width;
        c.height = img.height;
        const ctx = c.getContext("2d", { willReadFrequently: true })!;
        ctx.drawImage(img, 0, 0);
        const d = ctx.getImageData(0, 0, c.width, c.height);
        for (let i = 0; i < d.data.length; i += 4) {
          const a = d.data[i + 3],
            rgb = mode === "bw" ? [a, a, a] : lut[a];
          d.data[i] = rgb[0];
          d.data[i + 1] = rgb[1];
          d.data[i + 2] = rgb[2];
          d.data[i + 3] = 255;
        }
        ctx.putImageData(d, 0, 0);
        c.toBlob((b) => {
          if (!b) {
            tile.setState(3);
            return;
          }
          const u = URL.createObjectURL(b);
          blobs.set(bkey, u);
          out.src = u;
          while (blobs.size > 650) {
            const oldest = blobs.keys().next().value!;
            URL.revokeObjectURL(blobs.get(oldest)!);
            blobs.delete(oldest);
          }
        }, "image/png");
      };
      img.onerror = () => tile.setState(3);
      img.src = url;
    },
  });
  sources.set(key, source);
  while (sources.size > 40) sources.delete(sources.keys().next().value!);
  return source;
}
