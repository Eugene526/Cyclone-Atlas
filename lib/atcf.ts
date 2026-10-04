export function parseATCF(text: string) {
  const groups = new Map<string, any>();
  for (const line of text.split("\n")) {
    const f = line.split(",").map((s) => s.trim());
    if (
      f.length < 10 ||
      f[0] !== "WP" ||
      !/^\d{10}$/.test(f[2]) ||
      /MN$/.test(f[4])
    )
      continue;
    const coord = (s: string) =>
      /^\d+[NSEW]$/.test(s)
        ? (parseInt(s) / 10) * (/[SW]$/.test(s) ? -1 : 1)
        : NaN;
    const lat = coord(f[6]),
      lon = coord(f[7]),
      lead = Number(f[5]);
    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lon) ||
      Math.abs(lat) > 90 ||
      Math.abs(lon) > 180 ||
      lead < 0 ||
      lead > 500
    )
      continue;
    const key = f[1] + "-" + f[4];
    if (!groups.has(key))
      groups.set(key, {
        storm: f[1] + "W",
        name: f[1] + "W",
        member: f[4],
        run: f[2],
        points: [],
      });
    const t = groups.get(key);
    let p = t.points.find((p: any) => p.lead === lead);
    if (!p) {
      p = {
        lat,
        lon,
        lead,
        pressure: Number(f[9]) > 0 ? Number(f[9]) * 100 : null,
        windMs: Number(f[8]) > 0 ? Number(f[8]) * 0.514444 : null,
        radii: [],
        radiusMaxWindKm: Number(f[19]) > 0 ? Number(f[19]) * 1.852 : null,
      };
      t.points.push(p);
    }
    if (
      ["34", "50", "64"].includes(f[11]) &&
      ["NEQ", "SEQ", "SWQ", "NWQ", "AAA"].includes(f[12])
    ) {
      const r = f
        .slice(13, 17)
        .map((s) => (s === "" ? null : Number(s) * 1.852));
      p.radii.push({
        thresholdKt: Number(f[11]),
        orientation: f[12],
        quadrantsKm: r,
      });
    }
  }
  return [...groups.values()]
    .map((t) => ({
      ...t,
      points: t.points.sort((a: any, b: any) => a.lead - b.lead),
    }))
    .filter((t) => t.points.length > 1);
}
