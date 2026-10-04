import { upstream, json, failed } from "@/lib/upstream";
import { parseATCF } from "@/lib/atcf";
import { decodeBUFR, toTracks } from "@/lib/decode-bufr.mjs";

const configs: Record<string, any> = {
  gfs: { label: "GFS 確定性", color: "#40d8ff", kind: "atcf" },
  ecmwf: { label: "ECMWF IFS HRES 傳統模式", color: "#ffad42", kind: "bufr" },
};
const cache = new Map<string, any>();
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("model") || "gfs";
  const c = configs[id];
  if (!c) return Response.json({ error: "不支援的傳統模式" }, { status: 400 });
  const hit = cache.get(id);
  if (hit?.expires > Date.now()) return json(hit.data, 600);
  try {
    const now = new Date();
    now.setUTCMinutes(0, 0, 0);
    now.setUTCHours(Math.floor(now.getUTCHours() / 6) * 6);
    for (let i = 0; i < 12; i++) {
      const d = new Date(+now - i * 6 * 3600000),
        date = d.toISOString().slice(0, 10).replaceAll("-", ""),
        hh = String(d.getUTCHours()).padStart(2, "0");
      try {
        let tracks: any[], url: string;
        if (id === "gfs") {
          url = `https://nomads.ncep.noaa.gov/pub/data/nccf/com/ens_tracker/prod/gfs.${date}/${hh}/tctrack/avnop.t${hh}z.cyclone.trackatcfunix`;
          tracks = parseATCF(await (await upstream(url)).text());
        } else {
          // ECMWF Open Data HRES TC tracks: +360 h for 00/12 UTC and
          // +144 h for 06/18 UTC, all under the current `oper` stream.
          const step = hh === "00" || hh === "12" ? 360 : 144;
          const stream = "oper";
          url = `https://storage.googleapis.com/ecmwf-open-data/${date}/${hh}z/ifs/0p25/${stream}/${date}${hh}0000-${step}h-${stream}-tf.bufr`;
          const bytes = await (await upstream(url)).arrayBuffer();
          if (bytes.byteLength > 8_000_000) continue;
          tracks = toTracks(decodeBUFR(bytes)).map((t: any) => ({ ...t, member: "HRES" }));
        }
        if (!tracks.length) continue;
        const data = {
          id, ...c, run: d.toISOString(), source: url, tracks,
          lead: Math.max(...tracks.flatMap((t: any) => t.points.map((p: any) => p.lead))),
          stormCount: new Set(tracks.map((t: any) => t.storm)).size,
          memberCount: tracks.length, checkedAt: new Date().toISOString(),
        };
        cache.set(id, { data, expires: Date.now() + 600_000 });
        return json(data, 600);
      } catch {}
    }
    throw Error(id === "ecmwf" ? "最近 72 小時內未取得 ECMWF HRES 氣旋路徑資料" : "最近 72 小時內未取得 GFS 路徑");
  } catch (e) { return failed(e); }
}
