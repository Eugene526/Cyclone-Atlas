# 颱風觀測站 · Cyclone Atlas

向日葵衛星與西北太平洋颱風觀測工作台。繁體中文；所有介面時間為臺灣 UTC+8。

## 啟動

```sh
npm ci
npm run dev
```

`npm run build` 產生 Sites / Cloudflare Worker 部署檔。既有 `.openai/hosting.json` 綁定本網站，勿重新建立另一個 Site。

## 真正的即時來源

- NICT Himawari-9：D531106 真實色、FULL_24h/B13 紅外線；每分鐘查詢 latest.json。每張原始觀測約 10 分鐘。歷史留存依來源，並非無限歷史庫。
- 日本氣象廳：targetTc.json、forecast.json、specifications.json；最新官方分析與預報。歷史衛星時刻不冒充歷史 JMA 分析。
- ECMWF IFS ENS / AIFS ENS：ECMWF 公開 GCP 鏡像，BUFR4 tropical cyclone tracks。
- 全球風場直接讀取模式／機構發布的原始 GRIB2 或原始 Zarr 格點，不經 Open-Meteo 或其他聚合氣象 API：NOAA GFS、ECMWF IFS、ECMWF AIFS Single、NOAA GEFS、NOAA AIGEFS、ECCC GEPS、DWD ICON、JMA GSM，以及 Google 公開 ARCO-ERA5 Zarr 再分析。GRIB/Zarr 原始欄位在瀏覽器端解碼；只轉換向量格點以供繪圖，標註的原生格距不會因放大或插值而變高。
- IFS/AIFS ENS 風場平均與 WeatherNext 2 暫不提供選取：目前未有本網站已驗證、公開免登入的完整原始 u/v 格點管線；WeatherNext 2 原始 Zarr 需 Google 核准。先前 Open-Meteo 的逐點 API 管線已停用，缺少原始來源時不做代替或靜默切換。
- NOAA GEFS / AIGEFS、ECCC GEPS、FNMOC ENS：NOAA NOMADS ens_tracker 的各成員 ATCF 檔。
- Google WeatherNext 3（下載代碼 WNV3）、WeatherNext Cyclones（OPER）、FNV3P2：Weather Lab 公開下載端點。不是把其他模式重新命名成 Google。研究性質與資料使用條款：https://developers.google.com/weathernext/guides/weatherlab

模式每 30 分鐘更新；每個來源顯示自己的起報時刻、實際讀取成員數、缺檔數。網站不表示已涵蓋世界上所有模式。UKMO/JMA 等未接到公開即時完整系集來源者，不偽造路徑。

## 衛星效能與幾何

- 全幅圖磚依衛星地球同步投影重投影至 Web Mercator，不把圓盤圖拉伸成經緯度矩形。
- 先載低解析概覽，再補高解析圖磚；HTTP 快取、解碼 Blob 快取、影格來源 LRU。
- 動畫使用輕量 4d 圖磚，提前載入下一至三張；每張等載入完成才前進，短暫淡入淡出，停止後補回高解析。
- 視野限制避免拖到空白世界；西北太平洋到 180°E，保留實際觀測範圍，沒有補造衛星看不到的區域。
- 無需 API key 的本地 Natural Earth 陸地與白色海岸線，不遮蓋或移除第三方浮水印，而是完全替換原底圖。
- 4K 匯出為 3840×2160 排版尺寸，不等於原始衛星新增解析度。

## 調色

使用提供資料夾 h-8.py 的 B13 Alpha→近似亮溫及分段 OTT 色階：−90°C 白、−80°C 黑、−68°C 紅、−56°C 黃、−44°C 綠、−32°C 藍、−20°C 淺藍，暖端灰黑。它是圖磚編碼的近似還原，非 Level-1 HSD 精確輻射定標。自動日夜採地圖中心與觀測時間的太陽高度近似，不能代表整張跨日夜地圖都處於同一光照。

## 點選詳情

點選 JMA 白點，或系集線上的位置；系集會高亮該成員並顯示每個預報點。面板提供有效時間、起報/發布時間、成員、座標、中心氣壓、風速、風圈（若來源有提供）和原始欄位。跨日界線的路徑在西太平洋側展開，避免橫跨整張地圖的假直線。

- 壓力統一內部 Pa，顯示 hPa。
- ATCF 風速 kt→m/s；風圈海浬→km。
- JMA 預報暴風警戒域包含位置不確定性，**不**當成實際暴風圈半徑。
- ECMWF BUFR 窄模板解碼只接受 316082 及 001030+316082，未知格式失敗封閉。

## 驗證

```sh
npx tsc --noEmit
npm run build
node tests/data-check.mjs /path/to/ecmwf-tf.bufr
```

解碼器以 Python ecCodes 逐值比對：AIFS 53 訊息、562,494 個數值；IFS 30 訊息、127,092 個數值均一致（初始座標/壓力/風速/時間/成員欄位）。測試包含截斷與非 BUFR 輸入拒絕。來源改版應重新比對，勿靜默容忍。

## 資料夾使用方式

參考「颱風衛星圖 來源：雞蛋糕」所有 Python 程式的取圖、雲圖合成、OTT、晝夜選擇與動畫流程；沿用提供的 Natural Earth 海岸線。MP4/PNG 是視覺參考，未把 54 GB 影片/地形資料全部上傳網站；arial.ttf 未重新發布。舊 ty_track.txt 不是最新預報，不混入即時模式。衛星原始資料不經生成式 AI 重繪。

© ECMWF（CC BY 4.0，https://doi.org/10.21957/open-data）；NICT/JMA；NOAA/ECCC/FNMOC；Google Weather Lab；Natural Earth（public domain）。研究觀測工具，不取代官方防災警報。

### 2026-10-04 更新
- 全球地圖自由移動；歐洲／北美快捷範圍。向日葵不可觀測區保留底圖，不延展雲圖。
- 衛星最大範圍延至東經 221°；原始 GEOS 圖磚與地球橢球遮罩保留有效觀測。
- 系集路徑逐點解纏經度，消除跨 180° 橫線；未選中線寬 0.8px、22% 不透明度、低飽和色。
- 官方颱風卡可直接開啟日本氣象廳詳細資料；官方資料與模式預測分別標示。
- 顯著標示衛星觀測年月日時間 UTC+8；側欄收起仍持續更新模式。
- OTT 靜態縮放最高使用來源 10d B13（全圓盤 5500px），不是人工超解析度。


### 確定性模式與路徑選取
- 新增 NOAA GFS 確定性熱帶氣旋追蹤路徑，讀取 NCEP `ens_tracker/prod/gfs.../tctrack/avnop...` ATCF 輸出；網頁標示 GFS，不改動源資料中的 AVNO 代碼。
- 新增 ECMWF IFS HRES 確定性颱風路徑資料選項，依官方 Open Data BUFR trajectory 命名規格查詢；該次未提供時會顯示資料未取得，絕不以系集路徑冒充 HRES。
- 關閉一個模式會同時移除其突出選取路徑、沿線預報點與資訊卡；點選另一個風暴標記也會清除舊選取。系集線條已恢復原本較鮮明的顏色與線寬。
