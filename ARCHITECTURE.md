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

Vercel Functions (api/)     ← Codex 負責
 └─ /api/chat   SSE；驗證 JWT → 速率限制 → tools(RLS) + RAG(pgvector) → OpenAI → 來源引用

Supabase
 ├─ Postgres + RLS（supabase/migrations）
 ├─ Auth（Email + 密碼）
 └─ pgvector（knowledge_chunks）
```

## 兩種執行模式
| | 本機模式 | 雲端模式 |
|---|---|---|
| 觸發 | 未設定 `VITE_SUPABASE_URL` | 已設定 Supabase 環境變數 |
| 登入 | 不需要 | Supabase Auth |
| 資料 | 此瀏覽器 localStorage | Postgres，RLS 隔離 |
| AI 助理 | `localEngine.ts`（規則式，不需 API Key） | `/api/chat`；回 503/404 時自動退回本機助理 |
| 活動 | 不顯示（無可信來源） | `campus_events` 中 `status='published'` |

## 重要決策
- **App 版面**：產品定位為手機 App，所有尺寸使用同一個手機版面（最大 480px 置中），不提供桌面 Sidebar（取代原需求中的桌面 Sidebar，開發者 2026-10-12 決定）。
- **Repository 抽象**：UI 不直接呼叫 Supabase（活動、收藏、回饋除外），方便測試與兩種模式切換。
- **課表資料模型**：`user_courses`（個人課程）＋ `schedule_entries`（時段）。`courses` 為管理員維護的課程目錄，預留未來對應。
- **semesters**：`user_id IS NULL` 為共用學期（管理員），否則為個人學期。
- **不使用校務系統帳密**：課表只能手動輸入或 CSV 匯入。
- **地圖**：Leaflet + OpenStreetMap。只標記座標已查核的地點（目前僅校園中心）；導航用 Google Maps 名稱搜尋連結，不捏造座標。
- **提醒**：MVP 以 `.ics` 行事曆檔（含 VALARM）實作「加入提醒」，可跨裝置使用；Web Push 列入 Roadmap。
- **CSV 安全**：匯出時中和公式注入（`=`,`+`,`-`,`@` 開頭加 `'`），匯入在本機解析、限制 512KB。

## /api/chat 合約（前端已實作呼叫端：`src/features/ai/useChat.ts`）
見 `api/README.md`。

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
