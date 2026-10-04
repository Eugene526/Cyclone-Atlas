import { upstream, json, failed } from "@/lib/upstream";
import { parseATCF } from "@/lib/atcf";
const configs: Record<string, any> = {
  wnv3: { code: "WNV3", label: "Google WeatherNext 3", color: "#ff91ab" },
  google: {
    code: "OPER",
    label: "Google WeatherNext Cyclones",
    color: "#8aafff",
  },
  fnv3: { code: "FNV3P2", label: "Google FNV3P2", color: "#ffbe88" },
};
const cache = new Map<string, any>();
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("model") || "wnv3",
    c = configs[id];
  if (!c) return Response.json({ error: "無效 Google 模式" }, { status: 400 });
  if (cache.get(id)?.expires > Date.now()) return json(cache.get(id).data, 900);
  try {
    const now = new Date();
    now.setUTCMinutes(0, 0, 0);
    now.setUTCHours(Math.floor(now.getUTCHours() / 6) * 6);
    for (let i = 0; i < 12; i++) {
      const d = new Date(+now - i * 21600000),
        stamp = d.toISOString().slice(0, 13).replaceAll("-", "_") + "_00",
        url = `https://deepmind.google.com/science/weatherlab/download/cyclones/${c.code}/ensemble/paired/atcf/${c.code}_${stamp}_atcf_a_deck.txt`;
      try {
        const r = await upstream(url),
          text = await r.text();
        if (!text.includes("# BEGIN DATA") && !text.includes(", 03,")) continue;
        const tracks = parseATCF(text);
        const data = {
          id,
          ...c,
          run: d.toISOString(),
          lead: tracks.length
            ? Math.max(
                ...tracks.flatMap((t) => t.points.map((p: any) => p.lead)),
              )
            : 0,
          checkedAt: new Date().toISOString(),
          source: url,
          tracks,
          stormCount: new Set(tracks.map((t) => t.storm)).size,
          memberCount: new Set(tracks.map((t) => t.member)).size,
          scope: "Western North Pacific",
          decoder: "ATCF",
          experimental: true,
          terms:
            "https://storage.googleapis.com/weathernext-public/terms-of-use.pdf",
        };
        cache.set(id, { expires: Date.now() + 900000, data });
        return json(data, 900);
      } catch {}
    }
    throw Error("最近 72 小時未取得此 Google 模式資料");
  } catch (e) {
    return failed(e);
  }
}
