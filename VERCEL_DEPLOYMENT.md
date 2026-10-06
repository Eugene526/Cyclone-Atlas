# Cyclone Atlas — Vercel 部署

完整網站原始碼已保留，包括衛星頁、全球風場、JMA 路徑與風圈、解碼 Worker、商標和測試。

## 匯入設定

1. 在 Vercel 選擇 Add New → Project，匯入 Eugene526/Cyclone-Atlas。
2. Framework Preset：Next.js。
3. Node.js：24.x（與 package.json engines 一致）。
4. Install Command：npm ci。
5. Build Command：npm run build:vercel（vercel.json 已指定）。
6. Output Directory：使用 Next.js 預設值，不填 dist。
7. 公開衛星、日本雷達、JMA 路徑與已接入公開風場資料不需要 API 金鑰；臺灣雷達需要下方的 CWA_API_KEY。

本地測試：npm ci && npm run build:vercel && npm run start:vercel。
原有 Sites/Cloudflare 建置命令 npm run build 亦保留；不要把它設成 Vercel 的 Build Command。

## 已做的相容性處理

- Vercel 使用標準 Next.js/Webpack 建置，而非 Cloudflare Worker 輸出。
- 六種原始風場解碼器使用標準 module Worker URL，保留原始來源和解碼逻輯。
- ecCodes 動態模組載入由瀏覽器處理，避免 Webpack 重寫 Blob URL。
- 公開靜態資料、WASM、商標與地圖底圖均包含在 public 中。

## 驗證與限制

已在本地完成 Next.js 正式建置與現有自動測試。目前正式站已部署至 https://cyclone-atlas-one.vercel.app ，並驗證日本雷達圖磚與臺灣雷達原始格點可取得。自行部署時仍需確認資料來源網路可達性與方案資源上限。公開資料來源可能限流或暫時缺資料；Vercel 本身的資源限制不會因原始資料免費而消失。


### 天氣圖原始資料處理

新增 `/weather` 與 `/api/weather`。請使用 **Node.js 24.x**（`package.json` 已設定）。原始 GRIB 在伺服器驗證與解碼，再傳送壓縮格點，因此手機不需要支援 Memory64；ERA5 的原始 Zarr 區塊使用瀏覽器 worker 解壓。函式最長執行時間設定為 120 秒，仍依 Vercel 方案上限；首次讀取完整系集或 ICON 可能較久。

`next.config.ts` 已將原始解碼器及 ICON 索引納入函式檔案追蹤。ChatGPT Sites 版本的天氣圖 API 透過固定的 Vercel 天氣圖端點取得相同原始資料處理结果，避免在邊緣環境使用 Node 檔案系統；原有衛星與風場管線保持不變。

## 臺灣雷達環境變數

在 Vercel 專案的 Settings → Environment Variables 新增：

| 名稱 | 值 | 環境 |
| --- | --- | --- |
| `CWA_API_KEY` | 自己的中央氣象署氣象資料開放平臺會員授權碼 | Production；需要分支預覽時也勾選 Preview |

儲存後重新部署，新的部署才會使用設定。現有正式站與預覽環境已配置，不必重填。另建 Vercel 專案時需要自行設定；GitHub 不會包含授權碼。

此變數僅供伺服器呼叫中央氣象署原始雷達資料，不要加上 `NEXT_PUBLIC_` 前綴，也不要把真實授權碼提交至儲存庫。

本地開發：複製 `.env.example` 為 `.env.local`，填入自己的授權碼並重新啟動。日本雷達不需額外環境變數。
