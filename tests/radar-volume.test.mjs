import test from "node:test";
import assert from "node:assert/strict";
import { deflateSync } from "node:zlib";
import {
  VOLUME_HEIGHTS,
  volumeStamp,
  parseVolumeLine,
  linePosition,
  distanceKm,
  sampleVolume,
  viewingOrder,
  crossSection,
  parseVolumeNames,
} from "../lib/radar-volume.mjs";
import { decodeGrayPNG, decodeVolume } from "../lib/radar-volume-decode.mjs";
test("33 real altitude levels and exact second timestamps", () => {
  assert.equal(VOLUME_HEIGHTS.length, 33);
  assert.equal(VOLUME_HEIGHTS[0], 0.5);
  assert.equal(VOLUME_HEIGHTS.at(-1), 19);
  assert.equal(volumeStamp("2026-10-09T03:28:54Z"), "20261009-032854");
  assert.throws(() => volumeStamp("bad"));
});
test("line bounds, finite numbers and minimum length are enforced", () => {
  assert.ok(parseVolumeLine([144, 13], [145, 14]) > 100);
  for (const v of [
    [
      [121, 23],
      [122, 24],
    ],
    [
      [144, 13],
      [144, 13],
    ],
    [
      [NaN, 13],
      [145, 14],
    ],
    [[144], [145, 14]],
  ])
    assert.throws(() => parseVolumeLine(...v));
});
test("great circle endpoints and side reversal preserve measurement order", () => {
  const a = [144, 13],
    b = [146, 15];
  const p = linePosition(a, b, 0.5);
  assert.ok(distanceKm(a, p) > 0);
  assert.ok(Math.abs(distanceKm(a, p) - distanceKm(p, b)) < 1e-6);
  assert.ok(Math.abs(linePosition(a, b, 0)[0] - 144) < 1e-8);
  assert.deepEqual(viewingOrder("left", 3), [0, 1, 2]);
  assert.deepEqual(viewingOrder("right", 3), [2, 1, 0]);
});
test("native nearest sample retains missing cells, never bridges them", () => {
  const g = { west: 144, north: 14, cols: 2, rows: 2, dx: 1, dy: 1 },
    v = new Float32Array([20, NaN, -999, 45]);
  assert.equal(sampleVolume(g, v, [144, 14]), 20);
  assert.equal(sampleVolume(g, v, [145, 14]), null);
  assert.equal(sampleVolume(g, v, [144, 13]), null);
  assert.equal(sampleVolume(g, v, [130, 13]), null);
  assert.deepEqual(crossSection(v, g, [144, 14], [145, 14], 3), [
    20,
    null,
    null,
  ]);
});
test("manifest filenames omit mutable latest alias and preserve seconds", () => {
  const html =
    "MRMS_MergedReflectivityQC_00.50_20261009-032854.grib2.gz MRMS_MergedReflectivityQC_00.50.latest.grib2.gz MRMS_MergedReflectivityQC_00.50_20261009-032854.grib2.gz";
  assert.deepEqual(parseVolumeNames(html, 0.5), [
    { time: "2026-10-09T03:28:54Z", stamp: "20261009-032854" },
  ]);
});
const chunk = (name, b) => {
  const out = Buffer.alloc(b.length + 12);
  out.writeUInt32BE(b.length);
  out.write(name, 4);
  b.copy(out, 8);
  return out;
};
const png = (depth, raw) => {
  const h = Buffer.alloc(13);
  h.writeUInt32BE(2);
  h.writeUInt32BE(1, 4);
  h[8] = depth;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", h),
    chunk("IDAT", deflateSync(Buffer.from(raw))),
    chunk("IEND", Buffer.alloc(0)),
  ]);
};
test("PNG packed unsigned 16-bit values keep full precision", () => {
  assert.deepEqual(
    [...decodeGrayPNG(png(16, [0, 1, 0, 255, 255]), 2)],
    [256, 65535],
  );
  assert.deepEqual([...decodeGrayPNG(png(8, [1, 10, 10]), 2)], [10, 20]);
  assert.throws(() => decodeGrayPNG(png(16, [0, 1, 0, 255, 255]), 3));
  assert.throws(() => decodeGrayPNG(png(8, [5, 10, 20]), 2));
  assert.throws(() =>
    decodeVolume(new Uint8Array([1, 2, 3]), "2026-10-09T03:28:54Z", 0.5),
  );
});
