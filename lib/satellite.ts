export type Mode = "auto" | "ott" | "rgb" | "bw";
export const stamp = (iso: string) =>
  new Date(iso).toISOString().replace(/[-:T]/g, "").slice(0, 12);
export const tw = (iso: string) =>
  new Date(iso).toLocaleString("zh-TW", {
    timeZone: "Asia/Taipei",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
export function isNight(iso: string, lon: number, lat: number) {
  const d = new Date(iso),
    day = (d.getTime() - Date.UTC(d.getUTCFullYear(), 0, 0)) / 86400000;
  const dec =
    (23.44 * Math.sin((2 * Math.PI * (284 + day)) / 365) * Math.PI) / 180;
  const hour =
    ((d.getUTCHours() + d.getUTCMinutes() / 60 + lon / 15 - 12) *
      15 *
      Math.PI) /
    180;
  return (
    Math.sin((lat * Math.PI) / 180) * Math.sin(dec) +
      Math.cos((lat * Math.PI) / 180) * Math.cos(dec) * Math.cos(hour) <
    0
  );
}
const stops: [number, number[]][] = [
  [0, [255, 255, 255]],
  [10, [0, 0, 0]],
  [22, [255, 0, 0]],
  [34, [255, 255, 0]],
  [46, [0, 128, 0]],
  [58, [0, 0, 255]],
  [70, [173, 216, 230]],
  [70.001, [211, 211, 211]],
  [140, [0, 0, 0]],
];
export function thermalColor(alpha: number, mode: string) {
  if (mode === "bw") return [alpha, alpha, alpha];
  const v = 140 * (1 - alpha / 255);
  let j = 1;
  while (j < stops.length - 1 && v > stops[j][0]) j++;
  const a = stops[j - 1],
    b = stops[j],
    f = (v - a[0]) / (b[0] - a[0]);
  return a[1].map((x, k) => Math.round(x + (b[1][k] - x) * f));
}
export const lut = Array.from({ length: 256 }, (_, a) =>
  thermalColor(a, "ott"),
);
