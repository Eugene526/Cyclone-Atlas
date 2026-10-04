import { upstream, json, failed } from "@/lib/upstream";
import { parseJmaBestTrack } from "@/lib/jma-best-track.mjs";

const cache = new Map<number, { expires: number; data: unknown }>();
const base = "https://www.jma.go.jp/jma/jma-eng/jma-center/rsmc-hp-pub-eg/Besttracks";

export async function GET(req: Request) {
  const rawYear = new URL(req.url).searchParams.get("year");
  const year = Number(rawYear);
  const currentYear = new Date().getUTCFullYear();
  if (!Number.isInteger(year) || year < 1951 || year > currentYear)
    return Response.json({ error: `年份需介於 1951–${currentYear}` }, { status: 400 });
  const cached = cache.get(year);
  if (cached && cached.expires > Date.now()) return json(cached.data, 3600);
  try {
    const url = `${base}/bst${year}.txt`;
    const response = await upstream(url);
    const text = await response.text();
    const storms = parseJmaBestTrack(text, year);
    if (!storms.length) throw new Error("日本氣象廳歷史最佳路徑資料目前沒有有效路徑");
    const data = {
      year,
      storms,
      count: storms.length,
      checkedAt: new Date().toISOString(),
      source: "Japan Meteorological Agency RSMC Tokyo Best Track",
      sourceUrl: "https://www.jma.go.jp/jma/jma-eng/jma-center/rsmc-hp-pub-eg/besttrack.html",
    };
    cache.set(year, { data, expires: Date.now() + 3600000 });
    return json(data, 3600);
  } catch (error) {
    return failed(error);
  }
}
