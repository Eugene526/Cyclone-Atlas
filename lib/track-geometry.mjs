// Keep consecutive longitudes in the same continuous world. Never draw a 359° segment.
export function unwrapTrack(points) {
  let previous;
  return points.map(p => {
    let lon = p.lon;
    if (previous === undefined) lon = ((lon % 360) + 360) % 360;
    else lon += 360 * Math.round((previous - lon) / 360);
    previous = lon;
    return [lon, p.lat];
  });
}

// Densify API fixes along great-circle arcs. This only smooths projected
// geometry; it does not introduce additional forecast fixes or data.
export function densifyTrack(points, maxSegmentKm = 35) {
  if (!Array.isArray(points) || points.length < 2) {
    return (points || []).map(p => [p.lon, p.lat]);
  }
  const valid = points.filter(p => Number.isFinite(p?.lon) && Number.isFinite(p?.lat));
  if (valid.length < 2) return valid.map(p => [p.lon, p.lat]);
  const rad = Math.PI / 180;
  const vector = (lon, lat) => {
    const l = lon * rad, b = lat * rad, c = Math.cos(b);
    return [c * Math.cos(l), c * Math.sin(l), Math.sin(b)];
  };
  const result = [[((valid[0].lon % 360) + 360) % 360, valid[0].lat]];
  for (let index = 0; index < valid.length - 1; index++) {
    const a = valid[index], b = valid[index + 1];
    const lonA = result.at(-1)[0];
    const lonB = b.lon + 360 * Math.round((lonA - b.lon) / 360);
    const va = vector(lonA, a.lat), vb = vector(lonB, b.lat);
    const dot = Math.max(-1, Math.min(1, va[0]*vb[0] + va[1]*vb[1] + va[2]*vb[2]));
    const omega = Math.acos(dot), distance = omega * 6371.0088;
    const segments = Math.max(1, Math.ceil(distance / Math.max(1, maxSegmentKm)));
    for (let step = 1; step <= segments; step++) {
      if (step === segments) {
        result.push([lonB, b.lat]);
        continue;
      }
      const t = step / segments;
      let x, y, z;
      if (omega < 1e-8) {
        x = va[0] * (1-t) + vb[0] * t;
        y = va[1] * (1-t) + vb[1] * t;
        z = va[2] * (1-t) + vb[2] * t;
      } else {
        const left = Math.sin((1-t)*omega) / Math.sin(omega);
        const right = Math.sin(t*omega) / Math.sin(omega);
        x = left*va[0] + right*vb[0]; y = left*va[1] + right*vb[1]; z = left*va[2] + right*vb[2];
      }
      const lat = Math.atan2(z, Math.hypot(x, y)) / rad;
      let lon = Math.atan2(y, x) / rad;
      lon += 360 * Math.round((result.at(-1)[0] - lon) / 360);
      result.push([lon, lat]);
    }
  }
  return result;
}
