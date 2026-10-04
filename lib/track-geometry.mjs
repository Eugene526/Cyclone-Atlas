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
