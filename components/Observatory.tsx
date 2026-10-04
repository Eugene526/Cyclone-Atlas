"use client";
import { useState, useEffect, useRef } from "react";
import {
  Satellite,
  Layers,
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  Plus,
  Minus,
  Crosshair,
  Download,
  Radio,
  Clock3,
  Info,
  ArrowUpRight,
  Menu,
  X,
  RefreshCw,
  Wind,
  Focus,
} from "lucide-react";
import WeatherMap, { MapAPI } from "./WeatherMap";
import { Mode, tw, isNight } from "@/lib/satellite";
const regions = [
  { name: "西北太平洋", box: [95, -5, 180, 55] },
  { name: "臺灣與鄰近海域", box: [115, 18, 129, 29] },
  { name: "日本與琉球", box: [122, 22, 149, 43] },
  { name: "菲律賓海", box: [120, 5, 153, 27] },
  { name: "衛星最大覆蓋範圍", box: [80, -55, 180, 60] },
];
export default function Observatory() {
  const [pointInfo, setPointInfo] = useState<any>(null);
  const [frameReady, setFrameReady] = useState(false),
    [rangeEnd, setRangeEnd] = useState(""),
    [latest, setLatest] = useState(""),
    [time, setTime] = useState(""),
    [live, setLive] = useState(true),
    [mode, setMode] = useState<Mode>("auto"),
    [opacity, setOpacity] = useState(0.94),
    [center, setCenter] = useState([137, 22]),
    [status, setStatus] = useState("連線至衛星資料源…"),
    [storms, setStorms] = useState<any[]>([]),
    [wind, setWind] = useState(true),
    [forecast, setForecast] = useState(true),
    [play, setPlay] = useState(false),
    [hours, setHours] = useState(3),
    [step, setStep] = useState(20),
    [panel, setPanel] = useState(
      typeof window !== "undefined" && window.innerWidth > 720,
    ),
    [info, setInfo] = useState(false),
    [models, setModels] = useState<any[]>([]),
    [selected, setSelected] = useState<string[]>([]),
    [modelStatus, setModelStatus] = useState("尚未載入"),
    [jmaStatus, setJmaStatus] = useState("讀取中"),
    [region, setRegion] = useState(0),
    [bounds, setBounds] = useState([120, 15, 155, 35]),
    [areaError, setAreaError] = useState("");
  const api = useRef<MapAPI | null>(null),
    liveRef = useRef(live);
  liveRef.current = live;
  const night = time ? isNight(time, center[0], center[1]) : false,
    effective = mode === "auto" ? (night ? "bw" : "rgb") : mode;
  async function refresh() {
    try {
      const r = await fetch("/api/satellite");
      const d: any = await r.json();
      if (!r.ok) throw Error(d.error);
      setLatest(d.time);
      if (liveRef.current) {
        setTime(d.time);
        setRangeEnd(d.time);
      }
    } catch (e) {
      setStatus("衛星資料源暫時未回應");
    }
    try {
      const r = await fetch("/api/jma"),
        d: any = await r.json();
      if (!r.ok) throw Error(d.error);
      setStorms(d.storms);
      setJmaStatus(`更新 ${tw(d.checkedAt)}`);
    } catch {
      setJmaStatus("來源暫時未回應");
    }
  }
  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 60000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (!play || !rangeEnd || !frameReady) return;
    const t = setTimeout(() => {
      setFrameReady(false);
      setTime((old) => {
        const next = new Date(old).getTime() + step * 60000;
        return new Date(
          next > new Date(rangeEnd).getTime()
            ? new Date(rangeEnd).getTime() - hours * 3600000
            : next,
        ).toISOString();
      });
    }, 500);
    return () => clearTimeout(t);
  }, [play, rangeEnd, hours, step, frameReady, time]);
  function jump(minutes: number) {
    setLive(false);
    setPlay(false);
    setTime(
      new Date(
        Math.min(
          new Date(latest).getTime(),
          new Date(time).getTime() + minutes * 60000,
        ),
      ).toISOString(),
    );
  }
  const age = latest
    ? Math.floor((Date.now() - new Date(latest).getTime()) / 60000)
    : 0;
  return (
    <main className="observatory">
      <header className="topbar">
        <a className="brand" href="/" aria-label="颱風觀測室首頁">
          <span className="brand-mark">◉</span>
          <span>
            颱風觀測室<small>CYCLONE ATLAS</small>
          </span>
        </a>
        <div className="header-rule" />
        <div className="workspace">
          <span>衛星觀測</span>
          <small>西北太平洋 · HIMAWARI</small>
        </div>
        <div className="header-actions">
          <span className={"live-tag " + (age > 60 ? "stale" : "")}>
            <i />
            {latest ? (age > 60 ? "資料延遲" : "持續觀測") : "連線中"}
          </span>
          <button
            className="icon-button"
            onClick={() => setInfo(true)}
            title="資料與使用說明"
          >
            <Info size={18} />
          </button>
          <button
            className="icon-button mobile"
            onClick={() => setPanel(!panel)}
            title="圖層選單"
          >
            <Menu size={19} />
          </button>
        </div>
      </header>
      <div className="canvas-shell">
        <WeatherMap
          time={time}
          mode={effective}
          playing={play}
          nextTimes={
            time
              ? [1, 2, 3]
                  .map((i) =>
                    new Date(
                      new Date(time).getTime() + step * 60000 * i,
                    ).toISOString(),
                  )
                  .filter((t) => t <= rangeEnd)
              : []
          }
          opacity={opacity}
          storms={storms}
          wind={wind}
          forecast={forecast}
          models={models.filter((m) => selected.includes(m.id))}
          onPoint={setPointInfo}
          onLoaded={() => setFrameReady(true)}
          onLoading={() => setFrameReady(false)}
          onCenter={setCenter}
          onStatus={setStatus}
          onReady={(a) => (api.current = a)}
        />
        <div className="map-top">
          <div className="eyebrow">
            <span /> EARTH OBSERVATION
          </div>
          <h1>西太平洋・全域觀測</h1>
          <p>
            {time ? `${tw(time)} 臺灣時間` : "取得最新觀測中"} <span>｜</span>{" "}
            {effective === "ott"
              ? "紅外線色調強化"
              : effective === "rgb"
                ? "真實色合成"
                : "黑白紅外線"}
          </p>
        </div>
        <div className="mode-panel">
          <div className="section-label">
            <Satellite size={14} />
            衛星影像
          </div>
          <div className="mode-tabs">
            {(
              [
                ["auto", "自動"],
                ["ott", "OTT 強化"],
                ["rgb", "真實色"],
                ["bw", "黑白"],
              ] as [Mode, string][]
            ).map(([id, label]) => (
              <button
                key={id}
                className={mode === id ? "active" : ""}
                onClick={() => setMode(id)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="mode-foot">
            <span>
              {mode === "auto"
                ? night
                  ? "☾ 中心點入夜 · 已切換紅外線"
                  : "☀ 中心點日間 · 真實色"
                : mode === "rgb"
                  ? "真實色需日照；夜間區域偏暗"
                  : "B13 · 10.4 μm 紅外線"}
            </span>
            <span>AHI</span>
          </div>
        </div>
        <div className="map-controls">
          <button title="放大" onClick={() => api.current?.zoom(1)}>
            <Plus size={20} />
          </button>
          <button title="縮小" onClick={() => api.current?.zoom(-1)}>
            <Minus size={20} />
          </button>
          <div />
          <button
            title="回到臺灣"
            onClick={() => {
              setRegion(1);
              api.current?.region(regions[1].box);
            }}
          >
            <Crosshair size={19} />
          </button>
          <button
            title="匯出 4K 圖片"
            onClick={() => {
              setStatus("準備 4K 匯出，等待圖磚完成…");
              api.current?.export();
            }}
          >
            <Download size={19} />
          </button>
        </div>
        <div className="map-legend">
          <div className="legend-title">
            {effective === "ott"
              ? "雲頂亮溫 · 約 °C"
              : effective === "bw"
                ? "紅外線 · 亮度強化"
                : "日間真實色合成"}
            <span>HIMAWARI-9</span>
          </div>
          {effective === "ott" ? (
            <>
              <div className="thermal-gradient" />
              <div className="legend-ticks">
                <span>−90</span>
                <span>−70</span>
                <span>−50</span>
                <span>−30</span>
                <span>−10</span>
                <span>+10</span>
                <span>+30</span>
                <span>+50</span>
              </div>
            </>
          ) : (
            <p>
              {effective === "bw"
                ? "亮白較冷，深灰較暖；非可見光照片。"
                : "保留雲系紋理與地表色彩；夜側無日照。"}
            </p>
          )}
          <div className="map-meta">
            {center[1].toFixed(2)}°N &nbsp; {center[0].toFixed(2)}°E{" "}
            <span>自適應圖磚</span>
          </div>
        </div>
        {panel && (
          <aside className="sidebar">
            <div className="panel-heading">
              <div>
                <Layers size={16} />
                <h2>觀測圖層</h2>
              </div>
              <button
                className="icon-button mobile"
                onClick={() => setPanel(false)}
                title="關閉"
              >
                <X size={18} />
              </button>
              <span className="tiny-pill">即時來源</span>
            </div>
            <section>
              <div className="section-label">
                01 <span>觀測範圍</span>
              </div>
              <select
                aria-label="選擇觀測範圍"
                value={region}
                onChange={(e) => {
                  const i = +e.target.value;
                  setRegion(i);
                  api.current?.region(regions[i].box);
                }}
              >
                {regions.map((r, i) => (
                  <option key={r.name} value={i}>
                    {r.name}
                  </option>
                ))}
              </select>
              <details className="custom-area">
                <summary>自訂經緯度範圍</summary>
                <div className="bounds-grid">
                  {["西界 °E", "南界 °N", "東界 °E", "北界 °N"].map(
                    (label, i) => (
                      <label key={label}>
                        {label}
                        <input
                          type="number"
                          aria-label={label}
                          value={bounds[i]}
                          onChange={(e) =>
                            setBounds((a) =>
                              a.map((n, j) => (j === i ? +e.target.value : n)),
                            )
                          }
                        />
                      </label>
                    ),
                  )}
                </div>
                <button
                  onClick={() => {
                    if (
                      bounds[0] >= bounds[2] ||
                      bounds[1] >= bounds[3] ||
                      bounds[0] < 85 ||
                      bounds[2] > 180 ||
                      bounds[1] < -55 ||
                      bounds[3] > 60
                    ) {
                      setAreaError(
                        "範圍：85–180°E、55°S–60°N；西小於東、南小於北。",
                      );
                      return;
                    }
                    setAreaError("");
                    api.current?.region(bounds);
                  }}
                >
                  套用範圍
                </button>
                {areaError && <p>{areaError}</p>}
              </details>
              <div className="range-label">
                <span>影像不透明度</span>
                <b>{Math.round(opacity * 100)}%</b>
              </div>
              <input
                aria-label="影像不透明度"
                type="range"
                min=".2"
                max="1"
                step=".01"
                value={opacity}
                onChange={(e) => setOpacity(+e.target.value)}
              />
            </section>
            <section>
              <div className="section-label">
                02 <span>熱帶氣旋</span>
                <span className="count">{storms.length}</span>
              </div>
              {storms.length ? (
                storms.map((st) => {
                  const title = st.data?.[0],
                    a = st.data?.find((d: any) => d.advancedHours === 0);
                  return (
                    <button
                      className="storm-card"
                      key={st.id}
                      onClick={() => {
                        if (a?.center)
                          api.current?.region([
                            a.center[1] - 7,
                            a.center[0] - 4,
                            a.center[1] + 7,
                            a.center[0] + 4,
                          ]);
                      }}
                    >
                      <div className="storm-icon">
                        <Wind size={25} />
                      </div>
                      <div>
                        <strong>{title?.name?.en || st.id}</strong>
                        <span>{title?.typhoonNumber || ""} · JMA 官方分析</span>
                      </div>
                      <Focus size={17} />
                    </button>
                  );
                })
              ) : (
                <p className="muted">
                  {jmaStatus.includes("更新")
                    ? "目前未發布熱帶氣旋資料"
                    : "正在取得官方資料…"}
                </p>
              )}
              <label className="toggle-row">
                <span>
                  <i className="legend-dot gold" />
                  烈風圈與暴風圈
                </span>
                <input
                  type="checkbox"
                  checked={wind}
                  onChange={(e) => setWind(e.target.checked)}
                />
              </label>
              <label className="toggle-row">
                <span>
                  <i className="legend-dot coral" />
                  預報圓與暴風警戒域
                </span>
                <input
                  type="checkbox"
                  checked={forecast}
                  onChange={(e) => setForecast(e.target.checked)}
                />
              </label>
              <p className="source-note">
                日本氣象廳 · {jmaStatus}
                <br />
                風圈為最新分析，不隨衛星歷史時間回溯。
              </p>
            </section>
            <section>
              <div className="section-label">
                03 <span>系集路徑</span>
                <span className="tiny-pill">模式</span>
              </div>
              <ModelPanel
                models={models}
                setModels={setModels}
                selected={selected}
                setSelected={setSelected}
                status={modelStatus}
                setStatus={setModelStatus}
              />
              <p className="source-note">
                細線各代表一個系集成員，不是官方颱風路徑。不同模式起報時間可能不同。
              </p>
            </section>
            <a
              className="data-link"
              href="https://www.jma.go.jp/bosai/map.html#contents=typhoon"
              target="_blank"
              rel="noreferrer"
            >
              日本氣象廳官方警報 <ArrowUpRight size={14} />
            </a>
          </aside>
        )}
        {pointInfo && (
          <PointDetails data={pointInfo} onClose={() => setPointInfo(null)} />
        )}
        <div className="timeline">
          <div className="time-top">
            <div className="time-title">
              <Clock3 size={16} />
              <b>{time ? tw(time) : "-- / --  --:--"}</b>
              <span>UTC+8</span>
            </div>
            <div className="timeline-options">
              <select
                aria-label="動畫時間範圍"
                value={hours}
                onChange={(e) => setHours(+e.target.value)}
              >
                <option value={1}>往前 1 小時</option>
                <option value={3}>往前 3 小時</option>
                <option value={6}>往前 6 小時</option>
                <option value={12}>往前 12 小時</option>
              </select>
              <button
                className={"latest-button " + (live ? "on" : "")}
                onClick={() => {
                  setLive(true);
                  setPlay(false);
                  setTime(latest);
                  setRangeEnd(latest);
                  refresh();
                }}
              >
                <Radio size={13} />
                最新
              </button>
            </div>
          </div>
          <div className="scrubber">
            <button
              className="play-button"
              title={play ? "暫停動畫" : "播放動畫"}
              disabled={!time}
              onClick={() => {
                setLive(false);
                setPlay(!play);
              }}
            >
              {play ? <Pause size={18} /> : <Play size={18} />}
            </button>
            <button
              className="step-button"
              title="前一張"
              disabled={!time}
              onClick={() => jump(-10)}
            >
              <ChevronLeft size={18} />
            </button>
            <input
              aria-label="衛星觀測時間軸"
              type="range"
              min={
                rangeEnd ? new Date(rangeEnd).getTime() - hours * 3600000 : 0
              }
              max={rangeEnd ? new Date(rangeEnd).getTime() : 100}
              step={600000}
              value={time ? new Date(time).getTime() : 0}
              onChange={(e) => {
                setLive(false);
                setPlay(false);
                setTime(new Date(+e.target.value).toISOString());
              }}
            />
            <button
              className="step-button"
              title="後一張"
              disabled={!time}
              onClick={() => jump(10)}
            >
              <ChevronRight size={18} />
            </button>
            <input
              className="datetime"
              aria-label="指定衛星日期時間（臺灣）"
              type="datetime-local"
              step="600"
              value={
                time
                  ? new Date(new Date(time).getTime() + 8 * 3600000)
                      .toISOString()
                      .slice(0, 16)
                  : ""
              }
              onChange={(e) => {
                if (e.target.value) {
                  setLive(false);
                  setPlay(false);
                  const picked = new Date(e.target.value + "+08:00");
                  picked.setUTCMinutes(
                    Math.floor(picked.getUTCMinutes() / 10) * 10,
                    0,
                    0,
                  );
                  setTime(picked.toISOString());
                  setRangeEnd(picked.toISOString());
                }
              }}
            />
          </div>
          <div className="timeline-bottom">
            <span className="status">
              <i />
              {status}
            </span>
            <span>每 10 分鐘觀測 · 每 1 分鐘檢查更新</span>
            <label>
              動畫間隔{" "}
              <select
                aria-label="動畫取樣間隔"
                value={step}
                onChange={(e) => setStep(+e.target.value)}
              >
                <option value={10}>10 分鐘</option>
                <option value={20}>20 分鐘</option>
                <option value={30}>30 分鐘</option>
                <option value={60}>60 分鐘</option>
              </select>
            </label>
          </div>
        </div>
      </div>
      {info && (
        <div className="modal-scrim" onClick={() => setInfo(false)}>
          <article className="info-modal" onClick={(e) => e.stopPropagation()}>
            <button
              className="icon-button close"
              title="關閉說明"
              onClick={() => setInfo(false)}
            >
              <X />
            </button>
            <div className="eyebrow">DATA & METHODOLOGY</div>
            <h2>每一張雲圖，都有來源。</h2>
            <p>
              採用日本向日葵衛星 NICT
              圖磚，依地球同步衛星投影重投影至可移動地圖。白色海岸線使用 Natural
              Earth。
            </p>
            <h3>你提供的技術，已融入網站</h3>
            <p>
              沿用資料夾的 D531106 真實色、B13 紅外線取圖方式，與 OTT
              分段色階。紅外線從圖磚 Alpha 編碼還原近似亮溫，非原始 HSD
              輻射定標資料。
            </p>
            <h3>看清楚，不代表新增觀測細節</h3>
            <p>
              靜態放大自動換用更高層級：真實色最高 11,000 像素全圓盤，B13 最高
              5,500 像素。動畫預載接下來 3 張，使用較輕量的 4d
              圖磚以優先流暢播放；停止後補回細節。4K
              匯出是圖片尺寸，不把插值宣稱為更高的原生衛星解析度。
            </p>
            <h3>時間與圖層</h3>
            <p>
              所有畫面時間顯示臺灣時間。自動日夜依地圖中心與觀測時間判斷；邊界兩側仍可能同時有日夜。歷史圖磚可能過期或缺圖，會如實顯示失敗。JMA
              與系集圖層使用各自標示的最新發布時間。
            </p>
            <h3>風圈不是預報圓</h3>
            <p>
              黃色是烈風圈（30 節以上）；紅色是暴風圈（50
              節以上）。白色虛線圓是預報中心的機率範圍，紅色預報包絡為暴風警戒域，不表示整區當下都有暴風。
            </p>
            <p className="muted">
              本網站供觀測與研究，防災請以中央氣象署及當地官方警報為準。
            </p>
            <a
              href="https://himawari8.nict.go.jp/"
              target="_blank"
              rel="noreferrer"
            >
              NICT 衛星資料 ↗
            </a>{" "}
            ·{" "}
            <a
              href="https://data.ecmwf.int/forecasts/"
              target="_blank"
              rel="noreferrer"
            >
              ECMWF 開放資料 ↗
            </a>
          </article>
        </div>
      )}
    </main>
  );
}
function ModelPanel(p: any) {
  const [busy, setBusy] = useState<string[]>([]),
    [errors, setErrors] = useState<Record<string, string>>({});
  const configs = [
    { id: "ifs", label: "IFS ENS", color: "#61d8ee" },
    { id: "aifs", label: "AIFS ENS", color: "#ba9dff" },
    { id: "gefs", label: "GEFS", color: "#f3c775" },
    { id: "aigefs", label: "AIGEFS", color: "#e790bd" },
    { id: "cmce", label: "GEPS", color: "#7bde9a" },
    { id: "fens", label: "FNMOC ENS", color: "#9db1ec" },
    { id: "wnv3", label: "WeatherNext 3", color: "#ff91ab" },
    { id: "google", label: "WeatherNext Cyclones", color: "#8aafff" },
    { id: "fnv3", label: "FNV3P2", color: "#ffbe88" },
  ];
  async function load(id: string, enable = false) {
    if (busy.includes(id)) return;
    setBusy((b) => [...b, id]);
    setErrors((e) => ({ ...e, [id]: "" }));
    try {
      const r = await fetch(
          "/api/" +
            (["ifs", "aifs"].includes(id)
              ? "models"
              : ["wnv3", "google", "fnv3"].includes(id)
                ? "google"
                : "noaa") +
            "?model=" +
            id,
        ),
        d: any = await r.json();
      if (!r.ok) throw Error(d.error);
      p.setModels((all: any[]) => [...all.filter((m) => m.id !== id), d]);
      if (enable)
        p.setSelected((all: string[]) =>
          all.includes(id) ? all : [...all, id],
        );
    } catch (e) {
      setErrors((old) => ({
        ...old,
        [id]: e instanceof Error ? e.message : "讀取失敗",
      }));
    } finally {
      setBusy((b) => b.filter((x) => x !== id));
    }
  }
  useEffect(() => {
    load("ifs");
    load("aifs");
    const initial = setTimeout(
      () =>
        configs
          .filter((c) => !["ifs", "aifs"].includes(c.id))
          .forEach((c) => load(c.id)),
      5000,
    );
    const t = setInterval(() => {
      configs.forEach((c) => load(c.id));
    }, 1800000);
    return () => {
      clearInterval(t);
      clearTimeout(initial);
    };
  }, []);
  return (
    <>
      {configs.map((c) => {
        const m = p.models.find((m: any) => m.id === c.id);
        return (
          <div className="model-row" key={c.id}>
            <label className="toggle-row">
              <span>
                <i className="model-dot" style={{ background: c.color }} />
                <b>{c.label}</b>
                <small>
                  {["ifs", "aifs"].includes(c.id)
                    ? "ECMWF"
                    : c.id === "cmce"
                      ? "ECCC"
                      : ["wnv3", "google", "fnv3"].includes(c.id)
                        ? "GOOGLE"
                        : c.id === "fens"
                          ? "FNMOC"
                          : "NOAA"}
                </small>
              </span>
              <input
                aria-label={c.label + " 路徑"}
                type="checkbox"
                disabled={busy.includes(c.id)}
                checked={p.selected.includes(c.id)}
                onChange={(e) => {
                  if (!m) {
                    load(c.id, true);
                    return;
                  }
                  p.setSelected((a: string[]) =>
                    e.target.checked
                      ? [...a, c.id]
                      : a.filter((x) => x !== c.id),
                  );
                }}
              />
            </label>
            <div className="model-detail">
              {busy.includes(c.id) ? (
                "下載並解碼最新系集…"
              ) : m ? (
                <>
                  起報 {tw(m.run)} 臺灣時間
                  <br />
                  {m.memberCount} 成員 · {m.stormCount} 組氣旋 · 至 +{m.lead}h
                  {m.failedFiles > 0 && (
                    <>
                      <br />
                      缺少 {m.failedFiles} 份檔案（非完整系集）
                    </>
                  )}
                </>
              ) : (
                errors[c.id] || "準備取得最新系集"
              )}
              <button
                title={"重新載入 " + c.label}
                onClick={() => load(c.id, true)}
                disabled={busy.includes(c.id)}
              >
                <RefreshCw size={12} />
              </button>
            </div>
            {m && (
              <a
                className="model-source"
                href={m.source}
                target="_blank"
                rel="noreferrer"
              >
                原始資料 ↗
              </a>
            )}
          </div>
        );
      })}
      <p className="source-note">
        包含模式預測生成的氣旋；每 30 分鐘檢查新版。
      </p>
    </>
  );
}

function PointDetails({
  data: d,
  onClose,
}: {
  data: any;
  onClose: () => void;
}) {
  const p = d.point,
    s = d.spec,
    j = d.kind === "jma",
    date = j
      ? p.validtime?.UTC
      : new Date(new Date(d.run).getTime() + p.lead * 3600000).toISOString();
  const wind = j ? Number(s?.maximumWind?.sustained?.["m/s"]) : p.windMs,
    pressure = j ? Number(s?.pressure) : p.pressure / 100;
  const radii = j ? s?.stormWarning : p.radii;
  return (
    <article className="point-popup">
      <button
        className="icon-button close"
        onClick={onClose}
        title="關閉預報點"
      >
        <X size={16} />
      </button>
      <div className="eyebrow">{j ? "JMA 官方預報" : "系集成員預報"}</div>
      <h3>
        {d.name || "氣旋"} <small>{j ? "" : d.track.member}</small>
      </h3>
      <p className="point-time">
        {date ? tw(date) : "—"} 臺灣時間 · +{j ? p.advancedHours : p.lead}h
      </p>
      <div className="point-stats">
        <div>
          <span>中心氣壓</span>
          <b>
            {pressure > 0 ? Math.round(pressure) : "未提供"}
            <small>{pressure > 0 ? " hPa" : ""}</small>
          </b>
        </div>
        <div>
          <span>近中心最大風速</span>
          <b>
            {wind > 0 ? wind.toFixed(1) : "未提供"}
            <small>{wind > 0 ? " m/s" : ""}</small>
          </b>
        </div>
      </div>
      <dl>
        <dt>經緯度</dt>
        <dd>
          {(j ? p.center[0] : p.lat).toFixed(2)}°N /{" "}
          {(j ? p.center[1] : p.lon).toFixed(2)}°E
        </dd>
        <dt>來源</dt>
        <dd>{j ? "日本氣象廳（10 分鐘平均風）" : d.model}</dd>
        <dt>{j ? "發布時間" : "起報時間"}</dt>
        <dd>{(j ? d.issue : d.run) ? tw(j ? d.issue : d.run) : "—"} UTC+8</dd>
        {j && s?.maximumWind?.gust && (
          <>
            <dt>最大陣風</dt>
            <dd>{s.maximumWind.gust["m/s"]} m/s</dd>
          </>
        )}
      </dl>
      <h4>
        {j && p.advancedHours > 0
          ? "暴風警戒域半徑（含預報不確定性）"
          : "風圈半徑"}
      </h4>
      {j ? (
        radii?.length ? (
          radii.map((r: any, i: number) => (
            <p className="radius-row" key={i}>
              {typeof r.area === "string" ? r.area : r.area?.jp || "全域"}：
              {r.range.km} km
            </p>
          ))
        ) : (
          <p className="muted">來源未提供</p>
        )
      ) : radii?.length ? (
        radii.map((r: any, i: number) => (
          <p className="radius-row" key={i}>
            {Number.isFinite(r.thresholdKt) ? Math.round(r.thresholdKt) : "—"}{" "}
            節 · {r.orientation || "NEQ"}
            <span>
              {r.quadrantsKm
                .map((v: any) => (v == null ? "—" : Math.round(v)))
                .join(" / ")}{" "}
              km
            </span>
          </p>
        ))
      ) : (
        <p className="muted">此來源沒有風圈資料</p>
      )}
      {!j && (
        <p className="source-note">
          NEQ
          依序為東北／東南／西南／西北；其他方向以原始代碼為準。各機構風速平均期間不同，不宜直接混比。
        </p>
      )}
      {j && s?.galeWarning && (
        <p className="source-note">
          烈風圈：
          {s.galeWarning
            .map(
              (r: any) =>
                `${typeof r.area === "string" ? r.area : r.area?.jp} ${r.range.km} km`,
            )
            .join("；")}
        </p>
      )}
      <details>
        <summary>所有原始欄位</summary>
        <pre>
          {JSON.stringify(j ? { geometry: p, specifications: s } : p, null, 2)}
        </pre>
      </details>
    </article>
  );
}
