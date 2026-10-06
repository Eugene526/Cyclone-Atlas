"use client";
import { radarWorker } from "@/lib/portable-workers";
import { useEffect, useRef, useState } from "react";
import Map from "ol/Map";
import TileLayer from "ol/layer/Tile";
import ImageLayer from "ol/layer/Image";
import XYZ from "ol/source/XYZ";
import ImageStatic from "ol/source/ImageStatic";
import Projection from "ol/proj/Projection";
import { addProjection, addCoordinateTransforms, transform } from "ol/proj";
import proj4 from "proj4";
import TileGrid from "ol/tilegrid/TileGrid";
import TileState from "ol/TileState";
import { get as getProjection } from "ol/proj";
import { getIntersection, isEmpty } from "ol/extent";
import {
  JMA_NATIVE_ZOOMS,
  jmaTileURL,
  jmaResolutionDirection,
  createPriorityQueue,
} from "@/lib/radar-loading.mjs";
import { selectRadarFrame } from "@/lib/radar.mjs";
const crs = new Projection({
  code: "CWA-TWD67",
  units: "degrees",
  extent: [115, 18, 126.5, 29],
});
addProjection(crs);
const p67 =
    "+proj=tmerc +lat_0=0 +lon_0=121 +k=0.9999 +x_0=250000 +y_0=0 +a=6378160 +rf=298.25",
  p97 =
    "+proj=tmerc +lat_0=0 +lon_0=121 +k=0.9999 +x_0=250000 +y_0=0 +ellps=GRS80";
addCoordinateTransforms(
  crs,
  "EPSG:3857",
  (c) => {
    if (!c.every(Number.isFinite)) return [NaN, NaN];
    const xy = proj4("+proj=longlat +a=6378160 +rf=298.25", p67, c);
    if (!xy.every(Number.isFinite)) return [NaN, NaN];
    return transform(
      proj4(p97, "EPSG:4326", [xy[0] + 828.589, xy[1] - 206.915]),
      "EPSG:4326",
      "EPSG:3857",
    );
  },
  (c) => {
    if (!c.every(Number.isFinite)) return [NaN, NaN];
    const xy = proj4("EPSG:4326", p97, transform(c, "EPSG:3857", "EPSG:4326"));
    if (!xy.every(Number.isFinite)) return [NaN, NaN];
    return proj4(p67, "+proj=longlat +a=6378160 +rf=298.25", [
      xy[0] - 828.589,
      xy[1] + 206.915,
    ]);
  },
);

type RadarProps = {
  time: string;
  playing: boolean;
  nextTimes: string[];
  radars: string[];
  onRadarReady: (b: boolean) => void;
  onRadarStatus: (s: string) => void;
};
type Prepared = {
  key: string;
  provider: string;
  time: string;
  layer: any;
  dispose: () => void;
};
const japanExtent = transform([120, 18], "EPSG:4326", "EPSG:3857").concat(
  transform([155, 49], "EPSG:4326", "EPSG:3857"),
);
const worldExtent = getProjection("EPSG:3857")!.getExtent();
const japanGrid = new TileGrid({
  extent: worldExtent,
  origin: [worldExtent[0], worldExtent[3]],
  tileSize: 256,
  resolutions: JMA_NATIVE_ZOOMS.map(
    (z: number) => (worldExtent[2] - worldExtent[0]) / 256 / 2 ** z,
  ),
});

export function useRadar(map: React.RefObject<Map | null>, p: RadarProps) {
  const cb = useRef(p);
  cb.current = p;
  const retiring = useRef<Prepared[]>([]);
  const alive = useRef(true),
    layers = useRef<Prepared[]>([]),
    [manifests, setManifests] = useState<Record<string, any>>({}),
    [viewEpoch, setViewEpoch] = useState(0);
  const frames = useRef(
    new globalThis.Map<string, { provider: string; job: Promise<Prepared> }>(),
  );
  const tiles = useRef(
    new globalThis.Map<string, Promise<HTMLImageElement | null>>(),
  );
  const tileQueue = useRef(createPriorityQueue(6)),
    cwaQueue = useRef(createPriorityQueue(2));
  useEffect(() => {
    alive.current = true;
    const m = map.current;
    const move = () => setViewEpoch((v) => v + 1);
    m?.on("moveend", move);
    return () => {
      alive.current = false;
      m?.un("moveend", move);
      frames.current.forEach((e) =>
        e.job.then((f) => f.dispose()).catch(() => {}),
      );
      frames.current.clear();
      tiles.current.clear();
    };
  }, []);
  useEffect(() => {
    let dead = false;
    const refresh = async () => {
      await Promise.all(
        p.radars.map(async (provider) => {
          try {
            const r = await fetch("/api/radar?provider=" + provider, {
                signal: AbortSignal.timeout(20000),
              }),
              j: any = await r.json();
            if (!r.ok) throw Error(j.error);
            if (!dead)
              setManifests((old) => {
                const previous = old[provider];
                return previous &&
                  !previous.error &&
                  previous.frames[0]?.time === j.frames[0]?.time &&
                  previous.frames.at(-1)?.time === j.frames.at(-1)?.time
                  ? old
                  : { ...old, [provider]: j };
              });
          } catch (e) {
            if (!dead)
              setManifests((old) =>
                old[provider]?.frames?.length
                  ? old
                  : { ...old, [provider]: { frames: [], error: String(e) } },
              );
          }
        }),
      );
    };
    refresh();
    const timer = setInterval(refresh, 60000);
    return () => {
      dead = true;
      clearInterval(timer);
    };
  }, [p.radars.join(",")]);

  function tileImage(url: string, priority: number) {
    const hit = tiles.current.get(url);
    if (hit) {
      tiles.current.delete(url);
      tiles.current.set(url, hit);
      return hit;
    }
    const job = tileQueue.current(async () => {
      let response: Response | undefined;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          response = await fetch(url, {
            cache: "force-cache",
            signal: AbortSignal.timeout(18000),
          });
          if (!response.ok) throw Error("日本雷達圖磚未就緒");
          break;
        } catch (e) {
          if (attempt) throw e;
          await new Promise((r) => setTimeout(r, 200));
        }
      }
      if (response!.status === 204) return null;
      const objectURL = URL.createObjectURL(await response!.blob());
      try {
        const image = new Image();
        image.src = objectURL;
        await image.decode();
        return image;
      } finally {
        URL.revokeObjectURL(objectURL);
      }
    }, priority) as Promise<HTMLImageElement | null>;
    tiles.current.set(url, job);
    job.catch(() => tiles.current.delete(url));
    while (tiles.current.size > 192)
      tiles.current.delete(tiles.current.keys().next().value!);
    return job;
  }
  function visibleTiles(time: string) {
    const m = map.current;
    if (!m) return [];
    const extent = getIntersection(
      m.getView().calculateExtent(m.getSize()),
      japanExtent,
    );
    if (isEmpty(extent)) return [];
    const z = japanGrid.getZForResolution(
        m.getView().getResolution()!,
        jmaResolutionDirection,
      ),
      range = japanGrid.getTileRangeForExtentAndZ(extent, z),
      urls: string[] = [];
    for (let x = range.minX; x <= range.maxX; x++)
      for (let y = range.minY; y <= range.maxY; y++) {
        const url = jmaTileURL(time, [z, x, y]);
        if (url) urls.push(url);
      }
    return urls;
  }
  function trimFrames() {
    for (const provider of ["jma", "cwa"]) {
      const limit = provider === "jma" ? 6 : 12;
      const entries = [...frames.current].filter(
        ([, e]) => e.provider === provider,
      );
      for (const [key, entry] of entries) {
        if (
          [...frames.current.values()].filter((e) => e.provider === provider)
            .length <= limit
        )
          break;
        if ([...layers.current, ...retiring.current].some((l) => l.key === key))
          continue;
        frames.current.delete(key);
        entry.job.then((f) => f.dispose()).catch(() => {});
      }
    }
  }
  function prepare(provider: string, time: string, priority: number) {
    const key = provider + ":" + time;
    const hit = frames.current.get(key);
    if (hit) {
      frames.current.delete(key);
      frames.current.set(key, hit);
      return hit.job;
    }
    const job = (async (): Promise<Prepared> => {
      if (provider === "jma") {
        const source = new XYZ({
          tileGrid: japanGrid,
          zDirection: jmaResolutionDirection,
          wrapX: false,
          transition: 0,
          interpolate: false,
          tileUrlFunction: (coord) => jmaTileURL(time, coord),
          tileLoadFunction: (tile: any, url) => {
            tileImage(url, priority)
              .then((image) => {
                if (image) tile.setImage(image);
                else tile.setState(TileState.EMPTY);
              })
              .catch(() => tile.setState(TileState.ERROR));
          },
        });
        const layer = new TileLayer({
          source,
          opacity: 0,
          extent: japanExtent,
          cacheSize: 24,
        });
        return { key, provider, time, layer, dispose: () => layer.dispose() };
      }
      return cwaQueue.current(async () => {
        const r = await fetch(
          "/api/radar?provider=cwa&time=" + encodeURIComponent(time),
          { cache: "force-cache", signal: AbortSignal.timeout(50000) },
        );
        if (!r.ok) {
          const j: any = await r.json();
          throw Error(j.error);
        }
        const bytes = await r.arrayBuffer();
        const raw = await new Promise<any>((resolve, reject) => {
          const worker = new radarWorker();
          const timer = setTimeout(() => {
            worker.terminate();
            reject(Error("雷達解碼逾時"));
          }, 20000);
          const end = () => {
            clearTimeout(timer);
            worker.terminate();
          };
          worker.onmessage = (e) => {
            end();
            e.data.error ? reject(Error(e.data.error)) : resolve(e.data);
          };
          worker.onerror = () => {
            end();
            reject(Error("雷達解碼失敗"));
          };
          worker.postMessage(bytes, [bytes]);
        });
        const url = URL.createObjectURL(raw.blob);
        try {
          const image = new Image();
          image.src = url;
          await image.decode();
          const a = raw.meta,
            layer = new ImageLayer({
              source: new ImageStatic({
                url,
                projection: crs,
                imageExtent: [
                  a.west - a.step / 2,
                  a.south - a.step / 2,
                  a.west + (a.cols - 0.5) * a.step,
                  a.south + (a.rows - 0.5) * a.step,
                ],
                interpolate: false,
              }),
              opacity: 0,
            });
          return {
            key,
            provider,
            time,
            layer,
            dispose: () => {
              layer.dispose();
              URL.revokeObjectURL(url);
            },
          };
        } catch (e) {
          URL.revokeObjectURL(url);
          throw e;
        }
      }, priority);
    })();
    frames.current.set(key, { provider, job });
    job.catch(() => frames.current.delete(key));
    trimFrames();
    return job;
  }
  async function readyFrame(provider: string, time: string, priority: number) {
    const frame = await prepare(provider, time, priority);
    if (provider === "jma")
      await Promise.all(
        visibleTiles(time).map((url) => tileImage(url, priority)),
      );
    return frame;
  }
  useEffect(() => {
    const m = map.current;
    if (!m || !p.time) return;
    let cancelled = false,
      fadeID = 0;
    cb.current.onRadarReady(false);
    cb.current.onRadarStatus(
      p.radars.length ? "準備雷達影格；載入期間保留上一張觀測…" : "",
    );
    // Start the selected frame first, then prebuffer independently (not after rendering).
    const selected = p.radars.map((provider) => {
      const manifest = manifests[provider],
        f = selectRadarFrame(manifest?.frames || [], p.time);
      if (!f)
        return Promise.resolve({
          provider,
          frame: null,
          error:
            manifest?.error ||
            (manifest ? "此時間無可用雷達" : "雷達清單載入中"),
        });
      return readyFrame(provider, f.time, 0)
        .then((frame) => ({ provider, frame, error: "" }))
        .catch((e) => ({ provider, frame: null, error: String(e) }));
    });
    for (const t of p.nextTimes.slice(0, 3))
      for (const provider of p.radars) {
        const f = selectRadarFrame(manifests[provider]?.frames || [], t);
        if (f) readyFrame(provider, f.time, 1).catch(() => {});
      }
    Promise.all(selected).then((results) => {
      if (cancelled || !alive.current) return;
      const next = results.flatMap((r) => (r.frame ? [r.frame] : [])),
        previous = layers.current;
      for (const f of next)
        if (!m.getLayers().getArray().includes(f.layer)) {
          f.layer.set("radarOverlay", true);
          f.layer.setOpacity(0.001);
          m.getLayers().insertAt(2, f.layer);
        }
      layers.current = next;
      const outgoing = previous.filter((f) => !next.includes(f)),
        incoming = next.filter((f) => !previous.includes(f));
      retiring.current = outgoing;
      if (cb.current.playing && outgoing.length && incoming.length) {
        const start = performance.now(),
          fade = () => {
            const amount = Math.min(1, (performance.now() - start) / 160);
            incoming.forEach((f) => f.layer.setOpacity(0.8 * amount));
            outgoing.forEach((f) => f.layer.setOpacity(0.8 * (1 - amount)));
            if (amount < 1) fadeID = requestAnimationFrame(fade);
            else {
              outgoing.forEach((f) => m.removeLayer(f.layer));
              retiring.current = [];
              trimFrames();
            }
          };
        fadeID = requestAnimationFrame(fade);
      } else {
        outgoing.forEach((f) => m.removeLayer(f.layer));
        retiring.current = [];
        next.forEach((f) => f.layer.setOpacity(0.8));
        trimFrames();
      }
      cb.current.onRadarStatus(
        results
          .map(
            (r) =>
              (r.provider === "jma" ? "日本 mm/h" : "臺灣 dBZ") +
              " · " +
              (r.frame
                ? new Date(r.frame.time).toLocaleString("zh-TW", {
                    timeZone: "Asia/Taipei",
                  }) + " UTC+8"
                : r.error),
          )
          .join("｜"),
      );
      cb.current.onRadarReady(
        !p.radars.some((provider) => !manifests[provider]),
      );
      m.render();
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(fadeID);
      m.getLayers()
        .getArray()
        .filter(
          (l) =>
            previousRadarLayer(l) && !layers.current.some((f) => f.layer === l),
        )
        .forEach((l) => m.removeLayer(l));
      retiring.current = [];
    };
    function previousRadarLayer(layer: any) {
      return layer.get("radarOverlay") === true;
    }
  }, [p.time, p.radars.join(","), p.nextTimes.join(","), manifests, viewEpoch]);
}
