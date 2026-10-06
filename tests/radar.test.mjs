import test from "node:test";
import assert from "node:assert/strict";
import {
  selectRadarFrame,
  radarStamp,
  radarISO,
  dbzColor,
  parseCwaRadar,
} from "../lib/radar.mjs";
test("radar never takes future or stale observations", () => {
  const frames = [
    { time: "2026-10-06T12:00:00Z" },
    { time: "2026-10-06T12:05:00Z" },
  ];
  assert.equal(
    selectRadarFrame(frames, "2026-10-06T12:04:00Z").time,
    frames[0].time,
  );
  assert.equal(selectRadarFrame(frames, "2026-10-06T12:16:00Z"), null);
  assert.equal(selectRadarFrame(frames, "2026-10-06T11:59:00Z"), null);
});
test("JMA timestamps roundtrip and CWA missing data transparent", () => {
  assert.equal(radarStamp(radarISO("20261006121500")), "20261006121500");
  assert.equal(dbzColor(-999)[3], 0);
  assert.equal(dbzColor(-99)[3], 0);
  assert.equal(dbzColor(50)[3], 230);
  assert.throws(() =>
    parseCwaRadar(
      "<DateTime>2026-10-06T12:00:00Z</DateTime>",
      "2026-10-06T12:00:00Z",
    ),
  );
});
import {
  JMA_NATIVE_ZOOMS,
  radarNativeZoom,
  jmaTileURL,
  createPriorityQueue,
  radarLookahead,
} from "../lib/radar-loading.mjs";
import TileGrid from "ol/tilegrid/TileGrid.js";
test("JMA never requests odd transparent placeholder zooms; overscaling retains z10", () => {
  assert.deepEqual(
    [3.8, 4, 5, 5.9, 6, 7, 8, 9, 10, 12].map(radarNativeZoom),
    [4, 4, 4, 6, 6, 6, 8, 8, 10, 10],
  );
  const grid = new TileGrid({
    origin: [-20037508.342789244, 20037508.342789244],
    resolutions: JMA_NATIVE_ZOOMS.map((z) => 156543.03392804097 / 2 ** z),
  });
  for (const zoom of [4, 5, 6, 7, 8, 9, 10, 12]) {
    const index = grid.getZForResolution(
        156543.03392804097 / 2 ** zoom,
        jmaResolutionDirection,
      ),
      url = new URL(
        jmaTileURL("2026-10-06T13:35:00Z", [index, 0, 0]),
        "http://localhost",
      );
    assert.equal(Number(url.searchParams.get("z")), radarNativeZoom(zoom));
  }
  assert.equal(jmaTileURL("2026-10-06T13:35:00Z", [4, 0, 0]), undefined);
});
test("prefetch wraps animation end instead of leaving the first frame cold", () => {
  assert.deepEqual(
    radarLookahead(
      "2026-10-06T12:20:00Z",
      "2026-10-06T12:20:00Z",
      "2026-10-06T12:00:00Z",
      10,
    ),
    [
      "2026-10-06T12:00:00.000Z",
      "2026-10-06T12:10:00.000Z",
      "2026-10-06T12:20:00.000Z",
    ],
  );
  assert.deepEqual(radarLookahead("bad", "bad", "bad", 0), []);
});
test("bounded loader runs selected frame ahead of queued prefetch and releases after errors", async () => {
  const queue = createPriorityQueue(1),
    events = [];
  let release;
  const first = queue(
    () =>
      new Promise((r) => {
        release = r;
      }),
  );
  await Promise.resolve();
  const background = queue(() => events.push("prefetch"), 1);
  const foreground = queue(() => events.push("current"), 0);
  release();
  await Promise.all([first, background, foreground]);
  assert.deepEqual(events, ["current", "prefetch"]);
  await assert.rejects(queue(() => Promise.reject(Error("source failed"))));
  await queue(() => events.push("recovered"));
  assert.equal(events.at(-1), "recovered");
});
import { incomingLayerReady } from "../lib/radar-loading.mjs";
test("playback readiness ignores unrelated overlays and the outgoing high resolution frame", () => {
  const old = { renderComplete: false },
    incoming = { renderComplete: true };
  assert.equal(incomingLayerReady(incoming), true);
  assert.equal(incomingLayerReady(old), false);
  assert.equal(incomingLayerReady(null), false);
});
import { jmaResolutionDirection } from "../lib/radar-loading.mjs";
test("floating point noise at zoom 10 still selects the highest native JMA resolution", () => {
  const grid = new TileGrid({
      origin: [0, 0],
      resolutions: JMA_NATIVE_ZOOMS.map((z) => 156543.03392804097 / 2 ** z),
    }),
    r = 156543.03392804097 / 2 ** 10;
  assert.equal(
    grid.getZForResolution(r * (1 + Number.EPSILON), jmaResolutionDirection),
    3,
  );
  assert.equal(
    grid.getZForResolution(156543.03392804097 / 2 ** 9, jmaResolutionDirection),
    2,
  );
});
