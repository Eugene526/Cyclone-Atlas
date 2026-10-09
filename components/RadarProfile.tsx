"use client";
import { useEffect, useRef, useState } from "react";
import { dbzColor } from "@/lib/radar.mjs";
import { viewingOrder } from "@/lib/radar-volume.mjs";
export default function RadarProfile({
  data,
  side,
  mode,
  onCursor,
}: {
  data: any;
  side: string;
  mode: string;
  onCursor: (v: number | null) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null),
    box = useRef<HTMLDivElement>(null),
    [size, setSize] = useState([500, 360]),
    [probe, setProbe] = useState<any>(null);
  useEffect(() => {
    const o = new ResizeObserver((entries) => {
      const b = entries[0].contentRect;
      setSize([b.width, b.height]);
    });
    if (box.current) o.observe(box.current);
    return () => o.disconnect();
  }, []);
  useEffect(() => {
    setProbe(null);
    onCursor(null);
  }, [data, side, mode]);
  const plot = () => {
    const w = size[0],
      h = size[1],
      is3 = mode === "3d",
      left = 54,
      right = is3 ? 45 : 18,
      top = is3 ? 40 : 24,
      bottom = is3 ? 60 : 42,
      pw = w - left - right,
      ph = h - top - bottom,
      skew = is3 ? 32 : 0;
    return {
      w,
      h,
      left,
      top,
      pw,
      ph,
      skew,
      project: (t: number, z: number) => [
        left + t * pw + (z / 19) * skew,
        top + ph * (1 - z / 19) + (is3 ? t * 16 : 0),
      ],
    };
  };
  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const { w, h, project } = plot(),
      ratio = Math.min(window.devicePixelRatio || 1, 2);
    c.width = w * ratio;
    c.height = h * ratio;
    const ctx = c.getContext("2d")!;
    ctx.scale(ratio, ratio);
    ctx.fillStyle = "#0e202e";
    ctx.fillRect(0, 0, w, h);
    if (!data) return;
    const order = viewingOrder(side, data.samples);
    for (let j = 0; j < data.layers.length; j++) {
      const layer = data.layers[j],
        lower = layer.height,
        upper = j + 1 < data.layers.length ? data.layers[j + 1].height : 19;
      for (let x = 0; x < data.samples; x++) {
        const v = layer.values[order[x]];
        const [r, g, b] = dbzColor(v === null ? 0 : v);
        ctx.fillStyle =
          v === null ? "#334958" : v < 0 ? "#11283e" : `rgb(${r},${g},${b})`;
        const a = project(x / data.samples, lower),
          b0 = project((x + 1) / data.samples, lower),
          c0 = project((x + 1) / data.samples, upper),
          d = project(x / data.samples, upper);
        ctx.beginPath();
        ctx.moveTo(a[0], a[1]);
        ctx.lineTo(b0[0], b0[1]);
        ctx.lineTo(c0[0], c0[1]);
        ctx.lineTo(d[0], d[1]);
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.font = "11px sans-serif";
    ctx.textAlign = "right";
    for (const z of [0, 5, 10, 15, 19]) {
      const a = project(0, z),
        b = project(1, z);
      ctx.strokeStyle = "#d4e5ec24";
      ctx.beginPath();
      ctx.moveTo(...(a as [number, number]));
      ctx.lineTo(...(b as [number, number]));
      ctx.stroke();
      ctx.fillStyle = "#b5c6d1";
      ctx.fillText(String(z), a[0] - 8, a[1] + 3);
    }
    ctx.save();
    ctx.translate(14, h / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = "center";
    ctx.fillText("海拔高度 · km", 0, 0);
    ctx.restore();
    for (let i = 0; i <= 4; i++) {
      const t = i / 4,
        a = project(t, 0);
      ctx.textAlign = i === 0 ? "left" : i === 4 ? "right" : "center";
      ctx.fillStyle = "#b5c6d1";
      ctx.fillText((data.distance * t).toFixed(0) + " km", a[0], a[1] + 18);
    }
    ctx.textAlign = "left";
    ctx.fillStyle = "#a9efdc";
    const a = project(0, 0),
      b = project(1, 0);
    ctx.fillText(side === "left" ? "A" : "B", a[0], a[1] + 33);
    ctx.textAlign = "right";
    ctx.fillText(side === "left" ? "B" : "A", b[0], b[1] + 33);
    ctx.textAlign = "right";
    ctx.fillStyle = "#7894a6";
    ctx.fillText(
      mode === "3d" ? "立體剖面 · 高度軸誇張顯示" : "高度層間不平滑補值",
      w - 12,
      16,
    );
  }, [data, side, mode, size]);
  const inspect = (clientX: number, clientY: number) => {
    if (!data) return;
    const r = canvas.current!.getBoundingClientRect(),
      { left, top, pw, ph, skew } = plot(),
      x = clientX - r.left,
      y = clientY - r.top,
      tilt = mode === "3d" ? 16 : 0,
      zf =
        (top + ph + (tilt * (x - left)) / pw - y) / (ph + (tilt * skew) / pw),
      t = (x - left - zf * skew) / pw,
      z = zf * 19;
    if (t < 0 || t > 1 || z < 0.5 || z > 19) {
      setProbe(null);
      onCursor(null);
      return;
    }
    const index = Math.min(data.samples - 1, Math.floor(t * data.samples)),
      source = side === "right" ? data.samples - 1 - index : index,
      layer = [...data.layers].reverse().find((v: any) => v.height <= z);
    setProbe({
      height: layer.height,
      distance: (source / (data.samples - 1)) * data.distance,
      value: layer.values[source],
    });
    onCursor(source / (data.samples - 1));
  };
  return (
    <div className="radar-profile-canvas" ref={box}>
      <canvas
        ref={canvas}
        aria-label="雷達垂直剖面，横軸距離、縱軸海拔高度"
        onPointerMove={(e) => inspect(e.clientX, e.clientY)}
        onPointerDown={(e) => inspect(e.clientX, e.clientY)}
        onPointerLeave={() => {
          setProbe(null);
          onCursor(null);
        }}
      />
      {probe && (
        <div className="radar-profile-probe">
          距 A {probe.distance.toFixed(1)} km · {probe.height.toFixed(2)} km MSL
          · {probe.value === null ? "缺測" : probe.value.toFixed(1) + " dBZ"}
        </div>
      )}
    </div>
  );
}
