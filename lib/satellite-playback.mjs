export function satelliteAnimationFrames(start, end, stepMinutes) {
  const first = Date.parse(start), last = Date.parse(end), step = stepMinutes * 60_000;
  if (![first, last, step].every(Number.isFinite) || step <= 0 || first > last) return [];
  const frames = [];
  for (let time = first; time <= last; time += step) frames.push(new Date(time).toISOString());
  return frames;
}

export function resolveSatelliteAnimationStart(requestedStart, end, hours) {
  const last = Date.parse(end), requested = Date.parse(requestedStart), duration = hours * 3_600_000;
  if (!Number.isFinite(last) || !Number.isFinite(duration) || duration <= 0) return "";
  const first = Number.isFinite(requested) && requested < last ? requested : last - duration;
  return new Date(first).toISOString();
}
