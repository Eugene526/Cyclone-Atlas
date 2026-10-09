"use client";
import { useEffect, useRef } from "react";
import Map from "ol/Map";
import View from "ol/View";
import VectorLayer from "ol/layer/Vector";
import ImageLayer from "ol/layer/Image";
import VectorSource from "ol/source/Vector";
import ImageStatic from "ol/source/ImageStatic";
import GeoJSON from "ol/format/GeoJSON";
import Feature from "ol/Feature";
import LineString from "ol/geom/LineString";
import Point from "ol/geom/Point";
import Polygon from "ol/geom/Polygon";
import { fromLonLat, toLonLat, transformExtent } from "ol/proj";
import { Style, Fill, Stroke, Text, Circle as CircleStyle } from "ol/style";
import Draw from "ol/interaction/Draw";
import Modify from "ol/interaction/Modify";
import { defaults as interactions } from "ol/interaction/defaults";
import { defaults as controls } from "ol/control/defaults";
import { dbzColor } from "@/lib/radar.mjs";
import { linePosition, GUAM_BOUNDS } from "@/lib/radar-volume.mjs";
import { useRadar } from "./useRadar";
import "ol/ol.css";
type Props = {
  source: string;
  time: string;
  data: any;
  line: number[][] | null;
  side: string;
  drawing: boolean;
  onLine: (v: number[][]) => void;
  onDrawEnd: () => void;
  onReady: (v: any) => void;
  onRadarReady: (v: boolean) => void;
  onRadarStatus: (v: string) => void;
  playing: boolean;
  nextTimes: string[];
  cursor: number | null;
};
export default function RadarVolumeMap(p: Props) {
  const host = useRef<HTMLDivElement>(null),
    map = useRef<Map | null>(null),
    current = useRef(p);
  current.current = p;
  const slice = useRef(new ImageLayer()),
    lineSource = useRef(new VectorSource()),
    draft = useRef(new VectorSource()),
    marker = useRef(new VectorSource());
  useEffect(() => {
    const boundary = new Feature(
      new Polygon([
        [
          [GUAM_BOUNDS[0], GUAM_BOUNDS[1]],
          [GUAM_BOUNDS[2], GUAM_BOUNDS[1]],
          [GUAM_BOUNDS[2], GUAM_BOUNDS[3]],
          [GUAM_BOUNDS[0], GUAM_BOUNDS[3]],
          [GUAM_BOUNDS[0], GUAM_BOUNDS[1]],
        ].map((c) => fromLonLat(c)),
      ]),
    );
    const boundsLayer = new VectorLayer({
      source: new VectorSource({ features: [boundary] }),
      style: new Style({
        stroke: new Stroke({ color: "#8abbb670", width: 1, lineDash: [6, 6] }),
      }),
    });
    const m = new Map({
      target: host.current!,
      layers: [
        new VectorLayer({
          source: new VectorSource({
            url: "/data/land.json",
            format: new GeoJSON(),
          }),
          style: new Style({ fill: new Fill({ color: "#213442" }) }),
        }),
        slice.current,
        boundsLayer,
        new VectorLayer({
          source: new VectorSource({
            url: "/data/coastline.json",
            format: new GeoJSON(),
          }),
          style: new Style({
            stroke: new Stroke({ color: "#f7fcffb0", width: 1 }),
          }),
        }),
        new VectorLayer({
          source: lineSource.current,
          style: (f) => {
            const coords = (f.getGeometry() as LineString).getCoordinates(),
              curve =
                coords.length === 2
                  ? new LineString(
                      Array.from({ length: 65 }, (_, i) =>
                        fromLonLat(
                          linePosition(
                            toLonLat(coords[0]),
                            toLonLat(coords[1]),
                            i / 64,
                          ),
                        ),
                      ),
                    )
                  : (f.getGeometry() as LineString),
              out = [
                new Style({
                  geometry: curve,
                  stroke: new Stroke({ color: "#f8fafb", width: 3 }),
                }),
                new Style({
                  geometry: curve,
                  stroke: new Stroke({
                    color: "#69d9c7",
                    width: 1.5,
                    lineDash: [6, 4],
                  }),
                }),
              ];
            coords.forEach((c, i) =>
              out.push(
                new Style({
                  geometry: new Point(c),
                  image: new CircleStyle({
                    radius: 6,
                    fill: new Fill({ color: "#0d1e2b" }),
                    stroke: new Stroke({ color: "#c0f8e6", width: 2 }),
                  }),
                  text: new Text({
                    text: i ? "B" : "A",
                    offsetY: -17,
                    font: "bold 13px sans-serif",
                    fill: new Fill({ color: "#fff" }),
                    stroke: new Stroke({ color: "#0b1827", width: 4 }),
                  }),
                }),
              ),
            );
            if (coords.length === 2) {
              const a = coords[0],
                b = coords[1],
                len = Math.hypot(b[0] - a[0], b[1] - a[1]),
                sign = current.current.side === "left" ? 1 : -1;
              const c = [
                (a[0] + b[0]) / 2 + ((sign * (a[1] - b[1])) / len) * 40000,
                (a[1] + b[1]) / 2 + ((sign * (b[0] - a[0])) / len) * 40000,
              ];
              out.push(
                new Style({
                  geometry: new Point(c),
                  text: new Text({
                    text: sign === 1 ? "左側觀看" : "右側觀看",
                    font: "12px sans-serif",
                    fill: new Fill({ color: "#bdf4e0" }),
                    stroke: new Stroke({ color: "#0b1827", width: 4 }),
                  }),
                }),
              );
            }
            return out;
          },
        }),
        new VectorLayer({ source: draft.current }),
        new VectorLayer({
          source: marker.current,
          style: new Style({
            image: new CircleStyle({
              radius: 5,
              fill: new Fill({ color: "#fff" }),
              stroke: new Stroke({ color: "#56c8b8", width: 2 }),
            }),
          }),
        }),
      ],
      view: new View({
        center: fromLonLat([144.8, 13.6]),
        zoom: 6.2,
        minZoom: 2,
        maxZoom: 12,
        enableRotation: false,
      }),
      interactions: interactions({
        pinchRotate: false,
        altShiftDragRotate: false,
      }),
      controls: controls({ zoom: false, attribution: false, rotate: false }),
    });
    map.current = m;
    const modify = new Modify({ source: lineSource.current });
    m.addInteraction(modify);
    modify.on("modifyend", () => {
      const f = lineSource.current.getFeatures()[0];
      if (f)
        current.current.onLine(
          (f.getGeometry() as LineString)
            .getCoordinates()
            .map((c) => toLonLat(c)),
        );
    });
    current.current.onReady({
      zoom: (d: number) =>
        m
          .getView()
          .animate({ zoom: (m.getView().getZoom() || 6) + d, duration: 180 }),
      focus: (lon: number, lat: number) =>
        m.getView().animate({
          center: fromLonLat([lon, lat]),
          zoom: 7.5,
          duration: 250,
        }),
      cancel: () => draft.current.clear(),
    });
    const observer = new ResizeObserver(() => m.updateSize());
    observer.observe(host.current!);
    return () => {
      observer.disconnect();
      m.setTarget(undefined);
      map.current = null;
    };
  }, []);
  useRadar(map, {
    time: p.time,
    playing: p.playing,
    nextTimes: p.nextTimes,
    radars:
      p.source === "japan" ? ["jma"] : p.source === "taiwan" ? ["cwa"] : [],
    onRadarReady: p.onRadarReady,
    onRadarStatus: p.onRadarStatus,
  });
  useEffect(() => {
    const m = map.current;
    if (!m || !p.drawing) return;
    const draw = new Draw({
      source: draft.current,
      type: "LineString",
      maxPoints: 2,
      stopClick: true,
    });
    m.addInteraction(draw);
    draw.on("drawend", (e) => {
      current.current.onLine(
        (e.feature.getGeometry() as LineString)
          .getCoordinates()
          .map((c) => toLonLat(c)),
      );
      current.current.onDrawEnd();
      setTimeout(() => draft.current.clear(), 0);
    });
    return () => {
      draw.abortDrawing();
      m.removeInteraction(draw);
      draft.current.clear();
    };
  }, [p.drawing]);
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const c =
      p.source === "taiwan"
        ? [121, 23.5, 6]
        : p.source === "japan"
          ? [137, 36, 5]
          : [144.8, 13.6, 6.2];
    m.getView().animate({
      center: fromLonLat(c.slice(0, 2)),
      zoom: c[2],
      duration: 250,
    });
  }, [p.source]);
  useEffect(() => {
    lineSource.current.clear();
    if (p.line)
      lineSource.current.addFeature(
        new Feature(new LineString(p.line.map((c) => fromLonLat(c)))),
      );
  }, [p.line]);
  useEffect(() => {
    lineSource.current.changed();
  }, [p.side]);
  useEffect(() => {
    marker.current.clear();
    if (p.line && p.cursor !== null)
      marker.current.addFeature(
        new Feature(
          new Point(fromLonLat(linePosition(p.line[0], p.line[1], p.cursor))),
        ),
      );
  }, [p.cursor, p.line]);
  useEffect(() => {
    slice.current.setVisible(p.source === "guam");
    if (!p.data || p.source !== "guam") {
      slice.current.setSource(null);
      return;
    }
    const d = p.data,
      g = d.grid,
      canvas = document.createElement("canvas");
    canvas.width = g.cols;
    canvas.height = g.rows;
    const ctx = canvas.getContext("2d")!,
      image = ctx.createImageData(g.cols, g.rows);
    for (let i = 0; i < d.values.length; i++)
      image.data.set(dbzColor(d.values[i]), i * 4);
    ctx.putImageData(image, 0, 0);
    const source = new ImageStatic({
      url: canvas.toDataURL(),
      projection: "EPSG:4326",
      imageExtent: [
        g.west - g.dx / 2,
        g.north - (g.rows - 0.5) * g.dy,
        g.west + (g.cols - 0.5) * g.dx,
        g.north + g.dy / 2,
      ],
      interpolate: false,
    });
    slice.current.setSource(source);
  }, [p.data, p.source]);
  return (
    <div
      className="radar-map"
      ref={host}
      aria-label="雷達地圖；剖面工具開啟後點選 A、B 兩點"
    />
  );
}
