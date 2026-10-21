import { upstream, json, failed } from "@/lib/upstream";
export async function GET() {
  try {
    const targets = await (
      await upstream("https://www.jma.go.jp/bosai/typhoon/data/targetTc.json")
    ).json();
    if (!Array.isArray(targets)) throw new Error("JMA 資料格式異常");
    const storms = await Promise.all(
      targets.map(async (t: any) => {
        if (!/^TC\d+$/.test(t.tropicalCyclone)) return null;
        try {
          const rawForecast = await (
            await upstream(
              `https://www.jma.go.jp/bosai/typhoon/data/${t.tropicalCyclone}/forecast.json`,
            )
          ).json();
          if (!Array.isArray(rawForecast)) throw new Error("JMA 預報資料格式異常");
          // The JMA probabilityCircle is center-position uncertainty, not a wind radius.
          const f = rawForecast.map((point: any) => ({
            ...point,
            centerUncertainty: point.probabilityCircle?.radius > 0
              ? { radiusMeters: point.probabilityCircle.radius, tangent: point.probabilityCircle.tangent || [] }
              : null,
          }));
          let specifications: any = [];
          try {
            specifications = await (
              await upstream(
                `https://www.jma.go.jp/bosai/typhoon/data/${t.tropicalCyclone}/specifications.json`,
              )
            ).json();
          } catch {}
          return { ...t, id: t.tropicalCyclone, data: f, specifications };
        } catch (e) {
          return { ...t, error: e instanceof Error ? e.message : "資料缺漏" };
        }
      }),
    );
    return json(
      {
        storms: storms.filter(Boolean),
        checkedAt: new Date().toISOString(),
        source: "Japan Meteorological Agency",
        sourceUrl: "https://www.jma.go.jp/bosai/map.html#contents=typhoon",
      },
      180,
    );
  } catch (e) {
    return failed(e);
  }
}
