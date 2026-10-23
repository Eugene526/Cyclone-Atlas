"use client";
import { useEffect, useRef } from "react";
import {useCwaTracks} from "./useCwaTracks";
import {useTyphoonWarningLayer} from "./TyphoonWarningLayer";
import Map from "ol/Map";
import {useRadar} from "./useRadar";
import {incomingLayerReady} from "@/lib/radar-loading.mjs";
import View from "ol/View";
import TileLayer from "ol/layer/Tile";
import VectorLayer from "ol/layer/Vector";
import XYZ from "ol/source/XYZ";
import VectorSource from "ol/source/Vector";
import TileGrid from "ol/tilegrid/TileGrid";
import GeoJSON from "ol/format/GeoJSON";
import {
  fromLonLat,
  toLonLat,
  transformExtent,
  get as getProjection,
} from "ol/proj";
import { register } from "ol/proj/proj4";
import proj4 from "proj4";
import { Style, Stroke, Fill, Circle as CircleStyle, Text } from "ol/style";
import Feature from "ol/Feature";
import { Point, LineString } from "ol/geom";
import { circular } from "ol/geom/Polygon";
import { defaults as controls } from "ol/control";
import { stamp, lut } from "@/lib/satellite";
import { imagery } from "@/lib/imagery";
import { unwrapTrack } from "@/lib/track-geometry.mjs";
import { intensityColor } from "@/lib/track-intensity";
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
  preload: (times: string[], modeForTime: (time: string) => string, progress: (done: number, total: number) => void) => Promise<{ cancelled: boolean; failed: number; total: number }>;
  cancelPreload: () => void;
};
function exportStormLabel(p:any){const c=p.cwa?.storms?.[0];if(p.agency==="cwa"&&c)return `${c.number||c.id} · ${c.name}`;const j=p.storms?.[0],t=j?.data?.[0];return `${t?.typhoonNumber||j?.id||"颱風"} · ${t?.name?.en||""}`;}
export default function WeatherMap(p: {
  cwa:any; agency:string; warningLayers:any; cwaError:boolean; cwaHistory:boolean;
  showCurrent?:boolean; pathPrediction?:boolean; showCoastline?:boolean;
  showForecastTimestamps?:boolean;
  advisoryItems?: any[];
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
    preloadToken = useRef(0),
    sat = useRef<any>(null),
    landLayer = useRef<any>(null), coastLayer = useRef<any>(null),
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
    coastLayer.current=coasts;
    const land=new VectorLayer({source:new VectorSource({url:"/data/land.json",format:new GeoJSON()}),style:new Style({fill:new Fill({color:"#263e49"}),stroke:new Stroke({color:"rgba(181,208,216,.58)",width:.8})})});
    landLayer.current=land;
    vectors.current = new VectorSource();
    selection.current = new VectorSource();
    probeSelection.current = new VectorSource();
    const m = new Map({
      target: el.current!,
      layers: [
        land,
        coasts,
        new VectorLayer({ source: vectors.current, zIndex:20 }),
        new VectorLayer({ source: selection.current, zIndex:21 }),
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
      if (!chosen) { probeSelection.current?.clear(); return; }
      const size = m.getSize() || [0, 0];
      const popupPosition = {
        x: e.pixel[0],
        y: e.pixel[1],
        width: size[0],
        height: size[1],
      };
      if (chosen.historyTrack) {
        selection.current!.clear();
        selectedTrack.current = null;
        for (const pt of chosen.historyPoints || []) {
          const longitude = pt.lon ?? pt.center?.[1];
          const latitude = pt.lat ?? pt.center?.[0];
          if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) continue;
          const dot = new Feature(new Point(fromLonLat([longitude, latitude])));
          const spec = chosen.specifications?.find((item: any) => item.validtime?.UTC === pt.validtime?.UTC);
          const info = { kind: chosen.kind, name: chosen.name, point: chosen.kind === "cwa" ? { ...pt, history: true } : pt, spec, issue: chosen.issue };
          dot.set("info", info);
          dot.setStyle(new Style({ image: new CircleStyle({ radius: 5, fill: new Fill({ color: intensityColor(pt.windMs ?? Number(spec?.maximumWind?.sustained?.["m/s"])) }), stroke: new Stroke({ color: "#10212e", width: 1.5 }) }) }));
          selection.current!.addFeature(dot);
        }
        cb.current.onPoint(null);
        return;
      }
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
      cancelPreload: () => { preloadToken.current++; },
      preload: async (times, modeForTime, progress) => {
        const token = ++preloadToken.current;
        const extent = m.getView().calculateExtent(m.getSize());
        const projection = m.getView().getProjection();
        const resolution = m.getView().getResolution()!;
        const tiles: any[] = [];
        for (const time of times) {
          const src = imagery(time, modeForTime(time), true);
          const grid = src.getTileGridForProjection(projection);
          const z = grid.getZForResolution(resolution);
          const range = grid.getTileRangeForExtentAndZ(extent, z);
          for (let x = range.minX; x <= range.maxX; x++) {
            for (let y = range.minY; y <= range.maxY; y++) {
              const tile = src.getTile(z, x, y, 1, projection);
              if (tile.getState() !== 2 && tile.getState() !== 4) tiles.push(tile);
            }
          }
        }
        let done = 0, failed = tiles.filter((tile) => tile.getState() === 3).length, cursor = 0;
        progress(0, tiles.length);
        const waitForTile = (tile: any) => new Promise<boolean>((resolve) => {
          let key: any, settled = false;
          const finish = (ok: boolean) => {
            if (settled) return;
            settled = true;
            clearTimeout(timeout);
            if (key) unByKey(key);
            resolve(ok);
          };
          const check = () => {
            const state = tile.getState();
            if (state >= 2) finish(state === 2 || state === 4);
          };
          const timeout = setTimeout(() => finish(false), 30_000);
          key = tile.on("change", check);
          try {
            if (tile.getState() === 0) tile.load();
            check();
          } catch { finish(false); }
        });
        const worker = async () => {
          while (cursor < tiles.length && token === preloadToken.current) {
            const tile = tiles[cursor++];
            if (tile.getState() !== 3 && tile.getState() !== 4 && !(await waitForTile(tile))) failed++;
            done++;
            try { progress(done, tiles.length); } catch { /* progress UI must not interrupt tile loading */ }
          }
        };
        await Promise.all(Array.from({ length: Math.min(8, tiles.length) }, worker));
        return { cancelled: token !== preloadToken.current, failed, total: tiles.length };
      },
      export: () => {
        const oldSize = m.getSize()!,
          v = m.getView(),
          oldRes = v.getResolution()!;
        const labelStyles:any[]=[];
        for(const layer of m.getLayers().getArray() as any[]){
          const source=layer.getSource?.();
          for(const feature of source?.getFeatures?.()||[]){
            const exportStyle=feature.get("exportStyle");
            if(exportStyle){labelStyles.push([feature,feature.getStyle()]);feature.setStyle(exportStyle)}
          }
        }
        m.once("rendercomplete", async () => {
          try {
            const c = document.createElement("canvas");
            c.width = 3840;
            c.height = 2160;
            const ctx = c.getContext("2d")!;
            // Layer canvases are transparent; match the live sea/base color in exports.
            ctx.fillStyle = "#17313f";
            ctx.fillRect(0, 0, c.width, c.height);
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
            const logoX = c.width - 306;
            const logoY = 30;
            const logoBackground = ctx.createLinearGradient(logoX + 8, logoY, logoX + 268, logoY + 80);
            logoBackground.addColorStop(0, "#f4fbff");
            logoBackground.addColorStop(1, "#d9edf5");
            ctx.fillStyle = logoBackground;
            ctx.beginPath();
            ctx.roundRect(logoX, logoY, 276, 80, 9);
            ctx.fill();
            ctx.strokeStyle = "#b6e3e4";
            ctx.lineWidth = 1;
            ctx.stroke();
            ctx.drawImage(logo, logoX + 18, logoY, 240, 80);
            ctx.fillStyle = "white";
            ctx.font = "28px sans-serif";
            ctx.fillText(
              cb.current.pathPrediction ? `颱風預報 · ${exportStormLabel(cb.current)} · 預報圖日期 ${new Date(cb.current.time).toLocaleString("zh-TW",{timeZone:"Asia/Taipei"})} UTC+8` : `CYCLONE ATLAS · HIMAWARI · ${cb.current.time} · ${cb.current.mode.toUpperCase()} · JMA / NICT`,
              40,
              2126,
              c.width - 80,
            );
            const a = document.createElement("a");
            a.download = cb.current.pathPrediction ? "cyclone-atlas-forecast.png" : "cyclone-atlas.png";
            a.href = c.toDataURL("image/png");
            a.click();
          } catch {
            cb.current.onStatus("匯出失敗，請等圖磚載入後重試");
          } finally {
            for(const [feature,style] of labelStyles)feature.setStyle(style);
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
  useEffect(()=>{
    if(!map.current||!p.advisoryItems?.length)return;
    const byCounty=new globalThis.Map<string,any[]>();
    for(const item of p.advisoryItems){const name=String(item.area||'').replaceAll('台','臺');byCounty.set(name,[...(byCounty.get(name)||[]),item])}
    let active=true;const source=new VectorSource();const layer=new VectorLayer({source,zIndex:19});map.current.addLayer(layer);
    fetch('/data/taiwan-counties.json').then(r=>r.json()).then(data=>{
      if(!active)return;
      for(const feature of new GeoJSON().readFeatures(data,{featureProjection:'EPSG:3857'})){
        const name=String(feature.get('name')||'').replaceAll('台','臺'),alerts=byCounty.get(name);if(!alerts)continue;
        const rank=(a:any)=>a.level==='red'?4:a.level==='orange'?3:a.level==='yellow'?2:/颱風|豪雨/.test(a.title)?3:1;
        const level=[...alerts].sort((a,b)=>rank(b)-rank(a))[0]?.level;
        const color=level==='red'?'rgba(239,69,77,.58)':level==='orange'?'rgba(255,136,46,.55)':level==='yellow'?'rgba(250,219,70,.52)':'rgba(106,180,230,.44)';
        const stroke=level==='red'?'#ff8589':level==='orange'?'#ffb66c':level==='yellow'?'#fff49b':'#9ad0ed';
        feature.setStyle(new Style({fill:new Fill({color}),stroke:new Stroke({color:stroke,width:2})}));
        source.addFeature(feature);
      }
    }).catch(()=>{});
    return()=>{active=false;map.current?.removeLayer(layer)};
  },[p.advisoryItems]);
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
    // True-color may have unavailable tiles. Render all available tiles now;
    // only the IR modes wait for a complete incoming frame.
    const layer = new TileLayer({ source, opacity: p.mode === "rgb" ? p.opacity : 0.001, preload: 0, visible: !cb.current.pathPrediction });
    sat.current = layer;
    m.getLayers().insertAt(1, layer);
    let preview: TileLayer<XYZ> | null = null;
    if (!old && !p.playing) {
      preview = new TileLayer({
        source: imagery(p.time, p.mode, false, true),
        opacity: p.opacity,
        visible: !cb.current.pathPrediction,
      });
      m.getLayers().insertAt(1, preview);
    }
    const errorKey = source.on("tileloaderror", () => {
      failed++;
      if (active) cb.current.onStatus("少數圖磚仍無資料，請稍後重試");
    });
    const done = m.on("postrender", () => {
      if (!active || (p.mode !== "rgb" && !incomingLayerReady(layer.getRenderer()))) return;
      unByKey(done);
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
      cb.current.onStatus(failed ? (p.mode === "rgb" ? "已顯示可用的真實色圖磚；部分區域缺圖" : "少數圖磚仍無資料") : "影像已載入");
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
  useEffect(() => sat.current?.setOpacity(p.opacity), [p.opacity]);
  useEffect(()=>{sat.current?.setVisible(!p.pathPrediction);coastLayer.current?.setVisible(p.showCoastline!==false);landLayer.current?.setVisible(true);el.current?.classList.toggle("path-prediction-map",!!p.pathPrediction)},[p.pathPrediction,p.showCoastline]);
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
    const callout = (coordinate:number[], text:string, index:number) => {
      const currentMap=map.current;if(!currentMap)return;
      const origin=point(coordinate),pixel=currentMap.getPixelFromCoordinate(origin);
      if(!pixel)return;
      const side=index%2===0?1:-1, anchor=currentMap.getCoordinateFromPixel([pixel[0]+side*112,pixel[1]+(index%3===0?-34:34)]);
      if(!anchor)return;
      add(new LineString([origin,anchor]),"rgba(235,246,250,.9)",1);
      const label=new Feature(new Point(anchor));
      const makeLabelStyle=(fontSize:number)=>new Style({text:new Text({text,font:`700 ${fontSize}px sans-serif`,textAlign:side>0?"left":"right",offsetX:side*5,fill:new Fill({color:"#f4fbff"}),stroke:new Stroke({color:"#10202a",width:fontSize>12?5:3}),backgroundFill:new Fill({color:"rgba(9,25,36,.94)"}),backgroundStroke:new Stroke({color:"rgba(210,233,240,.86)",width:fontSize>12?2:1}),padding:fontSize>12?[8,11,8,11]:[4,6,4,6]})});
      label.set("exportStyle",makeLabelStyle(25));
      label.setStyle(makeLabelStyle(11));
      s.addFeature(label);
    };
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
      const history=data.filter((d:any)=>d.center&&d.advancedHours<0);
      if(p.cwaHistory&&(p.agency==="jma"||p.cwaError)&&history.length>0){
        const entries=[...history,analysis];
        const coordinates=unwrapTrack(entries.map((d:any)=>({lon:d.center[1],lat:d.center[0]}))).map((v:number[])=>fromLonLat(v));
        const speed=(entry:any)=>Number(storm.specifications?.find((spec:any)=>spec.validtime?.UTC===entry.validtime?.UTC)?.maximumWind?.sustained?.["m/s"]);
        for(let i=1;i<coordinates.length;i++){
          const start=coordinates[i-1],end=coordinates[i],a=speed(entries[i-1]),b=speed(entries[i]);
          for(let j=0;j<8;j++){
            const lerp=(t:number)=>start.map((v:number,k:number)=>v+(end[k]-v)*t);
            const value=Number.isFinite(a)&&Number.isFinite(b)?a+(b-a)*(j+.5)/8:Number.isFinite(b)?b:a;
            const line=add(new LineString([lerp(j/8),lerp((j+1)/8)]),intensityColor(value),2.8);
            line.set("info",{kind:"jma",name:title?.name?.en,historyTrack:true,historyPoints:entries,specifications:storm.specifications,issue:title?.issue?.UTC});
          }
        }
      }
      if(p.showCurrent===false){s.removeFeature(marker)}
      if (p.wind) {
        const gale = analysis.galeWarningArea;
        if (p.agency === "jma" && gale?.center && gale.radius > 0)
          add(
            circular(
              [gale.center[1], gale.center[0]],
              gale.radius,
              120,
            ).transform("EPSG:4326", "EPSG:3857"),
            "#ffd34d",
            2.5,
          );
        if (p.agency === "jma") {
          // Render JMA's official storm-warning boundary from its published arc and line segments.
          // Do not substitute uncertainty circles for wind radii or fill the warning region.
          const warning = p.forecast
            ? [...data].reverse().find((d: any) => d.advancedHours >= 0 &&
                (d.stormWarningArea?.arc?.length || d.stormWarningArea?.line?.length))?.stormWarningArea
            : analysis.stormWarningArea;
          for (const arc of warning?.arc || []) {
            const [[lat, lon], radius, [start, end]] = arc;
            if (![lat, lon, radius, start, end].every(Number.isFinite) || radius <= 0) continue;
            const steps = Math.max(1, Math.ceil(Math.abs(end - start) / 2));
            const coordinates = Array.from({ length: steps + 1 }, (_, i) => {
              const bearing = start + (end - start) * i / steps;
              const angle = bearing * Math.PI / 180;
              const angular = radius / 6371008.8;
              const phi1 = lat * Math.PI / 180, lambda1 = lon * Math.PI / 180;
              const phi2 = Math.asin(Math.sin(phi1) * Math.cos(angular) + Math.cos(phi1) * Math.sin(angular) * Math.cos(angle));
              const lambda2 = lambda1 + Math.atan2(Math.sin(angle) * Math.sin(angular) * Math.cos(phi1), Math.cos(angular) - Math.sin(phi1) * Math.sin(phi2));
              return fromLonLat([lambda2 * 180 / Math.PI, phi2 * 180 / Math.PI]);
            });
            add(new LineString(coordinates), "#ff4658", 2.5);
          }
          for (const segment of warning?.line || []) {
            if (Array.isArray(segment) && segment.length >= 2)
              add(new LineString(segment.map((v: number[]) => fromLonLat([v[1], v[0]]))), "#ff4658", 2.5);
          }
        }
        if (p.agency === "cwa") {
          if (gale?.center && gale.radius > 0)
            add(
              circular([gale.center[1], gale.center[0]], gale.radius, 120).transform("EPSG:4326", "EPSG:3857"),
              "#2c8bd8",
              1.4,
            );
          for (const a of analysis.stormWarningArea?.arc || [])
            add(
              circular([a[0][1], a[0][0]], a[1], 100).transform(
                "EPSG:4326",
                "EPSG:3857",
              ),
              "#ff626f",
              1.6,
              "rgba(255,67,83,.24)",
            );
        }
      }
      if (p.forecast) {
        const forecasts = data.filter(
          (d: any) => d.center && d.advancedHours >= 0,
        );
        add(
          new LineString(unwrapTrack(forecasts.map((d:any)=>({lon:d.center[1],lat:d.center[0]}))).map((v:number[])=>fromLonLat(v))),
          p.agency === "jma" ? "#ffffff" : "#ff8c78",
          1.8,
          undefined,
        );
        if (p.agency === "jma") for (const f of forecasts) {
          // These are JMA's native tangents connecting the probability-circle boundaries.
          for (const tangent of f.centerUncertainty?.tangent || []) {
            if (Array.isArray(tangent) && tangent.length >= 2)
              add(new LineString(tangent.map((v: number[]) => fromLonLat([v[1], v[0]]))), "rgba(255,255,255,.9)", 1.8);
          }
        }
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
                fill: new Fill({ color: "#b6eee1" }),
                stroke: new Stroke({ color: "#192633", width: 1.5 }),
              }),
            }),
          );
          s.addFeature(dot);
          const spec=storm.specifications?.find((v:any)=>v.advancedHours===f.advancedHours)||{};
          if(p.pathPrediction&&p.showForecastTimestamps){const timeText=new Intl.DateTimeFormat("zh-TW",{timeZone:"Asia/Taipei",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).format(new Date(f.validtime?.UTC||f.validtime?.JST));callout(f.center,timeText,f.advancedHours||0);}
          // JMA future circles are position-uncertainty circles, not wind circles.
          if (f.centerUncertainty?.radiusMeters > 0) add(circular([f.center[1],f.center[0]],f.centerUncertainty.radiusMeters,100).transform("EPSG:4326","EPSG:3857"),"#fff",2,undefined,[6,5]);
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
  }, [p.storms, p.wind, p.forecast, p.models,p.cwaHistory,p.showCurrent,p.pathPrediction,p.showForecastTimestamps]);
  useEffect(() => {
    const selected = selectedTrack.current;
    if (selected?.modelId && !p.models.some((model) => model.id === selected.modelId)) {
      selection.current?.clear();
      selectedTrack.current = null;
      cb.current.onPoint(null);
    }
  }, [p.models]);
  useCwaTracks(map,p.cwa,p.agency==="cwa"&&!p.cwaError,p.wind,p.forecast,p.cwaHistory,p.showCurrent!==false,p.pathPrediction===true&&p.showForecastTimestamps===true);
  useTyphoonWarningLayer(map,p.cwa,p.warningLayers,p.cwaError,p.wind);
  return (
    <div
      ref={el}
      className="weather-map"
      aria-label={p.pathPrediction?"可拖曳縮放的颱風路徑預測圖":"可拖曳縮放的衛星觀測地圖"}
    />
  );
}
