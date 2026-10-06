"use client";
import { useEffect, useRef } from "react";
import Map from "ol/Map";
import {useRadar} from "./useRadar";
import View from "ol/View";
import TileLayer from "ol/layer/Tile";
import VectorLayer from "ol/layer/Vector";
import XYZ from "ol/source/XYZ";
import VectorSource from "ol/source/Vector";
import TileGrid from "ol/tilegrid/TileGrid";
import GeoJSON from "ol/format/GeoJSON";
import {
  transform,
  fromLonLat,
  toLonLat,
  transformExtent,
  get as getProjection,
} from "ol/proj";
import { register } from "ol/proj/proj4";
import proj4 from "proj4";
import { Style, Stroke, Fill, Circle as CircleStyle, Text } from "ol/style";
import Feature from "ol/Feature";
import { Point, LineString, Polygon } from "ol/geom";
import { circular } from "ol/geom/Polygon";
import { defaults as controls } from "ol/control";
import { stamp, lut } from "@/lib/satellite";
import {cloudTemperature} from "@/lib/cloud-probe";
import { imagery } from "@/lib/imagery";
import { unwrapTrack } from "@/lib/track-geometry.mjs";
import { unByKey } from "ol/Observable";
import "ol/ol.css";
proj4.defs(
  "HIMAWARI",
  "+proj=geos +h=35786023 +lon_0=140.7 +sweep=x +datum=WGS84 +units=m +no_defs",
);
register(proj4);
getProjection("HIMAWARI")!.setExtent([-5500000, -5500000, 5500000, 5500000]);
getProjection("HIMAWARI")!.setWorldExtent([60, -80, 220, 80]);
getProjection("HIMAWARI")!.setGetPointResolution((resolution) => resolution);
export type MapAPI = {
  region: (bounds: number[]) => void;
  zoom: (delta: number) => void;
  export: () => void;
};
export default function WeatherMap(p: {
  radars: string[];
  onRadarReady:(ready:boolean)=>void;
  onRadarStatus:(status:string)=>void;
  time: string;
  mode: string;
  opacity: number;
  storms: any[];
  wind: boolean;
  forecast: boolean;
  models: any[];
  onCenter: (c: number[]) => void;
  onStatus: (s: string) => void;
  playing: boolean;
  nextTimes: string[];
  onPoint: (data: any) => void;
  onThermal: (data:any)=>void;
  thermal: any;
  onLoaded: () => void;
  onLoading: () => void;
  onReady: (api: MapAPI) => void;
}) {
  const el = useRef<HTMLDivElement>(null),
    map = useRef<Map | null>(null),
    sat = useRef<any>(null),
    vectors = useRef<VectorSource | null>(null),
    selection = useRef<VectorSource | null>(null),
    probeSelection = useRef<VectorSource | null>(null),
    selectedTrack = useRef<any>(null),
    probeID = useRef(0),
    cb = useRef(p);
  cb.current = p;
  useEffect(() => {
    const coasts = new VectorLayer({
      source: new VectorSource({
        url: "/data/coastline.json",
        format: new GeoJSON(),
      }),
      style: new Style({
        stroke: new Stroke({ color: "rgba(255,255,255,.8)", width: 1 }),
      }),
    });
    vectors.current = new VectorSource();
    selection.current = new VectorSource();
    probeSelection.current = new VectorSource();
    const m = new Map({
      target: el.current!,
      layers: [
        new VectorLayer({
          source: new VectorSource({
            url: "/data/land.json",
            format: new GeoJSON(),
          }),
          style: new Style({ fill: new Fill({ color: "#172b38" }) }),
        }),
        coasts,
        new VectorLayer({ source: vectors.current }),
        new VectorLayer({ source: selection.current }),
        new VectorLayer({source:probeSelection.current,style:new Style({image:new CircleStyle({radius:7,fill:new Fill({color:"#a6ded3"}),stroke:new Stroke({color:"#fff",width:2})})})}),
      ],
      view: new View({
        center: fromLonLat([137, 22]),
        zoom: 3.8,
        minZoom: 1.5,
        maxZoom: 10,
        multiWorld: true,
      }),
      controls: controls({ zoom: false, rotate: false }),
    });
    map.current = m;
    m.on("singleclick", (e) => {
      let chosen: any;
      m.forEachFeatureAtPixel(
        e.pixel,
        (f) => {
          const info = f.get("info");
          if (info) {
            chosen = info;
            return true;
          }
          return false;
        },
        { hitTolerance: 8 },
      );
      if (!chosen) {
        if(cb.current.mode!=="ott"){probeSelection.current?.clear();return;}
        const id=++probeID.current,time=cb.current.time,[lon,lat]=toLonLat(e.coordinate),size=m.getSize()||[0,0];
        probeSelection.current?.clear();probeSelection.current?.addFeature(new Feature(new Point(e.coordinate)));
        const detail={kind:'thermal',time,lon:((lon+180)%360+360)%360-180,lat,popupPosition:{x:e.pixel[0],y:e.pixel[1],width:size[0],height:size[1]},loading:true};
        cb.current.onThermal(detail);
        cloudTemperature(time,transform(fromLonLat([detail.lon,lat]),'EPSG:3857','HIMAWARI')).then(value=>{if(id===probeID.current&&cb.current.time===time&&cb.current.mode==='ott')cb.current.onThermal({...detail,...value,loading:false})}).catch(error=>{if(id===probeID.current&&cb.current.time===time&&cb.current.mode==='ott')cb.current.onThermal({...detail,error:error.message,loading:false})});
        return;
      }
      const size = m.getSize() || [0, 0];
      const popupPosition = {
        x: e.pixel[0],
        y: e.pixel[1],
        width: size[0],
        height: size[1],
      };
      if (chosen.track) {
        selectedTrack.current = chosen;
        const track = chosen.track;
        const closest = track.points.reduce((a: any, b: any) => {
          const dist = (p: any) => {
            const coord = fromLonLat([p.lon, p.lat]);
            const world = 40075016.68557849;
            coord[0] += Math.round((e.coordinate[0] - coord[0]) / world) * world;
            const px = m.getPixelFromCoordinate(coord);
            return Math.hypot(px[0] - e.pixel[0], px[1] - e.pixel[1]);
          };
          return dist(b) < dist(a) ? b : a;
        });
        selection.current!.clear();
        const line = new Feature(
          new LineString(
            unwrapTrack(track.points).map((v: number[]) => fromLonLat(v)),
          ),
        );
        line.setStyle(
          new Style({
            stroke: new Stroke({ color: chosen.color, width: 2.5 }),
          }),
        );
        line.set("info", chosen);
        selection.current!.addFeature(line);
        for (const pt of track.points) {
          const f = new Feature(new Point(fromLonLat([pt.lon < 0 ? pt.lon + 360 : pt.lon, pt.lat])));
          const info = { ...chosen, point: pt };
          f.set("info", info);
          f.setStyle(
            new Style({
              image: new CircleStyle({
                radius: 4,
                fill: new Fill({ color: chosen.color }),
                stroke: new Stroke({ color: "#091119", width: 1 }),
              }),
            }),
          );
          selection.current!.addFeature(f);
        }
        cb.current.onPoint({ ...chosen, point: chosen.point || closest, popupPosition });
      } else {
        selection.current!.clear();
        selectedTrack.current = null;
        cb.current.onPoint({ ...chosen, popupPosition });
      }
    });
    m.on("pointermove", (e) => {
      m.getTargetElement().style.cursor = m.hasFeatureAtPixel(e.pixel, {
        hitTolerance: 6,
      })
        ? "pointer"
        : "";
    });
    m.on("moveend", () =>
      cb.current.onCenter(toLonLat(m.getView().getCenter()!)),
    );
    cb.current.onReady({
      region: (b) =>
        m
          .getView()
          .fit(transformExtent(b, "EPSG:4326", "EPSG:3857"), {
            padding: [80, 80, 80, 80],
            duration: 650,
          }),
      zoom: (d) =>
        m
          .getView()
          .animate({ zoom: (m.getView().getZoom() || 4) + d, duration: 250 }),
      export: () => {
        const oldSize = m.getSize()!,
          v = m.getView(),
          oldRes = v.getResolution()!;
        m.once("rendercomplete", async () => {
          try {
            const c = document.createElement("canvas");
            c.width = 3840;
            c.height = 2160;
            const ctx = c.getContext("2d")!;
            m.getViewport()
              .querySelectorAll<HTMLCanvasElement>(".ol-layer canvas")
              .forEach((ca) => {
                if (!ca.width) return;
                ctx.globalAlpha = Number(
                  (ca.parentNode as HTMLElement).style.opacity || 1,
                );
                const mt = ca.style.transform.match(/^matrix\(([^)]*)\)$/);
                if (mt)
                  ctx.setTransform(
                    ...(mt[1].split(",").map(Number) as [
                      number,
                      number,
                      number,
                      number,
                      number,
                      number,
                    ]),
                  );
                else ctx.setTransform(1, 0, 0, 1, 0, 0);
                ctx.drawImage(ca, 0, 0);
              });
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.globalAlpha = 1;
            ctx.fillStyle = "#07121ee8";
            ctx.fillRect(0, 2070, 3840, 90);
            const logo = new Image();
            logo.src = "/images/typhoon-observatory-logo.png";
            await logo.decode();
            const logoBackground = ctx.createLinearGradient(38, 2074, 298, 2154);
            logoBackground.addColorStop(0, "#f4fbff");
            logoBackground.addColorStop(1, "#d9edf5");
            ctx.fillStyle = logoBackground;
            ctx.beginPath();
            ctx.roundRect(30, 2074, 276, 80, 9);
            ctx.fill();
            ctx.strokeStyle = "#b6e3e4";
            ctx.lineWidth = 1;
            ctx.stroke();
            ctx.drawImage(logo, 48, 2074, 240, 80);
            ctx.fillStyle = "white";
            ctx.font = "28px sans-serif";
            ctx.fillText(
              `CYCLONE ATLAS · HIMAWARI · ${cb.current.time} · ${cb.current.mode.toUpperCase()} · JMA / NICT`,
              325,
              2126,
            );
            const a = document.createElement("a");
            a.download = "cyclone-atlas.png";
            a.href = c.toDataURL("image/png");
            a.click();
          } catch {
            cb.current.onStatus("匯出失敗，請等圖磚載入後重試");
          } finally {
            m.setSize(oldSize);
            v.setResolution(oldRes);
          }
        });
        m.setSize([3840, 2160]);
        v.setResolution((oldRes * oldSize[0]) / 3840);
        m.renderSync();
      },
    });
    return () => {
      m.setTarget(undefined);
      map.current = null;
    };
  }, []);
  useRadar(map,p);
  useEffect(() => {
    if (!map.current || !p.time) return;
    const m = map.current;
    let active = true,
      failed = 0;
    const source = imagery(p.time, p.mode, p.playing),
      old = sat.current;
    cb.current.onLoading();
    cb.current.onStatus(
      p.playing ? "準備動畫影格…" : "漸進載入：先概覽，再補細節…",
    );
    const layer = new TileLayer({ source, opacity: 0.001, preload: 0 });
    sat.current = layer;
    m.getLayers().insertAt(1, layer);
    let preview: TileLayer<XYZ> | null = null;
    if (!old && !p.playing) {
      preview = new TileLayer({
        source: imagery(p.time, p.mode, false, true),
        opacity: p.opacity,
      });
      m.getLayers().insertAt(1, preview);
    }
    const errorKey = source.on("tileloaderror", () => {
      failed++;
      if (active) cb.current.onStatus("部分圖磚缺漏，請更換時間或重試");
    });
    const done = m.once("rendercomplete", () => {
      if (!active) return;
      if (old && cb.current.playing) {
        const start = performance.now(),
          fade = () => {
            if (!active) return;
            const f = Math.min(1, (performance.now() - start) / 160);
            layer.setOpacity(cb.current.opacity * f);
            if (f < 1) requestAnimationFrame(fade);
            else m.removeLayer(old);
          };
        requestAnimationFrame(fade);
      } else {
        layer.setOpacity(cb.current.opacity);
        if (old) m.removeLayer(old);
      }
      if (preview) m.removeLayer(preview);
      cb.current.onStatus(failed ? "影格有缺圖；未補造影像" : "影像已載入");
      cb.current.onLoaded();
    });
    m.render();
    return () => {
      active = false;
      unByKey(done);
      unByKey(errorKey);
      if (old) m.removeLayer(old);
      if (preview) m.removeLayer(preview);
    };
  }, [p.time, p.mode, p.playing]);
  useEffect(() => {
    if (!map.current || !p.playing) return;
    const m = map.current,
      extent = m.getView().calculateExtent(m.getSize()),
      projection = m.getView().getProjection(),
      resolution = m.getView().getResolution()!;
    let cancelled = false;
    let keys: any[] = [];
    for (const t of p.nextTimes.slice(0, 3)) {
      const src = imagery(t, p.mode, true),
        grid = src.getTileGridForProjection(projection),
        z = grid.getZForResolution(resolution),
        range = grid.getTileRangeForExtentAndZ(extent, z);
      let count = 0;
      for (let x = range.minX; x <= range.maxX; x++)
        for (let y = range.minY; y <= range.maxY; y++) {
          if (count++ > 80) break;
          const tile = src.getTile(z, x, y, 1, projection);
          if (tile.getState() === 0) tile.load();
        }
    }
    return () => {
      cancelled = true;
      keys.forEach(unByKey);
    };
  }, [p.nextTimes.join(","), p.mode, p.playing]);
  useEffect(() => sat.current?.setOpacity(p.opacity), [p.opacity]);
  useEffect(()=>{if(!p.thermal)probeSelection.current?.clear()},[p.thermal]);
  useEffect(() => {
    const s = vectors.current;
    if (!s) return;
    s.clear();
    const add = (
      g: any,
      color: string,
      width = 1,
      fill?: string,
      dash?: number[],
    ) => {
      const f = new Feature(g);
      f.setStyle(
        new Style({
          stroke: new Stroke({ color, width, lineDash: dash }),
          fill: fill ? new Fill({ color: fill }) : undefined,
        }),
      );
      s.addFeature(f);
      return f;
    };
    const point = (a: number[]) => fromLonLat([a[1], a[0]]);
    for (const storm of p.storms) {
      const data = storm.data || [],
        title = data[0],
        analysis = data.find((d: any) => d.advancedHours === 0);
      if (!analysis?.center) continue;
      const marker = new Feature(new Point(point(analysis.center)));
      marker.setStyle(
        new Style({
          image: new CircleStyle({
            radius: 6,
            fill: new Fill({ color: "#fff" }),
            stroke: new Stroke({ color: "#ff8159", width: 3 }),
          }),
          text: new Text({
            text: title?.name?.en || storm.id,
            offsetY: -21,
            font: "600 13px sans-serif",
            fill: new Fill({ color: "#fff" }),
            stroke: new Stroke({ color: "#091322", width: 4 }),
          }),
        }),
      );
      marker.set("info", {
        kind: "jma",
        name: title?.name?.en,
        point: analysis,
        spec: storm.specifications?.find(
          (v: any) => v.validtime?.UTC === analysis.validtime?.UTC,
        ),
        issue: title?.issue?.UTC,
      });
      s.addFeature(marker);
      if (p.wind) {
        const gale = analysis.galeWarningArea;
        if (gale)
          add(
            circular(
              [gale.center[1], gale.center[0]],
              gale.radius,
              120,
            ).transform("EPSG:4326", "EPSG:3857"),
            "#f9c962",
            1.4,
            "#f9c96213",
          );
        for (const a of analysis.stormWarningArea?.arc || [])
          add(
            circular([a[0][1], a[0][0]], a[1], 100).transform(
              "EPSG:4326",
              "EPSG:3857",
            ),
            "#ff795f",
            1.6,
            "#ff795f1c",
          );
      }
      if (p.forecast) {
        const forecasts = data.filter(
          (d: any) => d.center && d.advancedHours >= 0,
        );
        add(
          new LineString(forecasts.map((d: any) => point(d.center))),
          "#fff",
          1.8,
          undefined,
          [6, 5],
        );
        for (const f of forecasts) {
          const dot = new Feature(new Point(point(f.center)));
          dot.set("info", {
            kind: "jma",
            name: title?.name?.en,
            point: f,
            spec: storm.specifications?.find(
              (v: any) => v.validtime?.UTC === f.validtime?.UTC,
            ),
            issue: title?.issue?.UTC,
          });
          dot.setStyle(
            new Style({
              image: new CircleStyle({
                radius: 4,
                fill: new Fill({ color: "#fff" }),
                stroke: new Stroke({ color: "#192633", width: 1.5 }),
              }),
            }),
          );
          s.addFeature(dot);
          if (f.probabilityCircle)
            add(
              circular(
                [f.center[1], f.center[0]],
                f.probabilityCircle.radius,
                80,
              ).transform("EPSG:4326", "EPSG:3857"),
              "#ffffffa0",
              1,
              undefined,
              [4, 5],
            );
        }
        const last = forecasts.at(-1);
        for (const line of last?.stormWarningArea?.line || [])
          add(new LineString(line.map(point)), "#ff795f", 1.5);
        for (const arc of last?.stormWarningArea?.arc || []) {
          const coords = [];
          for (let angle = arc[2][0]; angle <= arc[2][1]; angle += 2) {
            const rad = (angle * Math.PI) / 180,
              lat = (arc[0][0] * Math.PI) / 180,
              lon = (arc[0][1] * Math.PI) / 180,
              d = arc[1] / 6371008.8;
            const la = Math.asin(
              Math.sin(lat) * Math.cos(d) +
                Math.cos(lat) * Math.sin(d) * Math.cos(rad),
            );
            const lo =
              lon +
              Math.atan2(
                Math.sin(rad) * Math.sin(d) * Math.cos(lat),
                Math.cos(d) - Math.sin(lat) * Math.sin(la),
              );
            coords.push(
              fromLonLat([(lo * 180) / Math.PI, (la * 180) / Math.PI]),
            );
          }
          if (coords.length > 1) add(new LineString(coords), "#ff795f", 1.5);
        }
      }
    }
    for (const model of p.models)
      for (const track of model.tracks || []) {
        if (track.points?.length > 1) {
          const line = add(
            new LineString(
              unwrapTrack(track.points).map((v: number[]) => fromLonLat(v)),
            ),
            (model.color || "#65dce8") + "88",
            1.2,
          );
          line.set("info", {
            kind: "model",
            model: model.label,
            name: track.name,
            run: model.run,
            source: model.source,
            color: model.color,
            modelId: model.id,
            track,
          });
        }
      }
  }, [p.storms, p.wind, p.forecast, p.models]);
  useEffect(() => {
    const selected = selectedTrack.current;
    if (selected?.modelId && !p.models.some((model) => model.id === selected.modelId)) {
      selection.current?.clear();
      selectedTrack.current = null;
      cb.current.onPoint(null);
    }
  }, [p.models]);
  return (
    <div
      ref={el}
      className="weather-map"
      aria-label="可拖曳縮放的衛星觀測地圖"
    />
  );
}
