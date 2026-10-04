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
    wrapX: true, // Wrap the target Mercator world so satellite coverage continues across 180°.
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
        // B13 uses alpha to encode temperature, including zero for warm pixels.
        // Mask space geometrically, NOT by alpha (which would erase warm ocean).
        const q = new URL(url, location.origin).searchParams;
        const n = Number(q.get("n")), tx = Number(q.get("x")), ty = Number(q.get("y"));
        const pixel = 11000000 / (550 * n), h = 35786023, H = h + 6378137;
        const ratio = (6378137 / 6356752.314245) ** 2;
        const cosX = Array.from({length: c.width}, (_, x) => Math.cos((-5500000 + (tx * 550 + x + .5) * pixel) / h));
        const sinY2 = Array.from({length: c.height}, (_, y) => Math.sin((5500000 - (ty * 550 + y + .5) * pixel) / h) ** 2);
        for (let i = 0; i < d.data.length; i += 4) {
          const a = d.data[i + 3],
            rgb = mode === "bw" ? [a, a, a] : lut[a];
          d.data[i] = rgb[0];
          d.data[i + 1] = rgb[1];
          d.data[i + 2] = rgb[2];
          const sy2 = sinY2[Math.floor(i / 4 / c.width)];
          const cx = cosX[(i / 4) % c.width];
          const visible = H * H * cx * cx * (1 - sy2) - (1 + (ratio - 1) * sy2) * (H * H - 6378137 ** 2) >= 0;
          d.data[i + 3] = visible ? 255 : 0;
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
