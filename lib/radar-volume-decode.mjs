import { inflateSync, gunzipSync } from "node:zlib";
import { splitMessages, parseFields, parseProduct } from "@azohra/meteo.grib";
const view = (b) => new DataView(b.buffer, b.byteOffset, b.byteLength);
const sm = (n, bits) => (n & (2 ** (bits - 1)) ? -(n - 2 ** (bits - 1)) : n);
const paeth = (a, b, c) => {
  const p = a + b - c,
    pa = Math.abs(p - a),
    pb = Math.abs(p - b),
    pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
};
// GRIB template 5.41 PNG packing uses unscaled unsigned grayscale samples.
export function decodeGrayPNG(png, expected) {
  const d = view(png);
  if (
    png.length < 33 ||
    d.getUint32(0) !== 0x89504e47 ||
    d.getUint32(4) !== 0x0d0a1a0a
  )
    throw Error("原始 PNG 簽章不符");
  let width = 0,
    height = 0,
    depth = 0;
  const chunks = [];
  for (let at = 8; at + 12 <= png.length;) {
    const n = d.getUint32(at),
      type = String.fromCharCode(...png.subarray(at + 4, at + 8));
    if (at + n + 12 > png.length) throw Error("PNG 被截斷");
    if (type === "IHDR") {
      width = d.getUint32(at + 8);
      height = d.getUint32(at + 12);
      depth = png[at + 16];
      if (
        ![8, 16].includes(depth) ||
        png[at + 17] !== 0 ||
        png[at + 18] ||
        png[at + 19] ||
        png[at + 20] ||
        width * height !== expected
      )
        throw Error("PNG 原始採樣格式不符");
    }
    if (type === "IDAT") chunks.push(png.subarray(at + 8, at + 8 + n));
    at += n + 12;
    if (type === "IEND") break;
  }
  if (!width || !chunks.length) throw Error("PNG 缺少資料");
  const bpp = depth / 8,
    stride = width * bpp,
    raw = inflateSync(Buffer.concat(chunks), {
      maxOutputLength: (stride + 1) * height,
    });
  if (raw.length !== (stride + 1) * height) throw Error("PNG 長度不符");
  const out = new Uint8Array(stride * height);
  for (let y = 0; y < height; y++) {
    const f = raw[y * (stride + 1)];
    if (f > 4) throw Error("PNG filter 不符");
    for (let x = 0; x < stride; x++) {
      const k = y * stride + x,
        a = x >= bpp ? out[k - bpp] : 0,
        b = y ? out[k - stride] : 0,
        c = y && x >= bpp ? out[k - stride - bpp] : 0;
      out[k] =
        (raw[y * (stride + 1) + 1 + x] +
          (f === 1
            ? a
            : f === 2
              ? b
              : f === 3
                ? Math.floor((a + b) / 2)
                : f === 4
                  ? paeth(a, b, c)
                  : 0)) &
        255;
    }
  }
  const result = new Uint16Array(expected);
  for (let i = 0; i < expected; i++)
    result[i] = bpp === 2 ? out[i * 2] * 256 + out[i * 2 + 1] : out[i];
  return result;
}
export function decodeVolume(bytes, time, height) {
  const fields = splitMessages(
    new Uint8Array(gunzipSync(bytes, { maxOutputLength: 32 * 1024 * 1024 })),
  ).flatMap(parseFields);
  if (fields.length !== 1) throw Error("MRMS 欄位數不符");
  const f = fields[0],
    id = f.identification,
    p = parseProduct(f.section4),
    actual = new Date(
      Date.UTC(id.year, id.month - 1, id.day, id.hour, id.minute, id.second),
    ).toISOString();
  if (
    actual !== new Date(time).toISOString() ||
    f.discipline !== 209 ||
    p.parameterCategory !== 9 ||
    p.parameterNumber !== 0 ||
    p.typeOfFirstFixedSurface !== 102 ||
    p.scaledValueOfFirstFixedSurface *
      10 ** -p.scaleFactorOfFirstFixedSurface !==
      height * 1000 ||
    p.forecastTime !== 0
  )
    throw Error("MRMS 觀測時間／高度／變數不符");
  const g = view(f.section3),
    s = view(f.section5),
    cols = g.getUint32(30),
    rows = g.getUint32(34);
  if (
    g.getUint16(12) !== 0 ||
    cols !== 2000 ||
    rows !== 1800 ||
    g.getUint32(38) !== 1 ||
    g.getUint32(42) !== 1000000 ||
    f.section3[71] !== 0 ||
    s.getUint16(9) !== 41 ||
    s.getUint32(5) !== cols * rows ||
    f.section6
  )
    throw Error("MRMS 網格或 PNG packing 不符");
  const grid = {
    cols,
    rows,
    west: g.getUint32(50) / 1e6,
    north: sm(g.getUint32(46), 32) / 1e6,
    dx: g.getUint32(63) / 1e6,
    dy: g.getUint32(67) / 1e6,
  };
  if (
    Math.abs(grid.west - 140.0025) > 0.00001 ||
    Math.abs(grid.north - 17.9975) > 0.00001 ||
    grid.dx !== 0.005 ||
    grid.dy !== 0.005
  )
    throw Error("關島網格定位不符");
  const coded = decodeGrayPNG(f.section7.subarray(5), cols * rows),
    reference = s.getFloat32(11),
    binary = 2 ** sm(s.getUint16(15), 16),
    decimal = 10 ** -sm(s.getUint16(17), 16),
    values = new Float32Array(coded.length);
  for (let i = 0; i < coded.length; i++) {
    const v = (reference + coded[i] * binary) * decimal;
    values[i] = v >= -50 && v <= 95 ? v : NaN;
  }
  return { time: actual, height, grid, values };
}
