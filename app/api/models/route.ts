import { upstream, json, failed } from "@/lib/upstream";
import { decodeBUFR, toTracks } from "@/lib/decode-bufr.mjs";
const configs: Record<
  string,
  { folder: string; label: string; color: string }
> = {
  ifs: { folder: "ifs", label: "ECMWF IFS ENS", color: "#61d8ee" },
  aifs: { folder: "aifs-ens", label: "ECMWF AIFS ENS", color: "#ba9dff" },
};
const cache = new Map<string, { expires: number; data: unknown }>();
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("model") || "ifs";
  const config = configs[id];
  if (!config) return Response.json({ error: "不支援的模式" }, { status: 400 });
  const hit = cache.get(id);
  if (hit && hit.expires > Date.now()) return json(hit.data, 600);
  try {
    const now = new Date();
    now.setUTCMinutes(0, 0, 0);
    now.setUTCHours(Math.floor(now.getUTCHours() / 6) * 6);
    let found: any;
    const attempts: string[] = [];
    for (let i = 0; i < 8 && !found; i++) {
      const d = new Date(now.getTime() - i * 6 * 3600000),
        date = d.toISOString().slice(0, 10).replaceAll("-", ""),
        hh = String(d.getUTCHours()).padStart(2, "0"),
        // IFS ENS tropical-cyclone trajectories run to +240 h at 00/12Z
        // and +144 h at 06/18Z. AIFS ENS runs to +360 h at every cycle.
        lead = id === "ifs" && (hh === "06" || hh === "18") ? 144 : id === "ifs" ? 240 : 360;
      const url = `https://storage.googleapis.com/ecmwf-open-data/${date}/${hh}z/${config.folder}/0p25/enfo/${date}${hh}0000-${lead}h-enfo-tf.bufr`;
      try {
        const r = await fetch(url, { signal: AbortSignal.timeout(18000) });
        attempts.push(`${url}: ${r.status}`);
        if (r.ok)
          found = {
            url,
            run: d.toISOString(),
            lead,
            bytes: await r.arrayBuffer(),
          };
      } catch (e) {
        attempts.push(String(e));
      }
    }
    if (!found) throw Error("最近 48 小時未取得可用系集檔案");
    const bytes = found.bytes;
    if (bytes.byteLength > 12000000) throw Error("資料超過解碼限制");
    const decoded = decodeBUFR(bytes),
      tracks = toTracks(decoded);
    const data = {
      id,
      label: config.label,
      color: config.color,
      run: found.run,
      lead: found.lead,
      checkedAt: new Date().toISOString(),
      source: found.url,
      tracks,
      stormCount: new Set(tracks.map((t: any) => t.storm)).size,
      memberCount: new Set(tracks.map((t: any) => t.member)).size,
      trackCount: tracks.length,
      scope: "Western North Pacific",
      decoder: "ECMWF BUFR4 316082 (ecCodes parity tested)",
    };
    cache.set(id, { expires: Date.now() + 600000, data });
    return json(data, 600);
  } catch (e) {
    return failed(e);
  }
}
