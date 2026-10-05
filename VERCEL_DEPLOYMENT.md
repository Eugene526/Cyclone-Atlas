# Cyclone Atlas — Vercel 部署

完整網站原始碼已保留，包括衛星頁、全球風場、JMA 路徑與風圈、解碼 Worker、商標和測試。

## 匯入設定

1. 在 Vercel 選擇 Add New → Project，匯入 Eugene526/Cyclone-Atlas。
2. Framework Preset：Next.js。
3. Node.js：22.x 或符合 package.json engines 的版本。
4. Install Command：npm ci。
5. Build Command：npm run build:vercel（vercel.json 已指定）。
6. Output Directory：使用 Next.js 預設值，不填 dist。
7. 公開衛星、JMA 與已接入公開風場資料不需要 API 金鑰。

本地測試：npm ci && npm run build:vercel && npm run start:vercel。
原有 Sites/Cloudflare 建置命令 npm run build 亦保留；不要把它設成 Vercel 的 Build Command。

## 已做的相容性處理

- Vercel 使用標準 Next.js/Webpack 建置，而非 Cloudflare Worker 輸出。
- 六種原始風場解碼器使用標準 module Worker URL，保留原始來源和解碼逻輯。
- ecCodes 動態模組載入由瀏覽器處理，避免 Webpack 重寫 Blob URL。
- 公開靜態資料、WASM、商標與地圖底圖均包含在 public 中。

## 驗證與限制

已在本地完成 Next.js 正式建置與現有自動測試。尚未建立或部署 Vercel 專案；實際雲端部署後仍需驗證各資料來源網路可達性、平台函式執行時間、頻寬和瀏覽器動畫。公開資料來源可能限流或暫時缺資料；Vercel 本身的資源限制不會因原始資料免費而消失。


### 天氣圖原始資料處理

新增 `/weather` 與 `/api/weather`。請使用 **Node.js 24.x**（`package.json` 已設定）。原始 GRIB 在伺服器驗證與解碼，再傳送壓縮格點，因此手機不需要支援 Memory64；ERA5 的原始 Zarr 區塊使用瀏覽器 worker 解壓。函式最長執行時間設定為 120 秒，仍依 Vercel 方案上限；首次讀取完整系集或 ICON 可能較久。

`next.config.ts` 已將原始解碼器及 ICON 索引納入函式檔案追蹤。ChatGPT Sites 版本的天氣圖 API 透過固定的 Vercel 天氣圖端點取得相同原始資料處理结果，避免在邊緣環境使用 Node 檔案系統；原有衛星與風場管線保持不變。
