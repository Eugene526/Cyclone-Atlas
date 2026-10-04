import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { parseJmaBestTrack } from "../lib/jma-best-track.mjs";

test("parses JMA year-file headers, UTC fixes, intensity and wind radii", () => {
  const text = [
    "66666 2601 002 0001 2601 0 6                 SAMPLE              20261004",
    "26010100 002 3 100 1400  990     040     30180 0140 30400 0260",
    "26010106 002 5 105 1410  970     080     40250 0200 40500 0300",
  ].join("\n");
  const [storm] = parseJmaBestTrack(text, 2026);
  assert.equal(storm.name, "SAMPLE");
  assert.equal(storm.points.length, 2);
  assert.equal(storm.points[0].time, "2026-01-01T00:00:00Z");
  assert.equal(storm.points[0].pressure, 99000);
  assert.equal(storm.points[0].windMs, 40 * 0.514444);
  assert.equal(storm.points[0].radius50.longestKm, 180 * 1.852);
  assert.equal(storm.points[0].radius30.shortestKm, 260 * 1.852);
});

test("current JMA 2026 best-track archive parses into multi-point storms", () => {
  const fixture = "work/jma-best-2026.txt";
  if (!fs.existsSync(fixture)) return;
  const storms = parseJmaBestTrack(fs.readFileSync(fixture, "utf8"), 2026);
  assert.ok(storms.length > 0);
  assert.ok(storms.every((storm) => storm.points.length > 1));
  assert.ok(storms.flatMap((storm) => storm.points).every((p) =>
    Number.isFinite(p.lat) && Number.isFinite(p.lon) && p.time.endsWith("Z"),
  ));
});
