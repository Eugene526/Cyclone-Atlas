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
  { name: "衛星最大覆蓋範圍", box: [60, -70, 221, 70] },
  { name: "歐洲", box: [-15, 30, 40, 65] },
  { name: "北美洲", box: [-135, 10, -55, 65] },
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
      typeof window !== "undefined" && window.innerWidth > 1024,
    ),
    [info, setInfo] = useState(false),
    [models, setModels] = useState<any[]>([]),
    [selected, setSelected] = useState<string[]>([]),
    [modelStatus, setModelStatus] = useState("尚未載入"),
    [jmaStatus, setJmaStatus] = useState("讀取中"),
    [region, setRegion] = useState(0),
    [historyId, setHistoryId] = useState(""),
    [bounds, setBounds] = useState([120, 15, 155, 35]),
    [areaError, setAreaError] = useState("");
  const api = useRef<MapAPI | null>(null),
    liveRef = useRef(live);
  liveRef.current = live;
  const withinSatellite = Math.cos(center[1] * Math.PI / 180) * Math.cos((center[0] - 140.7) * Math.PI / 180) > 6378137 / 42164160;
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
      const defaultHistoryStorm = d.storms.find((storm: any) => {
        const analysis = storm.data?.find((point: any) => point.advancedHours === 0);
        return (analysis?.track?.preTyphoon?.length || 0) + (analysis?.track?.typhoon?.length || 0) > 1;
      }) || d.storms[0];
      setHistoryId((current) =>
        current && d.storms.some((storm: any) => storm.id === current)
          ? current
          : defaultHistoryStorm?.id || "",
      );
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
  const selectedHistory = storms.find((storm) => storm.id === historyId);
  const historyAnalysis = selectedHistory?.data?.find(
    (point: any) => point.advancedHours === 0,
  );
  const historyCoords: number[][] = [
    ...(historyAnalysis?.track?.preTyphoon || []),
    ...(historyAnalysis?.track?.typhoon || []),
  ].filter((coord, index, all) =>
    index === 0 || coord[0] !== all[index - 1][0] || coord[1] !== all[index - 1][1],
  );
  const historyTitle = selectedHistory?.data?.[0]?.name?.en || selectedHistory?.id;
  const historyModel = historyCoords.length > 1
    ? {
        id: "jma-current-history",
        label: `JMA 目前颱風已走路徑 · ${historyTitle}`,
        color: "#ffd16a",
        source: "https://www.jma.go.jp/bosai/map.html#contents=typhoon",
        run: historyAnalysis?.validtime?.UTC,
        tracks: [{
          name: historyTitle,
          member: "目前颱風已走路徑",
          points: historyCoords.map(([lat, lon], index) => ({ lat, lon, lead: index })),
        }],
      }
    : null;
  const displayedModels = [
    ...models
      .filter((m) => selected.includes(m.id))
      .map((m) => ({ ...m, color: ({ ifs: "#61d8ee", aifs: "#ba9dff", gefs: "#f3c775", aigefs: "#e790bd", cmce: "#7bde9a", fens: "#9db1ec", wnv3: "#ff91ab", google: "#8aafff", fnv3: "#ffbe88", gfs: "#40d8ff", ecmwf: "#ffad42" } as Record<string, string>)[m.id] })),
    ...(historyModel ? [historyModel] : []),
  ];
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
          models={displayedModels}
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
          <h1>{withinSatellite ? "西太平洋・全域觀測" : "全球地圖・自由瀏覽"}</h1>
          <p>
            {time ? `衛星觀測 ${new Date(new Date(time).getTime() + 8 * 3600000).getUTCFullYear()}/${tw(time)} · UTC+8（臺灣）` : "取得最新觀測中"} <span>｜</span>{" "}
            {effective === "ott"
              ? "紅外線色調強化"
              : effective === "rgb"
                ? "真實色合成"
                : "黑白紅外線"}
          </p>
        </div>
        {!withinSatellite && <div className="coverage-note">地圖中心位於向日葵衛星觀測範圍外；此區顯示底圖，不延展或補造雲圖。</div>}
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
            title="下載雲圖"
            onClick={() => {
              setStatus("準備下載雲圖，等待圖磚完成…");
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
        {(
          <aside className="sidebar" style={{display: panel ? undefined : "none"}}>
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
                        if (a) setPointInfo({kind: "jma", name: title?.name?.en, point: a, spec: st.specifications?.find((v: any) => v.validtime?.UTC === a.validtime?.UTC), issue: title?.issue?.UTC});
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
            <section className="history-section">
              <details>
                <summary className="section-label">
                  03 <span>目前颱風已走路徑</span>
                  <span className="count">JMA</span>
                </summary>
                <p className="source-note">顯示目前仍在追蹤的颱風，自生成至最新分析位置的已走路徑；不載入往年颱風。路徑節點沒有逐點時間與強度資料。</p>
                <select aria-label="選擇目前颱風已走路徑" value={historyId} onChange={(e) => setHistoryId(e.target.value)}>
                  {storms.length === 0 && <option value="">目前沒有可用颱風</option>}
                  {storms.map((storm) => <option key={storm.id} value={storm.id}>{storm.data?.[0]?.name?.en || storm.id} · {storm.id}</option>)}
                </select>
                {historyModel && <p className="source-note">已顯示 {historyTitle} 的 {historyCoords.length} 個歷史位置，終點為 JMA 最新分析位置。</p>}
                {!historyModel && storms.length > 0 && <p className="source-note">JMA 尚未提供這個颱風的已走路徑節點。</p>}
              </details>
            </section>
            <section>
              <div className="section-label">
                04 <span>系集路徑</span>
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
                系集模式以彩色線呈現成員路徑；GFS 與 ECMWF IFS HRES 顯示確定性路徑。點選路徑可看預報點。不同模式起報時間可能不同。
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
              靜態放大自動換用較高層級圖磚；動畫預載接下來 3 張，使用較輕量的
              圖磚以優先流暢播放；停止後補回細節。下載尺寸取決於目前地圖與圖磚，
              不會以插值假稱新增衛星觀測細節。
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
    { id: "gfs", label: "GFS", color: "#40d8ff" },
    { id: "ecmwf", label: "ECMWF IFS HRES 傳統模式", color: "#ffad42" },
    { id: "ifs", label: "ECMWF IFS 系集", color: "#61d8ee" },
    { id: "aifs", label: "ECMWF AIFS 系集", color: "#ba9dff" },
    { id: "gefs", label: "GEFS", color: "#b9ad91" },
    { id: "aigefs", label: "AIGEFS", color: "#b49ba9" },
    { id: "cmce", label: "GEPS", color: "#94b29f" },
    { id: "fens", label: "FNMOC ENS", color: "#9ba9bc" },
    { id: "wnv3", label: "WeatherNext 3", color: "#b99ca5" },
    { id: "google", label: "WeatherNext Cyclones", color: "#95a9bf" },
    { id: "fnv3", label: "FNV3P2", color: "#bbaa97" },
  ];
  const ecmwfEnsIds = ["ifs", "aifs"];
  const ecmwfEnsReady = ecmwfEnsIds.filter((id) =>
    p.models.some((m: any) => m.id === id),
  ).length;
  const toggleEcmwfEns = () => {
    const allOn = ecmwfEnsIds.every((id) => p.selected.includes(id));
    if (allOn) {
      p.setSelected((all: string[]) => all.filter((id) => !ecmwfEnsIds.includes(id)));
      return;
    }
    ecmwfEnsIds.forEach((id) => load(id, true));
    p.setSelected((all: string[]) => [...new Set([...all, ...ecmwfEnsIds])]);
  };
  async function load(id: string, enable = false) {
    if (busy.includes(id)) return;
    setBusy((b) => [...b, id]);
    setErrors((e) => ({ ...e, [id]: "" }));
    try {
      const r = await fetch(
          "/api/" +
            (["ifs", "aifs"].includes(id)
              ? "models"
              : ["gfs", "ecmwf"].includes(id)
                ? "deterministic"
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
    load("gfs");
    load("ecmwf");
    const initial = setTimeout(
      () =>
        configs
          .filter((c) => !["ifs", "aifs", "gfs", "ecmwf"].includes(c.id))
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
      <section className="ecmwf-ensemble" aria-label="ECMWF 系集預測">
        <div className="ecmwf-ensemble-heading">
          <div>
            <b>ECMWF 系集預測</b>
            <small>IFS 動力系集＋AIFS 人工智慧系集</small>
          </div>
          <button type="button" onClick={toggleEcmwfEns}>
            {ecmwfEnsIds.every((id) => p.selected.includes(id)) ? "全部隱藏" : "全部顯示"}
          </button>
        </div>
        <div className="ecmwf-ensemble-status">
          {ecmwfEnsReady === 2
            ? "兩套系集資料已載入；點選路徑上的預報點可查看時間、位置、風速、氣壓與風圈。"
            : `正在取得 ECMWF 系集資料（${ecmwfEnsReady}/2 已載入）…`}
        </div>
      </section>
      {configs.map((c) => {
        const m = p.models.find((m: any) => m.id === c.id);
        return (
          <div className="model-row" key={c.id}>
            <label className="toggle-row">
              <span>
                <i className="model-dot" style={{ background: c.color }} />
                <b>{c.label}</b>
                <small>
                  {["ifs", "aifs", "ecmwf"].includes(c.id)
                    ? "ECMWF"
                    : c.id === "gfs"
                      ? "NOAA"
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
    h = d.modelId === "jma-history",
    currentHistory = d.modelId === "jma-current-history",
    date = h
      ? p.time
      : currentHistory
      ? null
      : j
      ? p.validtime?.UTC
      : new Date(new Date(d.run).getTime() + p.lead * 3600000).toISOString();
  const wind = j ? Number(s?.maximumWind?.sustained?.["m/s"]) : p.windMs,
    pressure = j ? Number(s?.pressure) : Number.isFinite(p.pressure) ? p.pressure / 100 : 0;
  const radii = j ? s?.stormWarning : p.radii;
  const popup = d.popupPosition;
  const popupWidth = popup ? Math.min(popup.width <= 720 ? 260 : 350, popup.width - 20) : undefined;
  const popupMaxHeight = popup
    ? Math.min(popup.height - 16, popup.width <= 720 ? Math.max(170, popup.height * 0.28) : popup.height * 0.6)
    : undefined;
  const popupLeft = popup && popupWidth
    ? Math.max(8, Math.min(popup.x < popup.width * 0.55 ? popup.x + 14 : popup.x - popupWidth - 14, popup.width - popupWidth - 8))
    : undefined;
  const popupTop = popup && popupMaxHeight
    ? Math.max(8, Math.min(popup.y - Math.min(popupMaxHeight * 0.48, 190), popup.height - popupMaxHeight - 8))
    : undefined;
  return (
    <article
      className={`point-popup${popup ? " point-popup-anchored" : ""}${popup?.width <= 720 ? " point-popup-mobile" : ""}`}
      style={popup ? { left: popupLeft, top: popupTop, width: popupWidth, maxHeight: popupMaxHeight } : undefined}
    >
      <button
        className="icon-button close"
        onClick={onClose}
        title="關閉預報點"
      >
        <X size={16} />
      </button>
      <div className="eyebrow">{currentHistory ? "目前颱風已走路徑" : h ? "JMA 歷史最佳路徑" : j ? "JMA 官方預報" : "模式預報路徑"}</div>
      <h3>
        {d.name || "氣旋"} <small>{j || h ? "" : d.track.member}</small>
      </h3>
      <p className="point-time">
        {currentHistory ? "此歷史節點沒有逐點時間資料" : date ? tw(date) : "—"} {currentHistory ? "" : `臺灣時間 UTC+8 ${h ? "· 歷史分析時間" : `· +${j ? p.advancedHours : p.lead}h`}`}
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
        <dd>{h ? "日本氣象廳 RSMC 最佳路徑" : j ? "日本氣象廳官方資料" : d.model}</dd>
        <dt>{currentHistory ? "最新分析基準" : j ? "發布時間" : "起報時間"}</dt>
        <dd>{h ? "歷史最佳路徑分析" : (j ? d.issue : d.run) ? tw(j ? d.issue : d.run) : "—"} {h ? "" : "UTC+8"}</dd>
        {j && s?.maximumWind?.gust && (
          <>
            <dt>最大陣風</dt>
            <dd>{s.maximumWind.gust["m/s"]} m/s</dd>
          </>
        )}
      </dl>
      <h4>
        {currentHistory
          ? "歷史節點資料"
          : h
          ? "最佳路徑風圈記錄"
          : j && p.advancedHours > 0
          ? "暴風警戒域半徑（含預報不確定性）"
          : "風圈半徑"}
      </h4>
      {currentHistory ? (
        <p className="source-note">此線是目前仍在追蹤的颱風從較早位置到最新分析位置的移動路徑。JMA 此資料未提供各節點各自的時間、風速、氣壓或風圈，因此不會以預報值代填。</p>
      ) : h ? (
        <>
          {p.radius50 ? <p className="radius-row">50 節風圈：最長半徑 {Math.round(p.radius50.longestKm)} km · 最短半徑 {Math.round(p.radius50.shortestKm)} km</p> : <p className="muted">該時次未提供 50 節風圈資料</p>}
          {p.radius30 && <p className="radius-row">30 節風圈：最長半徑 {Math.round(p.radius30.longestKm)} km · 最短半徑 {Math.round(p.radius30.shortestKm)} km</p>}
          <p className="source-note">最佳路徑是事後分析資料，不是即時預報。最大／最小半徑依 JMA 最佳路徑欄位。</p>
        </>
      ) : j ? (
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
      {!j && !h && !currentHistory && (
        <p className="source-note">
          此處為該模式的預測，不是日本氣象廳官方預報。NEQ
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
