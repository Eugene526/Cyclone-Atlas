import { upstream, json, failed } from "@/lib/upstream";
export async function GET() {
  try {
    const data: any = await (
      await upstream("https://himawari8.nict.go.jp/img/D531106/latest.json")
    ).json();
    const time = data.date.replace(" ", "T") + "Z";
    if (!Number.isFinite(Date.parse(time))) throw new Error("來源時間格式異常");
    return json(
      {
        time,
        file: data.file,
        source: "NICT / JMA Himawari",
        checkedAt: new Date().toISOString(),
        cadenceMinutes: 10,
        archiveNote: "歷史資料可用性依來源；缺圖不會以其他時刻取代。",
      },
      60,
    );
  } catch (e) {
    return failed(e);
  }
}
