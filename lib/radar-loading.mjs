// JMA advertises zoomUse="even": odd zoom images are transparent placeholders.
export const JMA_NATIVE_ZOOMS = [4, 6, 8, 10];
export const radarNativeZoom = (zoom) =>
  Math.max(4, Math.min(10, Math.floor((zoom + 0.5 + 1e-8) / 2) * 2));
export function jmaTileURL(time, coordinate) {
  const [index, x, y] = coordinate,
    z = JMA_NATIVE_ZOOMS[index];
  if (
    z === undefined ||
    !Number.isInteger(x) ||
    !Number.isInteger(y) ||
    x < 0 ||
    y < 0 ||
    x >= 2 ** z ||
    y >= 2 ** z
  )
    return undefined;
  return (
    "/api/radar?" +
    new URLSearchParams({
      provider: "jma",
      time,
      z: String(z),
      x: String(x),
      y: String(y),
    })
  );
}
export function createPriorityQueue(limit) {
  let active = 0;
  const pending = [];
  const drain = () => {
    while (active < limit && pending.length) {
      pending.sort((a, b) => a.priority - b.priority);
      const next = pending.shift();
      active++;
      Promise.resolve()
        .then(next.run)
        .then(next.resolve, next.reject)
        .finally(() => {
          active--;
          drain();
        });
    }
  };
  return (run, priority = 0) =>
    new Promise((resolve, reject) => {
      pending.push({ run, priority, resolve, reject });
      drain();
    });
}
export function radarLookahead(time, end, start, stepMinutes, count = 3) {
  const last = Date.parse(end),
    first = Date.parse(start),
    step = stepMinutes * 60000;
  let cursor = Date.parse(time);
  const result = [];
  if (
    ![last, first, cursor, step].every(Number.isFinite) ||
    step <= 0 ||
    first > last
  )
    return result;
  for (let i = 0; i < count; i++) {
    cursor += step;
    if (cursor > last) cursor = first;
    result.push(new Date(cursor).toISOString());
  }
  return [...new Set(result)];
}
// Wait only for the incoming imagery renderer, never every overlay/old frame on the map.
export const incomingLayerReady = (renderer) =>
  renderer?.renderComplete === true;
// OL's view and tile grid may differ by a few floating point ulps at an exact zoom.
export const jmaResolutionDirection = (target, coarse, fine) =>
  target <= fine * Math.SQRT2 * (1 + 1e-8) ? -1 : 1;
