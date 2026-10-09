"use client";
import { useState, useEffect, useRef } from "react";
import {
  Radar,
  Satellite,
  Wind,
  Layers,
  Info,
  X,
  Plus,
  Minus,
  Play,
  Pause,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  ScanLine,
  ArrowLeftRight,
} from "lucide-react";
import RadarVolumeMap from "./RadarVolumeMap";
import RadarProfile from "./RadarProfile";
import { radarVolume } from "@/lib/radar-volume-client";
import { parseVolumeLine, VOLUME_HEIGHTS } from "@/lib/radar-volume.mjs";
import { DBZ_COLORS } from "@/lib/radar.mjs";
import { fetchJson } from "@/lib/http-json.mjs";
import "./radar.css";
const SOURCES = [
  { id: "guam", name: "關島周邊 · NOAA MRMS", type: "33 層三維觀測" },
  { id: "taiwan", name: "臺灣 · 中央氣象署", type: "平面整合回波" },
  { id: "japan", name: "日本 · 日本氣象廳", type: "平面降水強度" },
];
const fmt = (t: string, zone: string) =>
  new Date(t).toLocaleString("zh-TW", {
    timeZone: zone === "tw" ? "Asia/Taipei" : "UTC",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
export default function RadarExplorer() {
  const [source, setSource] = useState("guam"),
    [meta, setMeta] = useState<any>(null),
    [time, setTime] = useState(""),
    [height, setHeight] = useState(0.5),
    [data, setData] = useState<any>(null),
    [profile, setProfile] = useState<any>(null),
    [line, setLine] = useState<number[][] | null>(null),
    [drawing, setDrawing] = useState(false),
    [side, setSide] = useState("left"),
    [mode, setMode] = useState("3d"),
    [cursor, setCursor] = useState<number | null>(null),
    [busy, setBusy] = useState(false),
    [profileBusy, setProfileBusy] = useState(false),
    [error, setError] = useState(""),
    [playing, setPlaying] = useState(false),
    [interval, setIntervalSeconds] = useState(1.5),
    [radarReady, setRadarReady] = useState(true),
    [radarStatus, setRadarStatus] = useState(""),
    [zone, setZone] = useState("tw"),
    [follow, setFollow] = useState(true),
    [settings, setSettings] = useState(false),
    [sectionOpen, setSectionOpen] = useState(true),
    [info, setInfo] = useState(false),
    [reload, setReload] = useState(0);
  const api = useRef<any>(null),
    dialog = useRef<HTMLDialogElement>(null),
    current = useRef<any>(null),
    generation = useRef(0);
  current.current = { source, time, line, follow };
  const isVolume = source === "guam",
    index = meta?.frames.findIndex((f: any) => f.time === time) ?? -1,
    nextTime =
      index >= 0 ? meta.frames[(index + 1) % meta.frames.length]?.time : null;
  useEffect(() => {
    if (info) dialog.current?.showModal();
  }, [info]);
  useEffect(() => {
    setPlaying(false);
    setMeta(null);
    setTime("");
    setData(null);
    setProfile(null);
    setLine(null);
    setDrawing(false);
    setError("");
    let live = true;
    const update = async () => {
      try {
        const m = isVolume
          ? await radarVolume("manifest", {})
          : await fetchJson(
              "/api/radar?provider=" + (source === "taiwan" ? "cwa" : "jma"),
            );
        if (!live) return;
        const frames = [...m.frames].sort(
          (a: any, b: any) => Date.parse(a.time) - Date.parse(b.time),
        );
        setMeta({ ...m, frames });
        setTime((old) =>
          !old || current.current.follow ? frames.at(-1).time : old,
        );
        setError("");
      } catch (e) {
        if (live)
          setError(e instanceof Error ? e.message : "雷達觀測列表暫未就緒");
      }
    };
    update();
    const timer = window.setInterval(update, 60000);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [source, reload]);
  useEffect(() => {
    const id = ++generation.current;
    if (!isVolume || !time) {
      setBusy(false);
      return;
    }
    setBusy(true);
    setError("");
    radarVolume("slice", { time, height: String(height) })
      .then((d) => {
        if (id === generation.current) {
          setData(d);
          setBusy(false);
        }
      })
      .catch((e) => {
        if (id === generation.current) {
          setBusy(false);
          setError(e.message);
          setPlaying(false);
        }
      });
  }, [source, time, height]);
  useEffect(() => {
    if (!isVolume || !time || !line) {
      setProfile(null);
      setProfileBusy(false);
      return;
    }
    let live = true;
    setProfileBusy(true);
    setError("");
    radarVolume("profile", { time, a: line[0].join(","), b: line[1].join(",") })
      .then((d) => {
        if (live) {
          setProfile(d);
          setProfileBusy(false);
        }
      })
      .catch((e) => {
        if (live) {
          setProfileBusy(false);
          setError(e.message);
          setPlaying(false);
        }
      });
    return () => {
      live = false;
    };
  }, [source, time, line]);
  // One-frame lookahead, bounded cached packets; never download an entire animation volume at once.
  useEffect(() => {
    if (
      !playing ||
      !isVolume ||
      busy ||
      profileBusy ||
      !nextTime ||
      nextTime === time
    )
      return;
    radarVolume("slice", { time: nextTime, height: String(height) }).catch(
      () => {},
    );
    if (line)
      radarVolume("profile", {
        time: nextTime,
        a: line[0].join(","),
        b: line[1].join(","),
      }).catch(() => {});
  }, [playing, busy, profileBusy, nextTime, time, height, line, isVolume]);
  useEffect(() => {
    if (!playing || busy || profileBusy || !radarReady || !nextTime || error)
      return;
    const timer = setTimeout(() => {
      setFollow(false);
      setTime(nextTime);
    }, interval * 1000);
    return () => clearTimeout(timer);
  }, [playing, busy, profileBusy, radarReady, nextTime, error, interval]);
  const changeLine = (v: number[][]) => {
    try {
      parseVolumeLine(v[0], v[1]);
      setLine(v.map((p) => p.map((n) => Number(n.toFixed(5)))));
      setProfile(null);
      setCursor(null);
      setSectionOpen(true);
      setError("");
      setPlaying(false);
    } catch (e) {
      setLine((old) => (old ? [...old] : null));
      setError((e as Error).message);
    }
  };
  const clear = () => {
    setLine(null);
    setProfile(null);
    setDrawing(false);
    setCursor(null);
    setPlaying(false);
  };
  const activeTime = isVolume ? data?.time : time,
    src = SOURCES.find((s) => s.id === source)!,
    stale = activeTime && Date.now() - Date.parse(activeTime) > 15 * 60000;
  return (
    <main className="radar-explorer">
      <header className="radar-header">
        <a className="radar-brand" href="/">
          <img src="/images/typhoon-observatory-logo.png" alt="颱風觀測站" />
        </a>
        <nav aria-label="觀測頁面">
          <a href="/">
            <Satellite size={15} />
            衛星
          </a>
          <a href="/wind">
            <Wind size={15} />
            風場
          </a>
          <a href="/weather">
            <Layers size={15} />
            天氣圖
          </a>
          <a href="/radar" aria-current="page">
            <Radar size={15} />
            雷達
          </a>
        </nav>
        <button
          className="radar-icon"
          aria-label="雷達回波說明"
          onClick={() => setInfo(true)}
        >
          <Info size={19} />
        </button>
      </header>
      <div className="radar-workspace">
        <section className="radar-map-pane">
          <RadarVolumeMap
            source={source}
            time={time}
            data={data}
            line={line}
            side={side}
            drawing={drawing}
            onLine={changeLine}
            onDrawEnd={() => setDrawing(false)}
            onReady={(v) => (api.current = v)}
            onRadarReady={setRadarReady}
            onRadarStatus={setRadarStatus}
            playing={playing}
            nextTimes={nextTime ? [nextTime] : []}
            cursor={cursor}
          />
          <div className="radar-heading">
            <span>RADAR OBSERVATIONS</span>
            <h1>雷達回波</h1>
            <p>
              {src.type}
              {isVolume ? " · 海拔 " + height + " km" : ""}
            </p>
          </div>
          <section className={"radar-settings " + (settings ? "open" : "")}>
            <button
              className="radar-settings-toggle"
              aria-expanded={settings}
              onClick={() => setSettings(!settings)}
            >
              <Radar size={17} />
              {isVolume
                ? "關島 · 三維回波"
                : source === "taiwan"
                  ? "臺灣 · 平面回波"
                  : "日本 · 平面回波"}
              <ChevronDown size={16} />
            </button>
            <div className="radar-settings-body">
              <label>
                觀測來源
                <select
                  value={source}
                  onChange={(e) => {
                    setSource(e.target.value);
                    setFollow(true);
                    setSettings(false);
                  }}
                >
                  {SOURCES.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
              {isVolume && (
                <label>
                  地圖高度切片（海拔）
                  <select
                    value={height}
                    onChange={(e) => {
                      setHeight(Number(e.target.value));
                      setPlaying(false);
                    }}
                  >
                    {VOLUME_HEIGHTS.map((h) => (
                      <option key={h} value={h}>
                        {h.toFixed(2)} km
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label>
                顯示時區
                <select value={zone} onChange={(e) => setZone(e.target.value)}>
                  <option value="tw">臺灣 UTC+8</option>
                  <option value="utc">UTC</option>
                </select>
              </label>
              <label>
                動畫影格間隔
                <select
                  value={interval}
                  onChange={(e) => setIntervalSeconds(Number(e.target.value))}
                >
                  <option value=".8">0.8 秒</option>
                  <option value="1.5">1.5 秒</option>
                  <option value="3">3 秒</option>
                  <option value="5">5 秒</option>
                </select>
              </label>
              <label className="radar-check">
                <input
                  type="checkbox"
                  checked={follow}
                  onChange={(e) => {
                    setFollow(e.target.checked);
                    setPlaying(false);
                    if (e.target.checked && meta)
                      setTime(meta.frames.at(-1).time);
                  }}
                />
                自動追蹤最新觀測
              </label>
              <button
                className="radar-text-button"
                onClick={() => setReload((v) => v + 1)}
              >
                <RefreshCw size={14} />
                更新資料列表
              </button>
              <p>
                {isVolume
                  ? "原始 0.005° 格點；地圖採樣 0.02°。剖面直接取原始格點，最低觀測層為海拔 0.5 km。"
                  : "此來源為平面產品，未接入多高度原始資料，因此不提供三維剖面。"}
              </p>
            </div>
          </section>
          <div className="radar-zoom">
            <button
              aria-label="放大雷達地圖"
              onClick={() => api.current?.zoom(1)}
            >
              <Plus size={20} />
            </button>
            <button
              aria-label="縮小雷達地圖"
              onClick={() => api.current?.zoom(-1)}
            >
              <Minus size={20} />
            </button>
          </div>
          {isVolume && (
            <div className="radar-draw-tools">
              <button
                className={drawing ? "active" : ""}
                aria-pressed={drawing}
                onClick={() => {
                  setDrawing(!drawing);
                  setPlaying(false);
                  setSettings(false);
                }}
              >
                <ScanLine size={17} />
                {drawing ? "取消拉線" : "繪製剖面線"}
              </button>
              {line && (
                <button onClick={clear} aria-label="清除剖面線">
                  <X size={16} />
                </button>
              )}
              {data?.peak && (
                <button
                  className="radar-focus"
                  onClick={() =>
                    api.current?.focus(data.peak.lon, data.peak.lat)
                  }
                >
                  定位強回波
                </button>
              )}
            </div>
          )}
          {drawing && (
            <div role="status" className="radar-draw-hint">
              依序點選 A、B 兩點；完成後可拖動端點調整。
              <button onClick={() => setDrawing(false)}>取消</button>
            </div>
          )}
          <div className="radar-map-scale">
            {source === "japan" ? "降水強度 · mm/h" : "回波強度 · dBZ"}
            <span>
              {source === "japan"
                ? "1 · 5 · 10 · 20 · 50 · 80+"
                : "0 · 20 · 40 · 60 · 70+"}
            </span>
          </div>
          <section className="radar-timeline">
            <div className="radar-time-head">
              <button
                aria-label={playing ? "暫停雷達動畫" : "播放雷達動畫"}
                className="radar-play"
                disabled={!playing && (!meta || busy || profileBusy || Boolean(error))}
                onClick={() => {
                  setPlaying(!playing);
                  setFollow(false);
                }}
              >
                {playing ? <Pause size={18} /> : <Play size={18} />}
              </button>
              <div>
                <strong>
                  {activeTime ? fmt(activeTime, zone) : "正在取得觀測"}
                </strong>
                <small>
                  {zone === "tw" ? "UTC+8 臺灣" : "UTC"} ·{" "}
                  {isVolume ? "高度切片觀測時間" : "選取觀測時間"}
                  {stale ? " · 非即時資料" : ""}
                </small>
              </div>
              <button
                className={"radar-latest " + (follow ? "active" : "")}
                onClick={() => {
                  setFollow(true);
                  setPlaying(false);
                  if (meta) setTime(meta.frames.at(-1).time);
                }}
              >
                最新
              </button>
            </div>
            <input
              aria-label="雷達觀測時間軸"
              type="range"
              min={0}
              max={Math.max(0, (meta?.frames.length || 1) - 1)}
              value={Math.max(0, index)}
              disabled={!meta}
              onChange={(e) => {
                setTime(meta.frames[Number(e.target.value)].time);
                setPlaying(false);
                setFollow(false);
              }}
            />
            <label className="radar-time-select">
              觀測時間
              <select
                aria-label="選擇雷達觀測時間"
                value={time}
                disabled={!meta}
                onChange={(e) => {
                  setTime(e.target.value);
                  setPlaying(false);
                  setFollow(false);
                }}
              >
                {meta?.frames.map((f: any) => (
                  <option key={f.time} value={f.time}>
                    {fmt(f.time, zone)} {zone === "tw" ? "UTC+8" : "UTC"}
                  </option>
                ))}
              </select>
            </label>
            {busy && <p role="status">載入高度切片，暫留上一張觀測…</p>}
            {!isVolume && <p role="status">{radarStatus}</p>}
            {error && (
              <p role="alert" className="radar-error">
                {error}
              </p>
            )}
          </section>
        </section>
        <aside
          className={"radar-section-pane " + (!sectionOpen ? "collapsed" : "")}
        >
          <button
            className="radar-section-toggle"
            aria-expanded={sectionOpen}
            onClick={() => setSectionOpen(!sectionOpen)}
          >
            <span>
              <ScanLine size={16} />
              垂直剖面
            </span>
            {sectionOpen ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
          </button>
          <div className="radar-section-body">
            <div className="radar-section-heading">
              <span>穿過降水，查看垂直結構</span>
              <h2>{line ? "A — B 剖面" : "從地圖畫一條線開始"}</h2>
              <p>
                {profile
                  ? `${profile.distance.toFixed(1)} km · ${fmt(profile.time, zone)} ${zone === "tw" ? "UTC+8" : "UTC"}`
                  : "關島周邊 · 海拔 0.5–19 km"}
              </p>
            </div>
            <div className="radar-segments" aria-label="觀看剖面側面">
              <button
                disabled={!isVolume}
                aria-pressed={side === "left"}
                onClick={() => setSide("left")}
              >
                從左側看
              </button>
              <button
                disabled={!isVolume}
                aria-pressed={side === "right"}
                onClick={() => setSide("right")}
              >
                從右側看
              </button>
            </div>
            <p className="radar-side-note">
              以 A → B 方向判斷左右；換側會反轉畫面中的 A、B 順序，資料值不變。
            </p>
            <div className="radar-view-modes">
              <button
                aria-pressed={mode === "3d"}
                onClick={() => setMode("3d")}
              >
                立體剖面
              </button>
              <button
                aria-pressed={mode === "2d"}
                onClick={() => setMode("2d")}
              >
                平面剖面
              </button>
              {line && (
                <button
                  onClick={() => {
                    setLine([line[1], line[0]]);
                    setProfile(null);
                    setPlaying(false);
                  }}
                  title="交換剖面端點"
                >
                  <ArrowLeftRight size={14} />
                  交換 A/B
                </button>
              )}
            </div>
            {profile ? (
              <RadarProfile
                data={profile}
                side={side}
                mode={mode}
                onCursor={setCursor}
              />
            ) : (
              <div className="radar-empty">
                <ScanLine size={34} />
                <strong>
                  {!isVolume
                    ? "此來源尚無三維資料"
                    : profileBusy
                      ? "正在組合 33 個原始高度層"
                      : "在地圖選取 A、B 端點"}
                </strong>
                <p>
                  {!isVolume
                    ? "切換至關島 MRMS 即可使用垂直剖面。"
                    : profileBusy
                      ? "首次載入需取得多個高度層；完成後會快取剖面，不需要重新下載整個體積。"
                      : "剖面線需位於虛線框內。可先按「定位強回波」，再拉線穿過降水區。"}
                </p>
              </div>
            )}
            {profileBusy && profile && (
              <p role="status" className="radar-section-status">
                準備下一個剖面；目前顯示時間以上方標示為準…
              </p>
            )}
            {isVolume && (
              <div className="radar-dbz-legend">
                <b>
                  回波強度 <small>dBZ</small>
                </b>
                <div
                  style={{
                    background:
                      "linear-gradient(90deg," +
                      DBZ_COLORS.map(
                        (c: any) => "rgb(" + c[1].join(",") + ")",
                      ).join(",") +
                      ")",
                  }}
                />
                <p>
                  <span>0</span>
                  <span>20</span>
                  <span>40</span>
                  <span>60</span>
                  <span>70+</span>
                </p>
              </div>
            )}
            <p className="radar-footnote">
              回波表示降水粒子的反射訊號，不是雲的真實外形。未觀測到的高度與缺測區域不補造資料；三維資料只涵蓋關島周邊，不是整個西太平洋。
            </p>
            <a
              className="radar-source-link"
              href="https://mrms.ncep.noaa.gov/3DRefl/GUAM/"
              target="_blank"
              rel="noreferrer"
            >
              NOAA MRMS 原始資料 ↗
            </a>
          </div>
        </aside>
      </div>
      <dialog
        className="radar-dialog"
        ref={dialog}
        onClose={() => setInfo(false)}
      >
        <button
          aria-label="關閉雷達說明"
          onClick={() => dialog.current?.close()}
        >
          <X size={20} />
        </button>
        <h2>如何閱讀雷達回波</h2>
        <p>
          關島三維資料來自 NOAA MRMS 的 33 個原生海拔高度層，0.5–19
          公里。地圖顯示選取高度的水平切片；最低層不等於地面雨量。觀測時間含秒數，各高度層必須與所選時間完全一致。
        </p>
        <p>
          開啟「繪製剖面線」後依序點選
          A、B；端點可以拖動。剖面沿大圓路徑取最近原始格點，未額外提升解析度。從左側看時
          A 在左，從右側看時 B 在左。游標可查看原始高度層及
          dBZ，並在地圖同步標示位置。
        </p>
        <p>
          立體剖面是實際垂直切面的透視顯示，不是整個降水體積的立體等值面。高度軸為了易讀而誇張顯示，各高度層以色帶呈現，不代表層間連續觀測。
        </p>
        <p>
          dBZ 是反射率的對數單位，不是雨量 mm/h。灰色表示缺測，深藍表示低於 0
          dBZ；最低層以下保持空白。雷達可能受地形遮蔽、距離、掃描幾何及品質控制影響，缺測不等於沒有降水。
        </p>
        <p>
          臺灣為 CWA 原始平面整合回波，單位 dBZ；日本為 JMA 平面降水強度，單位
          mm/h。兩者目前未接入多高度資料，不產生三維剖面。日本仍使用原生偶數圖磚層級。
        </p>
        <p>
          時間回放依來源實際保留清單提供，不保證長期歷史。三維首次載入需要下載多個高度層；播放會等待資料就緒、預載下一張，並快取已完成剖面。每分鐘檢查新觀測，勾選追蹤最新時才自動切換。
        </p>
        <p>
          資料來源：NOAA、中央氣象署、日本氣象廳。此頁供觀測與研究，不取代官方警報。
        </p>
      </dialog>
    </main>
  );
}
