# Architecture

```
Browser (React SPA, PWA)
 ├─ src/app            Providers: Theme / Auth(+Repository) / Semester, router
 ├─ src/features/*     Pages: dashboard, schedule, tasks, ai, explore, events, profile, auth
 ├─ src/lib            Pure domain logic (schedule, tasks, csv, ics, periods, time) + data layer
 │   └─ data/          DataRepository interface
 │        ├─ local.ts        本機模式（localStorage）
 │        └─ supabaseRepo.ts 雲端模式（Supabase + RLS）
 └─ src/data           已查核的靜態資料（建築代碼、官方連結）＋查核狀態

Vercel Functions (api/)     ← 不使用 AI／翻譯 API
 ├─ /api/push, /api/push-reminders   Web Push 提醒（pg_cron 每分鐘）
 ├─ /api/sync-events                 每日同步校園活動（Vercel Cron）
 └─ /api/widget                      iPhone 小工具資料

On device（不上傳、不需金鑰）
 ├─ AI 助理      src/features/ai/localEngine.ts（規則式）
 ├─ 課表截圖辨識  src/lib/ocr/（Tesseract.js WASM，public/ocr/）
 └─ 介面翻譯      src/i18n/locales（繁中／简中／English）＋ src/i18n/packs（其他語言，預先翻譯）

Supabase
 ├─ Postgres + RLS（supabase/migrations）
 ├─ Auth（Email + 密碼）
 └─ pgvector（knowledge_chunks，目前未使用）
```

## 兩種執行模式
| | 本機模式 | 雲端模式 |
|---|---|---|
| 觸發 | 未設定 `VITE_SUPABASE_URL` | 已設定 Supabase 環境變數 |
| 登入 | 不需要 | Supabase Auth |
| 資料 | 此瀏覽器 localStorage | Postgres，RLS 隔離 |
| AI 助理 | `localEngine.ts`（規則式，不需 API Key） | 同左（不使用雲端 AI） |
| 活動 | 不顯示（無可信來源） | `campus_events` 中 `status='published'` |

## 重要決策
- **App 版面**：產品定位為手機 App，所有尺寸使用同一個手機版面（最大 480px 置中），不提供桌面 Sidebar（取代原需求中的桌面 Sidebar，開發者 2026-10-12 決定）。
- **Repository 抽象**：UI 不直接呼叫 Supabase（活動、收藏、回饋除外），方便測試與兩種模式切換。
- **課表資料模型**：`user_courses`（個人課程）＋ `schedule_entries`（時段）。`courses` 為管理員維護的課程目錄，預留未來對應。
- **semesters**：`user_id IS NULL` 為共用學期（管理員），否則為個人學期。
- **不使用校務系統帳密**：課表手動輸入、CSV 匯入，或在手機上辨識選課系統課表截圖。
- **不使用付費 API**（2026-10-26，學校合作未成、開發者不自付費用）：助理、截圖辨識、翻譯都在裝置上完成。
- **地圖**：Leaflet + OpenStreetMap。只標記座標已查核的地點（目前僅校園中心）；導航用 Google Maps 名稱搜尋連結，不捏造座標。
- **提醒**：MVP 以 `.ics` 行事曆檔（含 VALARM）實作「加入提醒」，可跨裝置使用；Web Push 列入 Roadmap。
- **CSV 安全**：匯出時中和公式注入（`=`,`+`,`-`,`@` 開頭加 `'`），匯入在本機解析、限制 512KB。


## 首頁像素場景（淡江大橋）
```
weatherService.ts ──fetch Open-Meteo (8s timeout, cache last valid)──▶ useCampusWeather (20 min refresh, offline/stale)
                                                                          │
lib/solar.ts (offline sunrise/sunset) ──▶ useTimeOfDay ───────────────────┤
                                                                          ▼
                                          SceneController.buildScene → SceneState {phase, weather, kind, rain, clouds, lights}
                                                                          ▼
                                          PixelCampusScene (Canvas 2D, ~200×180 art px, integer device-pixel scale)
                                            layers: PixelSky · PixelClouds · PixelRiver · PixelBridge · PixelTerrain · PixelRain · PixelLighting
```
- **像素渲染**：真正的低解析度 Canvas（約 200×180 art px），以整數倍裝置像素放大（`image-rendering: pixelated`），天空與草地用 Bayer 4×4 ordered dithering，限制色盤。不使用照片或濾鏡。
- **靜態層快取**：天空、對岸（觀音山、八里市街）、河面底色、大橋與前景存為三張離屏 Canvas，只有時段/天氣/燈光改變時重畫；每幀只畫雲、水面閃光與倒影、雨滴、漣漪、鳥、樹搖、燈光。
- **效能**：15 fps（Save-Data 時 8 fps）、`requestAnimationFrame`、IntersectionObserver（離開畫面暫停）、Page Visibility（背景暫停）、`prefers-reduced-motion` 改為靜態畫面。
- **場景切換**：調色盤 2.5 秒平滑過渡（smoothstep），不閃爍。
- **天氣**：Open-Meteo（免費、免金鑰），座標使用淡江校園中心 25.175, 121.449（需求文件建議的 25.174, 121.443 在同一網格）。失敗時顯示最後有效資料並標示「天氣資料未更新」，從未取得時顯示「暫時無法取得天氣」，不顯示虛構溫度。
- **預覽參數**：`/?scene=night,rainy`（sunrise 等時段：dawn/morning/noon/afternoon/dusk/night；天氣：sunny/cloudy/rainy/fog；sunset）只改畫面，不改真實資料。
- **淡江大橋造型依據**（2026-10-12 查核）：單塔不對稱斜張橋、主塔 211 m、主跨 450 m、側跨 175 m、半扇形鋼索、主塔偏淡水側、2026-05-12 通車。**待查核**：塔身輪廓與單/雙索面，目前畫成漸縮單柱＋中央單索面。

## 多語系（i18n）
- i18next＋react-i18next。字典在 `src/i18n/locales/zh-TW.ts` 與 `en.ts`；**新增文字時兩個檔案都要加同一個 key**（`src/i18n/__tests__/locales.test.ts` 會檢查兩邊 key、`{{佔位符}}` 一致，且英文不得含中文）。
- 元件內用 `t()`（`src/i18n/t.ts`）；週一~週日、作業類型、活動分類等對照表（`src/lib/labels.ts`）在讀取時即時翻譯。
- 切換語言時 `LanguageRoot` 會重新掛載整個介面（資料快取保留），所以元件不需各自訂閱語言變化。
- 保留中文的內容：建築名稱、官方文件標題（英文介面另附英文說明）、CSV 檔案格式與範本、使用者自己輸入的資料。
- 本機 AI 助理同時理解中英文問題，依目前介面語言回答。

## 提醒
- `src/services/reminders.ts`（純函式 `remindersBetween`）＋ `useReminderScheduler`（每 30 秒檢查，掛在 AppShell）。透過 Service Worker `showNotification`（Android 必要）或 `Notification` 顯示；已發送紀錄存 localStorage 避免重複；錯過超過 5 分鐘不補發。
- 只在 App 執行中（含背景）有效；關閉 App 後的推播需伺服器端 Web Push（Roadmap）。

## 安全標頭（vercel.json）
CSP：`script-src 'self'`（無 inline script；主題初始化移到 `public/theme-init.js`）、`style-src` 允許 inline（Leaflet 與 React style 屬性需要）、`connect-src` 只允許 Open-Meteo 與 Supabase、`img-src` 允許 OSM 圖磚、`frame-ancestors 'none'`；另有 HSTS、COOP、X-Frame-Options、Permissions-Policy。`e2e/csp.spec.ts` 以相同標頭載入頁面並確認沒有 CSP 違規。新增外部服務時記得更新 CSP。
