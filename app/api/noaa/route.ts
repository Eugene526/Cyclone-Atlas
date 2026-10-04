import { upstream, json, failed } from "@/lib/upstream";
import { parseATCF } from "@/lib/atcf";
const configs: Record<string, any> = {
  gefs: { label: "NOAA GEFS", color: "#f3c775" },
  aigefs: { label: "NOAA AIGEFS", color: "#e790bd" },
  cmce: { label: "ECCC GEPS", color: "#7bde9a" },
  fens: { label: "FNMOC FENS", color: "#9db1ec" },
};
const cache = new Map<string, any>();
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("model") || "gefs",
    c = configs[id];
  if (!c) return Response.json({ error: "無效模式" }, { status: 400 });
  if (cache.get(id)?.expires > Date.now()) return json(cache.get(id).data, 900);
  try {
    const now = new Date();
    now.setUTCMinutes(0, 0, 0);
    now.setUTCHours(Math.floor(now.getUTCHours() / 6) * 6);
    let found: any;
    const attempts: string[] = [];
    for (let i = 0; i < 8 && !found; i++) {
      const d = new Date(+now - i * 21600000),
        date = d.toISOString().slice(0, 10).replaceAll("-", ""),
        hh = String(d.getUTCHours()).padStart(2, "0");
      const url = `https://nomads.ncep.noaa.gov/pub/data/nccf/com/ens_tracker/prod/${id}.${date}/${hh}/tctrack/`;
      try {
        const files =
          id === "gefs"
            ? [
                "ac00",
                ...Array.from(
                  { length: 30 },
                  (_, j) => "ap" + String(j + 1).padStart(2, "0"),
                ),
              ]
            : id === "aigefs"
              ? Array.from(
                  { length: 31 },
                  (_, j) => "a" + String(j).padStart(3, "0"),
                )
              : id === "cmce"
                ? [
                    "cc00",
                    ...Array.from(
                      { length: 20 },
                      (_, j) => "cp" + String(j + 1).padStart(2, "0"),
                    ),
                  ]
                : [
                    "nc00",
                    ...Array.from(
                      { length: 20 },
                      (_, j) => "np" + String(j + 1).padStart(2, "0"),
                    ),
                  ];
        const names = files.map((f) => `${f}.t${hh}z.cyclone.trackatcfunix`);
        const first = await (await upstream(url + names[0])).text();
        found = { url, files: names, first, run: d.toISOString() };
      } catch (e) {
        attempts.push(url + " " + String(e));
      }
    }
    if (!found) throw Error("最近 48 小時未取得模式路徑");
    const tracks: any[] = [];
    let failedFiles = 0;
    for (let i = 0; i < found.files.length; i += 5) {
      const results = await Promise.all(
        found.files.slice(i, i + 5).map(async (f: string) => {
          try {
            return parseATCF(
              f === found.files[0]
                ? found.first
                : await (await upstream(found.url + f)).text(),
            );
          } catch {
            failedFiles++;
            return [];
          }
        }),
      );
      tracks.push(...results.flat());
    }
    const data = {
      id,
      ...c,
      run: found.run,
      lead: tracks.length
        ? Math.max(...tracks.flatMap((t) => t.points.map((p: any) => p.lead)))
        : 0,
      checkedAt: new Date().toISOString(),
      source: found.url,
      tracks,
      stormCount: new Set(tracks.map((t) => t.storm)).size,
      memberCount: new Set(tracks.map((t) => t.member)).size,
      failedFiles,
      totalFiles: found.files.length,
      scope: "Western North Pacific",
      decoder: "ATCF",
    };
    if (failedFiles === found.files.length) throw Error("路徑檔案下載失敗");
    cache.set(id, { expires: Date.now() + 900000, data });
    return json(data, 900);
  } catch (e) {
    return failed(e);
  }
}
