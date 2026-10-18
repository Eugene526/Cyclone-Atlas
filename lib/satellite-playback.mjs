export function satelliteAnimationFrames(start, end, stepMinutes) {
  const first = Date.parse(start), last = Date.parse(end), step = stepMinutes * 60_000;
  if (![first, last, step].every(Number.isFinite) || step <= 0 || first > last) return [];
  const frames = [];
  for (let time = first; time <= last; time += step) frames.push(new Date(time).toISOString());
  return frames;
}
