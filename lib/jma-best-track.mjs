function yearFromYY(yy) {
  return yy >= 51 ? 1900 + yy : 2000 + yy;
}

function parseAnalysisTime(value) {
  if (!/^\d{8}$/.test(value)) return null;
  const year = yearFromYY(Number(value.slice(0, 2)));
  return `${year}-${value.slice(2, 4)}-${value.slice(4, 6)}T${value.slice(6, 8)}:00:00Z`;
}

function radiusRecord(longest, shortest) {
  if (!longest || longest.length < 5 || !shortest || shortest.length < 4) return null;
  const maxNm = Number(longest.slice(1));
  const minNm = Number(shortest);
  if (!Number.isFinite(maxNm) || !Number.isFinite(minNm) || maxNm <= 0) return null;
  return {
    directionCode: Number(longest[0]),
    longestKm: maxNm * 1.852,
    shortestKm: minNm * 1.852,
  };
}

export function parseJmaBestTrack(text, year) {
  const storms = [];
  let storm = null;
  const finish = () => {
    if (storm?.points.length) storms.push(storm);
  };
  for (const raw of text.split(/\r?\n/)) {
    const fields = raw.trim().split(/\s+/);
    if (fields[0] === "66666") {
      finish();
      if (fields.length < 8 || !/^\d{4}$/.test(fields[1])) {
        storm = null;
        continue;
      }
      storm = {
        id: fields[1],
        name: fields[7].trim(),
        year,
        points: [],
      };
      continue;
    }
    if (!storm || fields.length < 7 || !/^\d{8}$/.test(fields[0]) || fields[1] !== "002") continue;
    const time = parseAnalysisTime(fields[0]);
    const lat = Number(fields[3]) / 10;
    const lon = Number(fields[4]) / 10;
    const pressureHpa = Number(fields[5]);
    const windKt = Number(fields[6]);
    if (!time || !Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon > 360) continue;
    storm.points.push({
      time,
      lat,
      lon: lon > 180 ? lon - 360 : lon,
      pressure: Number.isFinite(pressureHpa) && pressureHpa > 0 ? pressureHpa * 100 : null,
      windMs: Number.isFinite(windKt) && windKt > 0 ? windKt * 0.514444 : null,
      grade: Number(fields[2]),
      radius50: radiusRecord(fields[7], fields[8]),
      radius30: radiusRecord(fields[9], fields[10]),
    });
  }
  finish();
  return storms.filter((entry) => entry.points.length >= 2);
}
