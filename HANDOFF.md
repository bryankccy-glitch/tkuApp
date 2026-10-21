# TKU Campus OS — Development Handoff

## Last Updated
2026-10-19（Asia/Taipei, UTC+8）

## Updated By
Claude Code（main）

## Current Status
收尾狀態（2026-10-19）：main 為正式版（Vercel 自動部署）。iOS 主畫面 App：滿版天氣、AI 助理收鍵盤自動恢復高度、啟動畫面依 App 外觀單色、自動更新、登入確認不會無限等待；校園活動已匯入 48 筆（快照，不自動更新）；桌面小工具（Scriptable 版）已上線待實機確認。lint、typecheck、138 單元、132 E2E 皆通過。

## Completed
- 專案骨架：Vite 6 + React 18 + TS strict + Tailwind 3 + React Router 6 + TanStack Query 5 + RHF + Zod + PWA
- Design System：tokens（主題色 `primary` = 宮燈紅 #A84643）、深色模式、字級、**開發者提供的正式標誌**（App Icon、Favicon、介面 Logo、Splash）、Loading、空狀態插畫、宮燈拱廊帶
- **App 版面**：所有螢幕只用手機版面（最大 480px 置中）＋底部 5 格導覽；已移除桌面 Sidebar；skip link、focus 樣式
- 資料層：`DataRepository` ＋ `LocalRepository` ＋ `SupabaseRepository`
- 首頁、課表（CRUD/節次/衝突/週檢視/學期/CSV/詳情）、作業考試、校園探索、活動、AI 助理 UI（本機引擎）、我的、登入/註冊、**忘記密碼與重設密碼**、關於與隱私
- Supabase migration（16 核心表＋ai_usage、RLS、觸發器、函式）與開發 seed
- 預覽版建置 `npm run build:preview`（範例資料、hash routing）
- 測試：Vitest 單元＋元件測試 39 項；Playwright E2E 36 項（桌面＋手機）

## Latest Changes
- **部署失敗修正 — Claude Code（2026-10-21）**：`d6c1d04`、`f7abdc4`、`0f5b4c5` 三次部署都失敗：Vercel Hobby 方案每次部署最多 12 個 Serverless Functions，而 `api/` 底下每個 .ts（含 helper 與 *.test.ts）都被當成一個 function（共 16 個）。改為共用程式放 `api/_lib/`（chat-schema、gemini、sse、store）、測試放 `api/_tests/`，底線開頭資料夾不會部署成 function；現在只有 6 個 function。`scripts/ingest.ts`、`api/README.md` 已更新路徑。
- **建築位置、夜間節次、多語言、好友通知 — Claude Code（2026-10-20）**：(1) 校園建築座標：取自 OpenStreetMap（使用者電腦上的瀏覽器查 Overpass，建物輪廓中心點），29 個代碼全部有座標並附 OSM way 編號（`src/data/places.ts` `OSM` 表、`coordsSource`）；宮燈教室取 6 棟平均、松濤館標 1 館、司令台取校內操場旁；T 驚聲紀念大樓名稱已依 OSM 核對；地圖現在會顯示標記。(2) 第 13、14 節 20:10–21:00、21:10–22:00：來源 淡江 112-1 日間部考試相關事項公告節次表（acc.tku.edu.tw），114-2 網路借用教室作業日程表載 11～14 節 18:10–22:00 佐證；課表、圖片匯入皆支援；共同空堂仍只算 1–12 節。(3) 語言：內建 繁中、简中（`scripts/make-zh-cn.py` 以 OpenCC t2s 逐字轉換自 zh-TW，改 zh-TW 後要重跑）、English；另 28 種語言（含日韓越泰印尼馬來菲律賓緬柬蒙印地尼泊爾孟加拉西葡法德義荷波捷瑞俄烏土阿波斯希伯來）由 `api/translate.ts` 用 Gemini 從英文機器翻譯，存 `ui_translations`（migration 已套用）＋CDN／瀏覽器快取，佔位符不符就保留英文、翻譯成功率 <50% 不快取；「我的 → 外觀 → 更多語言」選擇，標示機器翻譯；阿拉伯／波斯／希伯來設 `dir=rtl`（版面未逐頁調整）。AI 助理回答語言跟著介面語言。**機器翻譯未在正式站實際產生過**（需 GEMINI_API_KEY 與額度）。(4) 好友邀請通知：底部「課表」分頁顯示待回覆邀請數紅點；推播排程同時通知「新好友邀請」與「好友邀請已接受」（`dueFriendNotices`，10 分鐘內、push_sent 去重）。
- **功能檢查與補強 — Claude Code（2026-10-20）**：(1) AI 助理「目前無法產生回答」：`api/gemini.ts` 最後串流改帶同樣 tools 並 `functionCallingConfig.mode = 'NONE'`；串流為空時先用規劃回合的文字，再以非串流重試一次，仍空才顯示固定訊息並記錄 `finishReason`（新增測試）。(2) 二手市集照片：migration `20261020140000_market_photos.sql`（已套用：`market_posts.photos text[]` 最多 4 張；公開 bucket `market-photos`，只能上傳／刪除自己 `<uid>/` 資料夾，限 JPEG 2 MB）；發文表單可加照片（前端縮成 ≤1280px JPEG）、列表顯示縮圖、貼文頁可左右滑看照片；CSP `img-src` 加 `https://*.supabase.co`（新增測試）。(3) 提醒說明文字改為推播版。資料庫建議：`pg_net` 安裝在 public schema（Supabase 建議移到 extensions；搬移需重建擴充、已取消，影響低；migration 檔已改為 `with schema extensions` 供新環境使用）。
- **上課／截止提醒改用 Web Push — Claude Code（2026-10-20）**：使用者開了提醒卻沒跳出：原本只有 App 開著時由前端計時器提醒，iOS 主畫面 App 關閉或進背景後就不會執行。新增：migration `20261020120000_push_reminders.sql`（已套用線上：`push_subscriptions` RLS 僅本人、`push_sent` 只給 service role；pg_net＋pg_cron 每分鐘呼叫 `/api/push-reminders`，需 Vault 中有 `cron_secret` 才會呼叫）；`api/push-reminders.ts`（依台北時間算到點的上課〔連堂只提醒第一節、只用進行中的學期〕與作業提醒，先寫 push_sent 佔位再送，410/404 刪除失效訂閱）；`public/push-sw.js`（workbox importScripts：push 顯示通知、點通知開對應頁）；`src/services/pushSubscription.ts`＋提醒設定頁：登入且有 `VITE_VAPID_PUBLIC_KEY` 時開啟提醒會訂閱推播並把設定存到伺服器，前端計時器改不重複提醒。訪客仍只能在 App 開著時提醒。**需開發者設定**：Vercel 環境變數 `VAPID_PUBLIC_KEY`、`VAPID_PRIVATE_KEY`、`VITE_VAPID_PUBLIC_KEY`（同公鑰）、`CRON_SECRET`；Supabase SQL `select vault.create_secret('<CRON_SECRET>', 'cron_secret');`。未在真機收過推播。
- **校園活動每日自動同步 — Claude Code（2026-10-19）**：新增 `api/sync-events.ts`＋Vercel Cron（`vercel.json` `crons`，每天 UTC 20:00＝台北 04:00）。抓 enroll.tku.edu.tw 列表（含分頁）與候選活動頁，條件：學生可參加、未額滿、10 週內開始、活動期間 ≤14 天、非招生／系友等；新活動以欄位組成的摘要寫入（不複製原文），既有活動只更新時間／地點（保留手寫摘要），變額滿或從列表消失的未來活動改 archived；列表少於 10 筆視為頁面異常、不動資料。`campus_events.source_url` 加唯一索引（migration `20261019060000`，已套用線上）。解析器依 WebFetch 看到的頁面結構寫成並以合成 HTML 測試（`api/sync-events.test.ts`），**未對真實 HTML 跑過**（此環境連不到 enroll.tku.edu.tw）。需開發者在 Vercel 設 `CRON_SECRET`（未設時端點回 503，不會執行）。
- **iPhone 桌面小工具（Scriptable 版）— Claude Code（2026-10-18）**：使用者要像 iOS 天氣小工具的桌面小工具，選「先 A（Scriptable）後 B（原生 App＋WidgetKit）」，內容：下一堂課、今天課表、淡水天氣、最近作業。網頁 App 無法提供 iOS 小工具，故由免費的 Scriptable App 承載。新增：(1) migration `20261018140000_widget_tokens.sql`（已用 Supabase MCP 套用到線上；每人一組密鑰，只存 SHA-256；RLS 僅本人可建立／讀／刪，已以 SQL 驗證不能替他人建立）；(2) `api/widget.ts`（GET＋Bearer 密鑰，service role 依雜湊找使用者，回傳本學期下一堂課／今日課表（連堂合併）／最近未完成作業／Open-Meteo 淡水天氣，`api/widget.test.ts`）；(3) 「我的 → 桌面小工具」（`WidgetSettings.tsx`）：產生／重新產生／停用、複製含密鑰的 Scriptable 腳本與步驟，訪客顯示需登入；(4) 腳本 `widgetScript.ts`（中型／小型，淡江紅漸層）。腳本以 Node 模擬 Scriptable API 跑過版面邏輯與錯誤畫面，**未在真的 Scriptable／iPhone 上執行過**。⚠ 範圍：`api/**` 與 migration 原屬 Codex，此次依使用者直接要求由 Claude Code 撰寫，Codex 之後可接手維護。B（原生 App）尚未開始。
- **啟動卡在載入畫面 — Claude Code（2026-10-17）**：使用者回報「載入不進去」。iOS 模擬器（訪客、Wi-Fi）可正常開啟，未能重現。程式中找到會無限等待的地方：`AuthProvider` 的 `supabase.auth.getSession()` 沒有逾時也沒有 catch——已登入且 token 過期時要先連線換新，手機網路慢／離線或 supabase-js 的儲存鎖卡住就永遠停在「確認登入狀態」。修正：最多等 6 秒（逾時當作未登入，之後拿到 session 會自動從登入頁回首頁）、錯誤也結束載入、`onAuthStateChange` 首次事件也結束載入。另加保險：啟動畫面（`#boot` 與 React `<BootScreen>`）超過 12 秒顯示「載入比平常久」與「重新載入」按鈕。新增 `AuthProvider.test.tsx`。
- **啟動畫面顏色跟 App 外觀一致 — Claude Code（2026-10-17）**：使用者手機系統深色、App「外觀」設淺色，開啟時先黑（iOS 依系統外觀選的 apple-touch-startup-image）再紅（網頁 splash 依 App 設定）。改為：App 設定為淺色／深色時，`theme-init.js`（最早）與 `ThemeProvider`（切換時）把所有啟動圖改指向該主題、移除 `prefers-color-scheme` 條件（`src/lib/startupImage.ts`）；「跟隨系統」維持原本依系統選圖。iOS 在啟動時讀啟動圖，所以切換外觀後下一次開啟才生效；若 iOS 只在加入主畫面時快取，需重新加入。**尚待 iPhone 確認**。
- **載入畫面下方淺色條（第二次）— Claude Code（2026-10-17）**：使用者回報 `4dbaee6` 後仍有淺色條。工作目錄中有一份來源不明、未提交的 `index.html` 修改（2026-10-17 00:55，非本對話所寫）：啟動畫面期間 `body` 透明、`#root` 不繪製（iOS 依頁面本身——body 底色與頁面底部內容，如淺色導覽列——決定下方空白條顏色）。檢查後採用並提交；因 `#root` 隱藏期間無法聚焦，E2E「skip link」改為等 `app-ready` 後才按 Tab。**尚待 iPhone 確認**。
- **載入畫面下方淺色條 — Claude Code（2026-10-16）**：使用者截圖：啟動畫面（紅）下方一條米白。iOS 26 啟動時頁面也可能少一個狀態列高（WebKit 301108），下方那條顯示 `html` 背景；`#boot` 結束後若 React 又顯示 `<BootScreen>`（登入確認、學期、lazy 頁），此時 `html.app-ready` 已是頁面底色。`BootScreen` 顯示期間加 `html.boot-screen`（淺色 #7F1A1F、深色 #141414，與啟動畫面相同），結束時與 `#boot` 移除時都重新嘗試恢復完整高度（`retryShortViewport`）。新增 `BootScreen.test.tsx`。**尚待 iPhone 確認**。
- **首頁右側被切掉 — Claude Code（2026-10-16）**：使用者 iPhone 截圖：有活動資料後，首頁內容比螢幕寬約 17px，右邊卡片與「查看全部」被 `overflow-x: clip` 切掉。推斷原因是 WebKit 對沒有指定欄數的 `grid`（隱含 `auto` 欄）依內容 max-content 撐寬；Chromium 不會（Playwright 量不到超出）。全域加 `.grid:not([class*='grid-cols']) { grid-template-columns: minmax(0, 1fr) }`。**尚待 iPhone 實機確認**。
- **校園活動資料 — Claude Code（2026-10-16）**：線上 `campus_events` 原本 0 筆。來源：淡江大學活動報名系統 https://enroll.tku.edu.tw/ （官方，列表 119 筆）。逐筆開啟活動頁取得時間、地點、主辦單位，匯入 48 筆 10/19–12/5、學生可報名且未額滿的活動（`status='published'`，`source_url`／`registration_url` 皆指向原活動頁，摘要為自行改寫）。排除：僅限教職員（教學研習、產學報帳、安全衛生訓練、DEI 座談）、已額滿、整學期線上課程與長期集點活動、招生說明會、系友會。資料是 2026-10-16 22:30 的快照，**不會自動更新**；建議下一步做 Vercel Cron 每日同步（伺服器端抓列表＋活動頁、依 `source_url` upsert、額滿／過期標為 archived）。其他仍空：`campus_places`（App 用 `src/data/places.ts`；建築座標仍 null——OSM Overpass／Nominatim 在此環境被 robots 擋下，未能查核，不填）、`knowledge_documents/chunks`（AI 助理知識庫，需在有 `GEMINI_API_KEY` 的環境執行 `npm run ingest`）、二手市集（使用者內容，不應預填）。
- **首頁左右晃動 — Claude Code（2026-10-16）**：使用者要首頁置中、不能左右滑。`html, body` 加 `overflow-x: clip` 與 `overscroll-behavior-x: none`（clip 不會建立捲動容器，視窗捲動與 sticky 正常）；任何元素即使超寬 1px，頁面也不會被拖離中央。E2E「no horizontal page scroll」每頁加測：塞入 150vw 元素並 `scrollTo(80)` 後 `scrollX` 必須仍為 0（移除修正時此測試失敗、加上後通過）。模擬器因使用者當時在全螢幕 App 無法操作，未在 iOS 模擬器上手動驗證。

## Files Changed
- Claude Code iOS 鍵盤高度：`src/lib/iosViewportFix.ts`（新）＋測試、刪除 `src/lib/iosViewportGap.ts`＋測試、`src/main.tsx`、`src/styles/index.css`、`src/components/layout/AppShell.tsx`、`src/features/ai/AssistantPage.tsx`（`data-keep-scroll`）、本檔。
- Claude Code iOS 底部缺口：`src/lib/iosViewportGap.ts`（新）＋測試、`src/main.tsx`、`src/styles/index.css`、`src/components/layout/AppShell.tsx`、`src/features/ai/AssistantPage.tsx`、本檔。
- Claude Code 捲動／色差：`src/lib/noZoom.ts`、`src/components/layout/AppShell.tsx`、`src/styles/index.css`、`src/features/ai/AssistantPage.tsx`、本檔。
- Claude Code 通訊版面／舊版錯誤：`src/hooks/useVisualViewport.ts`（新）＋測試、刪除 `src/hooks/useKeyboardInset.ts`＋測試、`src/features/ai/AssistantPage.tsx`、`src/app/RouteError.tsx`（新）、`src/app/router.tsx`、`src/main.tsx`、`vercel.json`、兩語系 `common.{updatedTitle,updatedBody,errorTitle,errorBody}`、`src/styles/index.css` 註解、本檔。
- Claude Code AI 助理鍵盤／校園服務：`src/hooks/useKeyboardInset.ts`（新）＋測試、`src/features/ai/AssistantPage.tsx`、`src/components/layout/AppShell.tsx`（`bottom-nav` class）、`src/styles/index.css`、`src/data/sources.ts`、兩語系 `servicesNote`、`index.html`（splash 副標中英）、本檔。
- Claude Code 啟動圖層：`index.html`、`src/lib/splash.ts`（新）、`src/lib/__tests__/splash.test.ts`（新）、`src/components/brand/Logo.tsx`、`src/main.tsx`、`vite.config.ts`（background_color）、`public/splash/*`（新）、`design/brand/make-ios-splash.py`（新）、`src/features/ai/AssistantPage.tsx`、`src/features/auth/ResetPasswordPage.tsx`、`src/features/dashboard/DashboardPage.tsx`、`src/styles/index.css`、本檔。
- Claude Code 首頁骨架：`src/features/dashboard/{DashboardPage,Hero}.tsx`、本檔。
- Claude Code 載入畫面：`index.html`（splash 樣式與結構）、`src/components/brand/Logo.tsx`（`BootScreen`、`LoadingMark`）、`src/main.tsx`、`src/app/router.tsx`、`src/app/SemesterProvider.tsx`、`src/styles/index.css`（`.loading-in`）、`src/features/market/MarketPostPage.tsx`、`src/features/schedule/ImageImport.tsx`、`docs/DESIGN_SYSTEM.md`、本檔。
- Codex 行事曆：新增 `src/features/schedule/{StudentCalendar,CalendarEventForm}.tsx`、`src/lib/{studentCalendar,courseTitle}.ts`、對應單元／元件測試、`e2e/student-calendar.spec.ts`、migration `20261013123046_private_calendar_events.sql`、`supabase/tests/rls_calendar_events.sql`；修改 SchedulePage／DayTimeline／WeekGrid、ImageImport 測試、types／hooks／timetableImport、DataRepository／LocalRepository／SupabaseRepository、兩語系、截圖 fixture 測試與 CSV E2E 提示、本檔及 CHANGELOG。未改 package.json、lockfile 或 api。
- Codex Gemini：新增 `api/gemini.ts`；刪除 `api/openai.ts`；更新 `api/{chat,store,timetable-import}.ts`、`api/{chat,timetable-import}.test.ts`、`scripts/ingest.ts`、`vite-dev-api.ts`（環境變數清單與註解）、`.env.example`、`api/README.md`、本檔。沒有修改前端或既有 migration。
- Claude Code（合併 Gemini）：`src/i18n/locales/{zh-TW,en}.ts`、`src/features/profile/AboutPage.tsx`、`src/features/explore/ExplorePage.tsx`、`e2e/main-flows.spec.ts`、`README.md`、`ARCHITECTURE.md`、`.env.production` 註解、本檔。
- Codex AI backend：新增 `api/chat.ts`、`api/chat-schema.ts`、`api/openai.ts`、`api/store.ts`、`api/sse.ts`、`api/chat.test.ts`、`scripts/ingest.ts`、`supabase/tests/rls_user_isolation.sql`、migration `20261012080231_ai_backend_security.sql`；更新 `api/README.md`、`package.json` 與 lockfile，並加入 API-only i18n alias 型別宣告。
- 本輪新增：`src/i18n/{t.ts,locales/zh-TW.ts,locales/en.ts,__tests__/locales.test.ts}`、`src/app/LanguageRoot.tsx`、`src/services/reminders.ts`、`src/hooks/useReminderScheduler.ts`、`src/features/profile/ReminderSettings.tsx`、`public/theme-init.js`、`e2e/{a11y,csp,english,reminders}.spec.ts`、`src/services/__tests__/reminders.test.ts`；刪除 `src/i18n/resources.ts`
- 本輪修改：幾乎所有 `src/features/**` 與 `src/components/**`（文字改 `t()`）、`src/lib/{labels,time,periods,schedule,tasks,csv,hooks}.ts`、`src/data/{places,sources}.ts`（英文關鍵字與說明）、`src/features/ai/localEngine.ts`（重寫，中英文）、`vercel.json`、`index.html`、`src/styles/index.css`
- 新增：`src/components/campus-scene/{PixelCampusScene.tsx,PixelSky.ts,PixelClouds.ts,PixelRiver.ts,PixelBridge.ts,PixelTerrain.ts,PixelRain.ts,PixelLighting.ts,SceneController.ts,sceneTypes.ts,palettes.ts,pixel.ts,layout.ts}`、`src/services/weatherService.ts`、`src/hooks/{useCampusWeather,useTimeOfDay,useReducedMotion}.ts`、`src/lib/solar.ts`、`src/i18n/{index,resources}.ts`、相關測試、`e2e/campus-scene.spec.ts`
- 修改：`src/features/dashboard/{Hero,DashboardPage}.tsx`、`src/styles/index.css`、`tailwind.config.js`、所有使用 `*-blue` 連結色的元件（改 `*-link`）、`src/lib/labels.ts`、`src/features/explore/CampusMap.tsx`、`src/features/profile/ProfilePage.tsx`、`src/main.tsx`、`src/test/setup.ts`、`index.html`、`vite.config.ts`、`package.json`（i18next、react-i18next）、文件
- App 版面：`src/components/layout/AppShell.tsx`、`nav.ts`、`src/components/ui/Sheet.tsx`、`src/styles/index.css`、`tailwind.config.js`（`max-w-app`）、`src/features/schedule/WeekGrid.tsx`、`SchedulePage.tsx`、`src/features/profile/ProfilePage.tsx`、`EventsPage.tsx`、登入/重設密碼頁、所有含斷點 class 的頁面、`vite.config.ts`、`e2e/rwd-pwa.spec.ts`、`docs/DESIGN_SYSTEM.md`、`ARCHITECTURE.md`
- 標誌：`src/components/brand/Logo.tsx`、`index.html`（favicon、splash）、`vite.config.ts`（includeAssets）、`public/icons/*`、`public/brand/logo-*.png`、`design/brand/tku-campus-os-logo-1024.png`；刪除 `public/favicon.svg`、`public/icons/icon.svg`、`public/brand/*.svg`
- 樣式/品牌：`src/styles/index.css`、`tailwind.config.js`、`src/components/brand/*`、`src/components/layout/AppShell.tsx`、`src/features/dashboard/Hero.tsx`、`index.html`、`vite.config.ts`、`public/favicon.svg`、`public/icons/*`、`public/brand/*`、`docs/DESIGN_SYSTEM.md`
- 全部 `src/**/*.tsx` 中 `*-navy` class 改為 `*-primary`
- 認證：`src/features/auth/LoginPage.tsx`、`src/features/auth/ResetPasswordPage.tsx`、`src/app/router.tsx`
- 資料：`src/app/SemesterProvider.tsx`、`src/app/AuthProvider.tsx`（新增 `localRepository` prop 供測試注入）
- 測試：`src/test/*`、`src/features/**/__tests__/*`、`e2e/*`、`playwright.config.ts`、`tsconfig.node.json`、`package.json`（`test:e2e`）

## Database & API Changes
- 線上資料庫已套用：init（含 advisor 修正）、`20261012130000_social.sql`（使用者在 SQL Editor 執行）。
- Social migration：`profiles.friend_code`（unique）、`friendships`（只能讀自己的；寫入全走 RPC）、RPC `send_friend_request` / `respond_friend_request` / `remove_friendship` / `list_friends` / `get_friend_schedule(friend, semester_code)` / `regenerate_friend_code`（SECURITY DEFINER、明確檢查 auth.uid()、撤銷 anon）；`market_posts` / `market_comments` / `market_reports`（RLS；作者名由 trigger 從 profile 帶入、不可偽造或修改；每日 10 篇、每小時 60 則留言上限；已完成貼文不可留言）。Advisor：7 個「登入者可執行 SECURITY DEFINER」皆為刻意設計
- ⚠ 新 migration 檔名時間戳：Codex `20261012080231` 早於 social `20261012130000`，但線上套用順序為 init → advisor_fixes → social → (待套用) ai_backend_security；兩者互不相依。
⚠ `is_admin()` 已撤銷 authenticated 的 EXECUTE：若之後要在 RLS policy 中使用它，需改放 private schema 或重新授權（Codex 注意）。
- 前端直接呼叫 Open-Meteo（公開 API、免金鑰，不需伺服器端）。`POST /api/chat` 已實作 JWT 驗證、速率限制、只讀工具、RAG、SSE 與使用者 JWT 下的對話紀錄。
- 新增 `20261012080231_ai_backend_security.sql`：明確設定 Data API grants、限制 service-role RAG RPC，並提供原子知識文件/chunk 匯入函式；未套用至線上資料庫。
- `npm run ingest` 從 `src/data/sources.ts` 讀取公開 PDF/HTML，內容雜湊未變即跳過，文件/chunks 由 service role 原子寫入；Word、下載失敗或擷取內容不足會記錄並略過。
- `/api/chat` 接受可選 `lang: "zh-TW" | "en"`；前端已傳入目前介面語言。

## Technical Decisions
- i18n：切換語言時重新掛載整個 UI（LanguageRoot），標籤對照表在讀取時翻譯；新增文字必須同時加到 zh-TW 與 en 字典
- 本機提醒用 Service Worker showNotification；伺服器端 Web Push 留待 Codex/後端
- 所有「校園時間」判斷（時段、問候、日出日落日期）一律用 Asia/Taipei（`src/lib/taipei.ts`），不依賴裝置時區
- 像素場景用 Canvas 2D 自行繪製（不引入 PixiJS），程序化產生、可依寬度裁切，確保主塔在手機可見
- 天氣座標使用校園中心（25.175, 121.449）
- 產品為手機 App：不再使用 Tailwind 斷點；新增 UI 時只設計手機版面（寬 ≤ 480px）
- 主題色 token 命名為 `primary`；`navy` 保留為輔助色；課程顏色 key `navy` 不變（資料相容）
- 紅底上的宮燈改為金色 #F2C46B 以保持辨識度
- E2E 預設使用 `npx playwright install chromium` 安裝的瀏覽器；可用 `PW_CHROMIUM_PATH` 指定
- 其餘見 ARCHITECTURE.md

## Tests
- Claude Code iOS 鍵盤高度（2026-10-15）：lint ✅、Vitest 26 files／126 tests ✅、Playwright 132 passed ✅。Simulator iPhone 17 Pro 重現問題 ✅；第一版修法（切 display）部署後於模擬器驗證**無效**，經診斷面板改為聚焦／失焦唯讀欄位；最終版部署後的模擬器驗證結果見提交後紀錄。
- Claude Code iOS 底部缺口（2026-10-14）：`tsc -b` ✅、lint ✅、Vitest 26 files／127 tests ✅（新增缺口量測 3 項）、Playwright 全套 132 passed ✅。
- Claude Code 捲動／色差（2026-10-14）：`tsc -b` ✅、lint ✅、Vitest 25 files／124 tests ✅、Playwright 全套 132 passed ✅（含禁止縮放測試）。
- Claude Code 通訊版面／舊版錯誤（2026-10-14）：`tsc -b` ✅、lint ✅、Vitest 25 files／124 tests ✅、Playwright 全套 132 passed ✅。iPhone 13 尺寸截圖：空對話、多則對話、聚焦輸入框並把視窗縮到 500px 模擬鍵盤（標題留在上方、訊息區捲動、輸入列在最下方、導覽隱藏）。**真實 iOS 鍵盤與舊版自動重整仍待實機確認**。
- Claude Code AI 助理鍵盤／校園服務（2026-10-14）：`tsc -b` ✅、lint ✅、Vitest 25 files／124 tests ✅（新增 useKeyboardInset 1 項）、Playwright 全套 132 passed ✅（第一次跑英文介面 /tasks?add=1 因讀到 splash 中文副標失敗，splash 副標改為依語系顯示後重跑全過）。iPhone 尺寸截圖確認輸入列在底部導覽上方、對話不被遮住、服務卡片排版正常。**瀏覽器模擬無法開出螢幕鍵盤，鍵盤情境尚待使用者實機確認**。
- Claude Code 啟動圖層（2026-10-14）：`tsc -b` ✅、lint ✅、Vitest 24 files／123 tests ✅（新增 splash hold/release 2 項）、Playwright 全套 132 passed ✅。另以雲端模式建置＋模擬 Supabase（延遲 900ms）在 iPhone 13 尺寸逐 250ms 截圖，確認 splash → 淡出到已繪好的首頁（Hero＋骨架）→ 資料到位，AI 助理頁同樣無空白幀。瀏覽器模擬沒有安全區域與 iOS 啟動圖，**這兩項尚待使用者在實機確認**；iOS 啟動圖需重新「加入主畫面」才會套用。
- Claude Code 首頁骨架（2026-10-14）：`tsc -b` ✅、lint ✅、Vitest 23 files／121 tests ✅、Playwright 全套 132 passed ✅。本機模式資料是同步讀取，骨架只在雲端模式出現；**尚未在實機截圖確認骨架畫面**。
- Claude Code 載入畫面（2026-10-14，雲端工作區）：`tsc -b` ✅、lint ✅、build ✅、Vitest 23 files／121 tests ✅、Playwright 全套 132 passed ✅（含淺深色 axe、無水平捲動、CSP）。以手機尺寸截圖人工檢查 splash 淺／深色與頁內載入（延遲 lazy chunk 重現）。尚未在實機或正式站確認。
- Codex 行事曆：上一輪完整驗證 lint、typecheck、Vitest（23 files／121 tests）、build 全過；`npx playwright test --workers=2` 全套 132 passed，含桌面／手機的月年切換、私人行程儲存與 reload、淺深色 axe，以及既有主要流程回歸。初次測試的日期條件／斷言已修正；手機表單初始化競態改用 useLayoutEffect，重跑 6 項与全套通過。線上 `supabase/tests/rls_calendar_events.sql` 已實際執行通過，第一次 MCP requestState 逾期後重新執行成功；不是以模擬測試冒充線上驗證。本機保留一筆清楚標示「非真實排班」的 localhost 測試行程，未寫入使用者雲端行程。尚未實測新版雲端登入 CRUD 與圖片確認加入；私人行程通知／.ics 尚未實作。既有 jsdom Canvas、React Router、build chunk 與 npm audit 警告仍保留。
- Codex Gemini worktree（2026-10-13）：`npm install` 完成；`npm run lint` ✅、`npm run typecheck` ✅、`npm run test` ✅（21 files / 112 tests；聊天 API 15、圖片 API 9）、`npm run build` ✅。Mock fetch 覆蓋串流文字、function call→工具結果→最終回答、untrusted 文件／禁止 mutation、結構化 JSON／丟掉無效格子、Gemini 429／5xx 與請求中不夾帶 Supabase key/JWT。
- Codex Gemini：兩支 API 用 esbuild `--bundle --platform=node --format=esm --packages=external` 打包（專案來源被打包，npm dependencies 外部載入），確認輸出不含 `@/`，以純 Node ESM 載入 default handler ✅。暫存 bundle 已清除。
- Claude Code 審查並合併 `feat/gemini`（2026-10-13）：前端隱私文字改為揭露 Google Gemini（圖片匯入、助理提示、關於頁 p5）；修正 CSV e2e 路徑與探索頁 3px 橫向溢出。`tsc -b`、lint、build ✅；Vitest 21 檔 112 測試 ✅；Playwright 全套 126 測試（123 通過＋修正後重跑 3 項與 rwd/a11y/geolocation 68 項）✅；API 兩支以純 Node ESM 載入 ✅。**尚未用真實 Gemini 金鑰實測**。
- Codex Gemini 本機 `npm run dev`：真實 HTTP 驗證無金鑰時 `/api/chat` 回 503 SSE、`/api/timetable-import` 回 503 JSON，`/schedule` 預覽回 200 ✅；localhost:5173 預覽已恢復。提交前 staged diff 的 Gitleaks 機密掃描為零候選。
- Codex Gemini 真實問答／讀圖：**未實測**。原專案 `.env.local` 沒有 `GEMINI_API_KEY` 或 service role；新 worktree 沒有 `.env.local`。沒有將金鑰複製或寫入 Git／交接文件。既有 jsdom Canvas／React Router 測試提示與 build 大 chunk 警告仍存在，測試/建置本身成功。
執行於 Claude 雲端工作區（Node 22.22）：
- `npm run lint` ✅
- `npm run typecheck` ✅
- `npm run test` ✅ 14 files, 64 tests（本輪新增登入頁 5 項＋登出 2 項，共 66 tests：輸入驗證、錯誤訊息、註冊帶暱稱、顯示密碼、訪客模式）；先前 59 tests（新增提醒、翻譯 key 一致性）；在 UTC、America/Los_Angeles、Asia/Taipei、Europe/London 時區皆通過（新增天氣解析/錯誤分類/快取、場景與日出日落、太陽計算）
- `npm run build` ✅
- Codex worktree（Node 24.16.0）：`npm run lint` ✅、`npm run typecheck` ✅、`npm run test` ✅（15 files, 73 tests，含 9 項 API/SSE/錯誤分支與 prompt-injection mock）、`npm run build` ✅。
- 已新增 `supabase/tests/rls_user_isolation.sql` 覆蓋 A 無法讀 B 的 user_courses、schedule_entries、tasks、ai_messages；尚未執行，因 worktree 無 `supabase/config.toml`／本機資料庫。線上 migration 與真實 `/api/chat` 尚待開發者套用新 migration、設定伺服器環境變數後驗證。
- `npm run test:e2e` ✅ 118 passed（本輪新增：axe 無障礙 36、CSP 10、英文介面 20、提醒 2；先前：新增：即時天氣顯示、API 失敗備援不顯示虛構溫度、Canvas 真實像素與限制色盤且會動、reduced motion 靜態、英文切換、快捷操作）；原 38（desktop 1360×900、mobile Pixel 7）：主要流程、衝突、待辦、CSV 匯入、探索、AI 來源、深色模式、8 頁無水平捲動、App 版面（底部導覽＋480px 框）、週課表不超出手機寬度、PWA manifest＋service worker、skip link
- 登入頁（雲端建置）axe WCAG 2.2 AA：登入/註冊、淺/深色 0 violations
- 真實 Supabase 驗證 ✅（2026-10-12，以 REST 對線上專案）：註冊即登入、trigger 自動建立 profile（暱稱寫入）、本人可新增/讀取學期與作業、他人讀不到（RLS）、未登入讀不到、自行改 role=admin 被擋、`delete_my_account` 刪除帳號並連帶刪光資料（測試帳號已清除，資料表歸零）
- 好友/市集真實 Supabase 驗證 ✅（3 個暫時帳號，以 REST 對線上專案）：代碼大小寫不拘、重複邀請回 pending、自己代碼回 self、錯誤代碼 not_found；邀請者不能自行接受；接受前看不到課表、接受後看得到且無備註；陌生人看不到課表與好友關係、讀不到他人 profile；偽造 author_name/user_id 無效、他人無法修改貼文；留言作者名正確；未登入讀不到市集；重複檢舉被擋（23505）、刊登者看不到檢舉；已完成貼文不能留言；刊登者可刪他人留言；移除好友後立即看不到課表。測試帳號已刪除，資料表歸零
- 好友/市集元件測試：`src/features/friends/__tests__`（4）、`src/features/market/__tests__`（6）、`src/lib/social/__tests__`（4）
- 好友/市集畫面（雲端建置＋模擬 Supabase 回應）axe WCAG 2.2 AA：好友列表、好友週課表、市集列表、貼文、我的貼文、發文表單，淺/深色 0 violations
- 合併後 `npm run lint` ✅、`typecheck` ✅、`test` ✅ 18 files / 89 tests（含 Codex API 測試 9 項）、`build` ✅
- 圖片匯入測試：`src/lib/__tests__/timetableImport.test.ts`（以開發者提供的真實淡江課表截圖逐格轉錄為 fixture：11 門課、節次與時間正確）、`api/timetable-import.test.ts`、`src/features/schedule/__tests__/ImageImport.test.tsx`；以真實截圖上傳＋模擬 API 截圖檢查，axe 0 violations。**尚未用真實 Gemini 模型辨識**（需設定 `GEMINI_API_KEY`）
- 目前 `npm run test` ✅ 21 files / 103 tests、lint ✅、typecheck ✅、build ✅
- ⚠ 尚未重跑 `npm run test:e2e`（上一輪 118 passed；本輪底部導覽「探索」改名「校園」，e2e 未依名稱尋找該連結）
- 未執行：自動化 RLS 測試（Codex `supabase/tests/`）；重設密碼流程（雲端工作區無法連 supabase.co；Email 驗證信限制見 Known Issues）

## Known Issues
- 以下標「尚待 iPhone 確認」的版面修正只在模擬器或測試中驗證過
- 校園活動同步的解析器尚未對真實頁面驗證；若淡江網站改版或擋掉 Vercel 的連線，同步會失敗（Logs 會記錄，資料不會被清空）
- Supabase 安全建議：Auth 的「Leaked password protection」未開（需開發者在後台 Authentication → Settings 開啟）；SECURITY DEFINER 好友／刪帳號函式開放 authenticated 呼叫屬設計如此；ai_usage／knowledge_chunks／admin_audit_logs 只給 service role（無 policy 屬設計）
- 一位使用者 Email 網域為 gamil.com（疑似打錯），重設密碼信會收不到
- 淡江大橋塔身輪廓與單/雙索面待查核（目前為詮釋）
- Artifact 預覽環境無法連線 Open-Meteo，會顯示「暫時無法取得天氣」（實際部署正常）
- 重設密碼信件流程尚未實測（需 Site URL 與寄信服務）
- Supabase Auth 已關閉「Confirm email」（開發者 2026-10-12 決定）：註冊後可立即登入，但 Email 未驗證；正式上線前建議接自訂 SMTP 再開回驗證
- 建築代碼來源為學生整理、座標未查核；T 棟名稱待核對
- 淡江官方品牌規範未找到公開來源；紅色主題與標誌為開發者指定
- 新標誌細節多，favicon（32px）較難辨識；可考慮另做簡化版小圖示
- 預覽版（Artifact）無法顯示 OSM 地圖底圖、無法下載 CSV/.ics
- npm audit 有建置工具鏈警告，尚未處理

## Next Steps
- **桌面小工具**：使用者在 iPhone 裝 Scriptable 實測後依截圖微調；第二階段 B（原生 App＋WidgetKit，需 Xcode 與 Apple Developer）尚未開始
- **校園活動自動同步**：已實作；待開發者設 `CRON_SECRET` 後在 Vercel → Cron Jobs 手動 Run 一次，看 Logs 的 `sync-events {...}` 結果，並確認首頁活動
- **AI 知識庫**：在有 GEMINI_API_KEY 的環境執行 `npm run ingest`（knowledge_documents 目前 0 筆）
- **（2026-10-20 已由 Claude Code 修正，待正式站實測）** 正式站問「明天第一堂課在哪裡？」回「目前無法產生回答，請稍後再試。」——此句是 `api/gemini.ts` 在已呼叫工具（有 sources）但最後串流沒有任何文字時的備援。推測：最後一次 `streamGenerateContent` 沒帶 `tools`，但對話內含 functionCall／functionResponse，模型仍想呼叫工具而回空（或回傳只有 thought）。建議：(1) 第一輪 `generateContent` 若已有文字且無 function call，直接用該文字回應，不再多打一次串流；(2) 最後串流請求帶同樣 `tools` 並設 `toolConfig.functionCallingConfig.mode = 'NONE'`；(3) 記錄 `finishReason`（不含內容）方便查 Vercel logs。Claude Code 因裝置連線中斷未能查看 Vercel 執行紀錄。
- **開發者／Claude Code**：行事曆分支已依使用者授權合併並正式部署。私人行程 migration 已套用，勿重複建立表；真人登入後驗證雲端 CRUD，重新上傳截圖核對教師／助教，再由使用者確認加入。舊課程中已合併的正課／助教資料不會自動重建，需核對原圖。單日完整小時格已撤回，不要實作。後續可加私人行程提醒／.ics／可信校曆。誤建 `AGEMINI_API_KEY` 可由開發者自行刪除，保留正確 `GEMINI_API_KEY`。
- **Claude Code**：前端圖片匯入隱私提示改成「圖片會傳給 Google Gemini 辨識」；`ARCHITECTURE.md` 的 AI provider 文案與 `AGENTS.md` 的目前 Codex 分支可同步更新（本輪遵守範圍未修改）。
- **開發者**：合併 `feat/gemini` 後，設定伺服器端 Gemini/Supabase 環境變數，再登入實測真實問答與圖片課表辨識。執行 `npm run ingest` 重建 Gemini vectors，不能沿用舊 OpenAI vectors；免費額度以 Google 專案總用量計算。
- **Codex**：`api/timetable-import.ts` 由 Claude Code 新增（使用者要求），之後可由 Codex 維護。`feat/ai-backend` 已合併進 `main`；之後請從最新 `main` 開新分支。可補：好友/市集的 pgTAP RLS 測試（`supabase/tests/`）、市集檢舉的管理端 API
- **Claude Code（main）**：重跑 e2e 並新增好友/市集 e2e（需模擬 Supabase）
- **Claude Code（main）**：活動管理後台 UI（需 Codex 的 admin API）、Capacitor 打包 iOS/Android（待開發者決定）
- **開發者**：決定 Email 驗證策略（關閉或自訂 SMTP）；部署後在 Supabase Auth 設定 Site URL 與 Redirect URLs；建立 GitHub repo；Vercel 環境變數填 `VITE_SUPABASE_URL`、`VITE_SUPABASE_ANON_KEY`（publishable key）
- **開發者**：在 Supabase SQL Editor 套用 `supabase/migrations/20261012080231_ai_backend_security.sql`；在 Vercel 設定 `SUPABASE_URL`、`SUPABASE_ANON_KEY`、`SUPABASE_SERVICE_ROLE_KEY`、`GEMINI_API_KEY`（以及可選 Gemini 模型/限流變數），再驗證線上 `/api/chat` 與執行 RLS SQL。

## Git Status
- Branch：`main`（Claude Code 直接在 main 提交，經使用者在自己電腦 `git push origin main` 推送，Vercel 自動部署）。
- 工作流程：雲端工作區 commit → git bundle → 透過裝置連線 `git pull --ff-only` 到使用者電腦 `~/Desktop/tkuApp` → 使用者推送。
- Remote：`origin`（GitHub `bryankccy-glitch/tkuApp`）。不可 force push。

## Important Notes
- 不可要求或儲存淡江校務系統帳密；不可爬取受限制校務資料
- 不可宣稱為淡江官方 App；不可使用淡江校徽
- Secrets 不得寫入 Git / HANDOFF
