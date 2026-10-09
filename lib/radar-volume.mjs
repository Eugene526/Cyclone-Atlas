// Real MRMS constant-altitude observations; no extrusion of a 2D composite.
export const VOLUME_HEIGHTS = [
  0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 2.75, 3, 3.5, 4, 4.5, 5, 5.5, 6,
  6.5, 7, 7.5, 8, 8.5, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19,
];
export const GUAM_BOUNDS = [140.0025, 9.0025, 149.9975, 17.9975];
export function volumeStamp(t) {
  const d = new Date(t);
  if (!Number.isFinite(+d)) throw Error("時間格式不符");
  return d.toISOString().replace(/[-:]/g, "").replace("T", "-").slice(0, 15);
}
export function parseVolumeLine(a, b) {
  const valid = (p) =>
    Array.isArray(p) &&
    p.length === 2 &&
    p.every(Number.isFinite) &&
    p[0] >= GUAM_BOUNDS[0] &&
    p[0] <= GUAM_BOUNDS[2] &&
    p[1] >= GUAM_BOUNDS[1] &&
    p[1] <= GUAM_BOUNDS[3];
  if (!valid(a) || !valid(b)) throw Error("剖面端點需位於關島 MRMS 資料範圍內");
  const km = distanceKm(a, b);
  if (km < 1 || km > 1200) throw Error("剖面長度需介於 1–1200 公里");
  return km;
}
export function distanceKm(a, b) {
  const r = Math.PI / 180,
    dlat = (b[1] - a[1]) * r,
    dlon = (b[0] - a[0]) * r,
    s =
      Math.sin(dlat / 2) ** 2 +
      Math.cos(a[1] * r) * Math.cos(b[1] * r) * Math.sin(dlon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(Math.max(0, 1 - s)));
}
export function linePosition(a, b, t) {
  const r = Math.PI / 180,
    p = a.map((x) => x * r),
    q = b.map((x) => x * r),
    d = distanceKm(a, b) / 6371;
  if (d < 1e-9) return [...a];
  const A = Math.sin((1 - t) * d) / Math.sin(d),
    B = Math.sin(t * d) / Math.sin(d),
    x =
      A * Math.cos(p[1]) * Math.cos(p[0]) + B * Math.cos(q[1]) * Math.cos(q[0]),
    y =
      A * Math.cos(p[1]) * Math.sin(p[0]) + B * Math.cos(q[1]) * Math.sin(q[0]),
    z = A * Math.sin(p[1]) + B * Math.sin(q[1]);
  return [Math.atan2(y, x) / r, Math.atan2(z, Math.hypot(x, y)) / r];
}
export function sampleVolume(grid, values, p) {
  const x = Math.round((p[0] - grid.west) / grid.dx),
    y = Math.round((grid.north - p[1]) / grid.dy);
  if (x < 0 || y < 0 || x >= grid.cols || y >= grid.rows) return null;
  const v = values[y * grid.cols + x];
  return Number.isFinite(v) && v >= -50 && v <= 95 ? v : null;
}
export function viewingOrder(side, count) {
  return Array.from({ length: count }, (_, i) =>
    side === "right" ? count - 1 - i : i,
  );
}
export function crossSection(values, grid, a, b, count = 256) {
  return Array.from({ length: count }, (_, i) =>
    sampleVolume(grid, values, linePosition(a, b, i / (count - 1))),
  );
}
export function parseVolumeNames(html, height) {
  const h = height.toFixed(2).padStart(5, "0"),
    re = new RegExp(
      "MRMS_MergedReflectivityQC_" + h + "_(\\d{8}-\\d{6})\\.grib2\\.gz",
      "g",
    );
  return [...new Set([...html.matchAll(re)].map((m) => m[1]))]
    .sort()
    .map((s) => ({
      time: `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}T${s.slice(9, 11)}:${s.slice(11, 13)}:${s.slice(13, 15)}Z`,
      stamp: s,
    }));
}
