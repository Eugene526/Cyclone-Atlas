// Consistent colour scale for observed maximum sustained winds (m/s).
const stops = [
  { speed: 0, rgb: [108, 190, 222] },
  { speed: 17, rgb: [105, 218, 193] },
  { speed: 25, rgb: [244, 207, 109] },
  { speed: 33, rgb: [250, 151, 99] },
  { speed: 50, rgb: [239, 94, 127] },
  { speed: 65, rgb: [194, 107, 228] },
];

export function intensityColor(speed: number | null | undefined): string {
  if (speed == null || !Number.isFinite(speed)) return "#a7c6d1";
  const high = stops.findIndex((stop) => speed <= stop.speed);
  const a = stops[Math.max(0, high < 0 ? stops.length - 1 : high - 1)];
  const b = stops[high < 0 ? stops.length - 1 : high];
  const t = a === b ? 0 : Math.max(0, Math.min(1, (speed - a.speed) / (b.speed - a.speed)));
  return `rgb(${a.rgb.map((channel, i) => Math.round(channel + (b.rgb[i] - channel) * t)).join(",")})`;
}
