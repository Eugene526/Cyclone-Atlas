// Narrow, fail-closed decoder for ECMWF compressed BUFR4 TC template [001030,316082].
// Table metadata derived from ECMWF ecCodes 2.47; validated against ecCodes numerical output.
import template from "./bufr-template.json" with { type: "json" };
export function decodeBUFR(input) {
  const bytes = new Uint8Array(input),
    u24 = (i) => bytes[i] * 65536 + bytes[i + 1] * 256 + bytes[i + 2],
    u16 = (i) => bytes[i] * 256 + bytes[i + 1];
  let offset = 0;
  const storms = [];
  while (offset < bytes.length - 8) {
    if (String.fromCharCode(...bytes.slice(offset, offset + 4)) !== "BUFR") {
      offset++;
      continue;
    }
    const size = u24(offset + 4),
      end = offset + size;
    if (end > bytes.length || bytes[offset + 7] !== 4)
      throw Error("不支援或截斷的 BUFR 訊息");
    let s = offset + 8;
    const optional = bytes[s + 9] & 128;
    s += u24(s);
    if (optional) s += u24(s);
    const n = u16(s + 4);
    const compressed = !!(bytes[s + 6] & 64);
    if (n > 1000 || (!compressed && n !== 1)) throw Error("不支援的子集數");
    const desc = [];
    for (let i = s + 7; i < s + u24(s); i += 2) {
      const v = u16(i);
      desc.push((v >> 14) * 100000 + ((v >> 8) & 63) * 1000 + (v & 255));
    }
    if (!["1030,316082", "316082"].includes(desc.join(",")))
      throw Error("ECMWF 模板已變更，需更新解碼器");
    s += u24(s);
    let bit = (s + 4) * 8;
    const limit = (s + u24(s)) * 8;
    const read = (width) => {
      if (width > 32 || width < 0 || bit + width > limit)
        throw Error("BUFR 位元邊界異常");
      let v = 0;
      for (let j = 0; j < width; j++) {
        v = v * 2 + ((bytes[bit >> 3] >> (7 - (bit & 7))) & 1);
        bit++;
      }
      return v;
    };
    const str = (w) => {
      let s = "";
      for (let i = 0; i < w / 8; i++) s += String.fromCharCode(read(8));
      return s.trim();
    };
    const result = {};
    function field(meta) {
      const [code, w, scale, ref, type, name] = meta;
      let values;
      if (type === "string") {
        const base = str(w),
          inc = compressed ? read(6) : 0;
        values = inc
          ? Array.from({ length: n }, () => str(inc * 8))
          : Array(n).fill(base);
      } else {
        const base = read(w),
          inc = compressed ? read(6) : 0;
        if (inc > 32) throw Error("異常 BUFR 壓縮寬度");
        values = Array.from({ length: n }, () => {
          const delta = inc ? read(inc) : 0;
          return base === 2 ** w - 1 || (inc && delta === 2 ** inc - 1)
            ? null
            : (base + delta + ref) * 10 ** -scale;
        });
      }
      if (
        [
          "stormIdentifier",
          "longStormName",
          "ensembleMemberNumber",
          "year",
          "month",
          "day",
          "hour",
          "minute",
          "latitude",
          "longitude",
          "timePeriod",
          "pressureReducedToMeanSeaLevel",
          "windSpeedAt10M",
          "windSpeedThreshold",
          "effectiveRadiusWithRespectToWindSpeedsAboveThreshold",
        ].includes(name)
      ) {
        (result[name] ??= []).push(values);
      }
      return values[0];
    }
    function sequence(list) {
      for (let i = 0; i < list.length; i++) {
        const c = list[i][0];
        if (c >= 100000 && c < 200000) {
          const count = Math.floor(c / 1000) % 100,
            repeat = c % 1000;
          let reps = repeat;
          if (!repeat) reps = field(list[++i]);
          if (!Number.isInteger(reps) || reps < 0 || reps > 1000)
            throw Error("異常複製因子");
          const sub = list.slice(i + 1, i + 1 + count);
          if (sub.length !== count) throw Error("不完整模板");
          for (let k = 0; k < reps; k++) sequence(sub);
          i += count;
        } else field(list[i]);
      }
    }
    sequence(desc.length === 1 ? template.slice(1) : template);
    if (limit - bit > 8) throw Error(`BUFR 解碼尾端不吻合 ${limit - bit}`);
    storms.push(result);
    offset = end;
  }
  if (!storms.length) throw Error("沒有可讀取的 BUFR 訊息");
  return storms;
}
export function toTracks(decoded) {
  const tracks = [];
  for (const d of decoded) {
    const ids = d.ensembleMemberNumber[0];
    const n = ids.length;
    for (let m = 0; m < n; m++) {
      const points = [];
      for (let k = 0; k <= d.timePeriod.length; k++) {
        const rank = k === 0 ? 1 : 2 * k + 1;
        const lat = d.latitude[rank]?.[m],
          lon = d.longitude[rank]?.[m],
          lead = k ? d.timePeriod[k - 1]?.[m] : 0;
        if (
          lat === null ||
          lon === null ||
          !Number.isFinite(lat) ||
          !Number.isFinite(lon) ||
          Math.abs(lat) > 90 ||
          Math.abs(lon) > 180
        )
          continue;
        points.push({
          lat,
          lon,
          lead,
          pressure: d.pressureReducedToMeanSeaLevel[k]?.[m],
          windMs: d.windSpeedAt10M[k]?.[m],
          radii: [0, 1, 2].map((q) => ({
            thresholdKt: d.windSpeedThreshold[k * 3 + q]?.[m] / 0.514444,
            orientation: "NEQ",
            quadrantsKm: [0, 1, 2, 3].map((z) => {
              const value =
                d.effectiveRadiusWithRespectToWindSpeedsAboveThreshold[
                  (k * 3 + q) * 4 + z
                ]?.[m];
              return value == null ? null : value / 1000;
            }),
          })),
        });
      }
      if (
        points.length > 1 &&
        points[0].lon >= 100 &&
        points[0].lon <= 180 &&
        points[0].lat >= 0 &&
        points[0].lat <= 60
      )
        tracks.push({
          storm: d.stormIdentifier[0][m],
          name: d.longStormName[0][m],
          member: ids[m],
          points,
        });
    }
  }
  return tracks;
}
