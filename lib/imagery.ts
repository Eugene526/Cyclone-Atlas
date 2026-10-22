import XYZ from "ol/source/XYZ";
import { stamp } from "./satellite";
const sources = new Map<string, XYZ>();
export function imagery(
  time: string,
  mode: string,
  _animation = false,
  overview = false,
) {
  const key = `${time}|${mode}|${_animation}|${overview}`;
  const cached = sources.get(key);
  if (cached) return cached;
  // All three products come from the same official JMA full-disk observation.
  // Keep the highest published Web Mercator level, z5, for every mode.
  const source = new XYZ({
    projection: "EPSG:3857",
    minZoom: 3,
    maxZoom: 5,
    tileSize: 256,
    crossOrigin: "anonymous",
    transition: 0,
    tileUrlFunction: c => c && c[0] >= 3 && c[0] <= 5
      ? `/api/jma-satellite-tile?mode=${mode}&time=${stamp(time)}&z=${c[0]}&x=${c[1]}&y=${c[2]}`
      : undefined,
  });
  sources.set(key, source);
  while (sources.size > 40) sources.delete(sources.keys().next().value!);
  return source;
}
