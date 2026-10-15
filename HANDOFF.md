# TKU Campus OS — Development Handoff

## Last Updated
2026-10-14（Asia/Taipei, UTC+8）

## Updated By
Claude Code（main）；前一輪 Codex（`codex/schedule-session-labels`）

## Current Status
月／年學生行事曆、私人行程 CRUD／每週重複，以及正課／助教分組與括號教師標示已依使用者明確授權 fast-forward 合併 main 並正式部署；原單日時間軸保留，完整小時格需求已由使用者撤回。私人行程 migration 已套用線上並通過 RLS 隔離測試。正式站月／年檢視、現有課程教師標示及未登入聊天／圖片 API HTTP 401 已實測。既有 `20261012080231_ai_backend_security.sql` 仍待套用；本輪未修改程式、資料庫或金鑰。

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
- **iOS 主畫面 App 鍵盤收起後畫面變矮 — Claude Code（2026-10-15）**：在使用者 Mac 的 Xcode Simulator（iOS 26.3）重現：iPhone 17 Pro（動態島）把 App 加入主畫面 → AI 助理打字送出 → 收鍵盤後，整個 WebView 變矮約一個狀態列，底部導覽被抬高、文字被切、下方一條色塊，切到首頁仍卡住；iPhone 16e（瀏海）同流程不會發生。前一版（`88c107b`，把導覽往下推補缺口）錯誤：缺口區域根本不在 WebView 內，推下去只會被切掉，已移除。改用 `src/lib/iosViewportFix.ts`：只在主畫面模式、偵測到高度比無鍵盤時的最大值少 >4px（輸入框未聚焦）時，於 focusout 後 150／600ms 及回到前景時，對 `#root` 切換 `display:none` 再還原強制 WebKit 重新量測，並保留頁面與 `[data-keep-scroll]` 的捲動位置；過程以頁面底色遮罩 120ms 淡入、220ms 淡出遮住。
- **iOS 主畫面 App 底部浮起 — Claude Code（2026-10-14）**：使用者截圖量測：底部導覽（含 34pt 底部安全區）下方還有約 59pt 深色條＝狀態列高度，判斷是 iOS（主畫面模式）把版面算得比螢幕矮一個狀態列，`bottom: 0` 的元素因此浮起。新增 `src/lib/iosViewportGap.ts`：只在主畫面模式、沒有輸入框聚焦（鍵盤會正常縮版面）時，以 `screen.height - innerHeight`（限 0–90px）算出缺口寫入 `--ios-gap`；底部導覽改 `bottom: calc(-1 * var(--ios-gap))` 貼到真正底部，AI 助理圖層高度加上缺口。瀏覽器／正常情況為 0，行為不變。**尚待實機確認**（瀏覽器無法模擬此 iOS 行為）。
- **捲動卡頓與底部色差 — Claude Code（2026-10-14）**：使用者回報 iPhone 主畫面 App 上下滑動卡卡、底部導覽下方有一條較深的色帶。卡頓主因：`noZoom.ts` 在 document 掛了非 passive 的 `touchmove`（為擋雙指縮放），讓每次捲動都要等主執行緒；已移除（雙指縮放已由 `html { touch-action: pan-x pan-y }` 擋住，iOS 由 gesture 事件擋住，縮放 e2e 仍通過）。AI 助理頁開啟時鎖住整頁捲動，只捲訊息區。色差：部分 iOS 主畫面版本頁面底部高於實體螢幕底部，底部導覽下方露出頁面底色；導覽改為不透明 `bg-surface` 並用 box-shadow 把同色往下延伸 120px。**尚待實機確認**。
- **AI 助理改成通訊軟體版面＋部署後舊版錯誤 — Claude Code（2026-10-14）**：使用者錄影比對 Instagram 私訊：要「標題固定、訊息在中間捲動、輸入列直接貼在鍵盤上」；我們的版本在 Safari 打字時整頁上下跳、底部導覽夾在輸入列與鍵盤中間（iOS 此時是縮小版面而非捲動，前一版用高度差判斷鍵盤因此失效）。改為：AI 助理整頁是固定圖層，大小跟著 `useVisualViewport`（可見區域 top／height），header 固定、訊息區 `overflow-y-auto`、輸入列在底部；輸入框聚焦時（不再靠高度猜鍵盤）隱藏底部導覽與說明文字，輸入列貼齊鍵盤；按送出／停止不會讓輸入框失焦（鍵盤不收起）；離開輸入時頁面捲回頂端。移除 `useKeyboardInset`。另：錄影中出現「Unexpected Application Error: 'text/html' is not a valid JavaScript MIME type」——部署後舊版頁面要載入已不存在的程式檔，Vercel 改寫規則把它回成 index.html。修正：`vercel.json` 改寫排除 `/assets/`（缺檔回 404）、`vite:preloadError` 與路由 `errorElement`（`src/app/RouteError.tsx`）偵測舊版程式檔錯誤時自動重新整理一次（sessionStorage 防無限重整），其他錯誤顯示友善錯誤頁與「重新載入」，不再出現 React Router 開發者錯誤頁。
- **AI 助理打字跳動＋常用校園服務 — Claude Code（2026-10-14）**：使用者回報 iPhone 上 AI 助理打字時整個畫面跳出來。原因：iOS 鍵盤不縮小版面而是捲動頁面，sticky 輸入列與固定底部導覽跟著跳；且輸入框 15px，iOS 會對小於 16px 的欄位自動放大。修正：新增 `useKeyboardInset`（VisualViewport）算出鍵盤高度，輸入列改為 `fixed` 並貼在鍵盤正上方（平常在底部導覽上方），鍵盤開啟時 `<html data-kb="open">` 隱藏底部導覽；訊息區下方保留與輸入列等高的空間；空對話開啟時不再自動捲動；觸控裝置上所有輸入欄位 16px。常用校園服務新增「校務行政系統」（淡江單一登入 SSO `https://sso.tku.edu.tw/NEAI/loginrwd.jsp`）與「學務系統」（`https://www.sis.tku.edu.tw/`，請假／獎助學金／社團等），2026-10-14 開啟頁面確認存在；只放官方連結，不代登入、不取得帳密，說明文字已註明。啟動畫面副標依語系顯示中／英文。⚠ Codex：`scripts/ingest.ts` 會讀 `OFFICIAL_SOURCES`，新加的兩筆是登入入口頁，內容很少（應會因過短被略過），若不需要可在匯入端排除 `kind: 'service'` 的登入頁。
- **啟動畫面圖層與 AI 助理頁頂 — Claude Code（2026-10-14）**：使用者回報 (1) iPhone 上 AI 校園助理標題頂到狀態列；(2) 載入時「圖層沒用好、卡一個色塊」。修正：AI 助理頁與重設密碼頁頂部補 `env(safe-area-inset-top)`（其他頁原本就有）。啟動畫面改為 index.html 中獨立的 `#boot` 圖層（不再放在 `#root` 內被 React 直接換掉），由 `src/lib/splash.ts` 以 hold/release 控制：初次渲染與 `BootScreen`（確認登入、學期載入、lazy 頁面）期間保持顯示，最後一個 hold 釋放後等畫面繪出再淡出 320ms，底下的頁面已經畫好，不會閃空白或半成品；之後若再需要全螢幕載入才由 React 畫同樣外觀。manifest `background_color` 由米白改為淡江紅，避免系統啟動畫面先閃一塊米白；新增 iOS 啟動圖 `public/splash/{light,dark}-*.png`（10 種 iPhone 尺寸 × 淺／深色，`design/brand/make-ios-splash.py` 產生，Logo 與標題位置與網頁 splash 對齊，iOS 只會下載符合的那一張，未加入 Service Worker 預快取）。splash 移除放射光暈並讓 Logo／標題靜止，以免與 iOS 啟動圖交接時跳動。首頁骨架改為與真實卡片同形狀（卡片內文字條）並加柔和 shimmer（`.skeleton`，減少動態時靜止）。
- **首頁不再空白等待 — Claude Code（2026-10-14）**：使用者回報 iPhone 開首頁時會先卡一下空白畫面（雲端模式讀取課表／作業／個人資料時整頁只放延遲淡入的載入圖示）。改為 Hero（淡江大橋場景＋天氣）與快捷操作立即顯示，問候語先不帶暱稱、摘要以淡色條佔位；下方用與真實區塊同尺寸的骨架（`DashboardSkeleton`）佔位，資料到了直接替換不跳版。錯誤處理不變。
- **載入畫面重新設計 — Claude Code（2026-10-14，`fe9c1ff`，已合併 main 並由 GitHub 推送自動部署正式站，已確認正式站 HTML 為新版）**：使用者要求美化載入中畫面。(1) 啟動畫面（`index.html` splash）加上 TKU Campus OS 字標、「淡江智慧校園」、白色細進度條，標語移到底部；淺色為淡江紅漸層＋頂部柔光，深色為 #141414＋紅色光暈；進場動畫與 reduced-motion 靜態版。(2) 新增 `BootScreen`（`src/components/brand/Logo.tsx`）沿用同一組 `.splash*` 樣式且不重播進場動畫，用於最外層 Suspense、確認登入狀態、學期載入，原本「紅色 splash → 白底小 logo → 頁面」的跳閃改成無縫銜接。(3) 頁內 `LoadingMark` 改成 Logo 外圈淡江紅旋轉環、垂直置中（`min-h-[55vh]`），延遲 160ms 淡入避免快速載入時閃一下；新增 `compact`（留言區、圖片匯入辨識中）。未改文字字典、資料或 API。
- **部署設定 — Codex（2026-10-14）**：使用者明確要求「合併部署」，main 從 `4c02535` fast-forward 至 `ee9ad7b` 並一般推送，未 force push／覆寫未提交修改。正式部署 `dpl_8piEZCNNWaeVvgXkkUJJPcERtEwA` 已 READY，alias `https://tku-app.vercel.app`；瀏覽器實測月檢視、12 個月份年檢視、現有課程括號教師標示，沒有新增／刪除使用者行程或課程。PWA 第一次重新整理仍為舊快取，第二次載入已更新。未帶 token 的 POST `/api/chat` 回 401 SSE（登入資訊無效），`/api/timetable-import` 回 401 JSON（請先登入），不是 Vercel 保護頁。重新執行 lint、typecheck、Vitest 23 files／121 tests、build、Playwright 132 tests 全通過；兩個 feature commits 的 Gitleaks 掃描未發現洩漏。Vercel npm ci 仍報 34 個依賴漏洞（含 2 critical），本次未升級。伺服器變數 `GEMINI_API_KEY`、`SUPABASE_URL`、`SUPABASE_ANON_KEY`、`SUPABASE_SERVICE_ROLE_KEY` 沿用既有設定，未讀取值；本段文件提交不改程式。
- **Codex — Feature 發布驗證（2026-10-14）**：程式提交 `477991f` 已一般推送至 GitHub `codex/schedule-session-labels`，遠端 SHA 與本機一致，main 未改動。Vercel Preview `https://tku-bez9qvkdl-campus-hub5.vercel.app`（`dpl_mup9p8zzdRZyfq8pAmWadttUdmtt`）已 READY；透過瀏覽器實際進入登入頁、訪客課表並切換月／年，確認 42 日月格與 12 個月份可見。未登入的 CLI API 驗證收到 Vercel Deployment Protection 的 401，不能視為應用程式 JWT 驗證結果；正式站 API 的 401 為先前已完成的實測。新版真人雲端行程 CRUD 與課表最終加入仍待使用者確認。發布前 lint、typecheck、23 files／121 tests、build 全通過；完整 E2E 132 tests 通過，staged 機密掃描未發現洩漏。本段後續僅文件提交，不改已部署程式。
- **Codex — 行事曆與助教（2026-10-14）**：保留單日／週課表，新增月／年切換、12 月份縮圖、前後期／今天、課表／作業考試／私人行程篩選與每日議程。課程只顯示於所選學期起訖日期內，不捏造校曆。私人行程支援打工排班、約會約定、讀書自習、社團活動與其他；可指定日期、分鐘起訖、地點、備註、每週重複／截止日期、編輯／刪除。時間使用 Asia/Taipei，支援跨日與跨年。圖片匯入依課名與原圖教師分組，不跨正課／助教或不同教師合併；助教存成「課名（助教）」，正課顯示「課名（教師姓名）」，缺漏教師不推測。既有真實截圖 fixture 的 11 個課名分成 16 個授課項目。尚未在新版確認加入使用者的真實課表，不宣稱完整真實匯入已成功。
- **Codex — 資料與測試**：全部資料經 DataRepository；本機舊儲存相容，私人行程納入 export／deleteAllData。Supabase 使用現有使用者 JWT，calendar_events 只允許本人 CRUD，不共享給好友。新增 migration `20261013123046_private_calendar_events.sql` 已於 2026-10-13 套用 `tku-campus-os`，SQL RLS 測試通過（本人 CRUD、他人讀改刪被擋、不可偽造／轉移 user_id、anon 不可讀／新增；全部臨時資料與帳號 rollback）。Security advisor 沒有新增此表的問題，既有 RPC／service-only 表及洩漏密碼防護未開啟的提示仍存在。無新增套件。GitHub 發布只推 feature 分支，不 force push、不合併或直接推 main。
- **Codex — Vercel 發布準備（2026-10-13）**：已 fetch，`origin/main` = `ace44fc`，`feat/gemini` = `ace6bce` 並包含最新 main。第一個正式部署 `dpl_54Hky37jxtVoyhjumquAQUJbcynE` 被 Vercel commit 作者權限驗證阻擋，未取代正式站；確認 Git 作者 email 與目前已登入 Vercel 帳號不一致，為本輪發布建立使用目前 Vercel 帳號作者資料的新交接提交，保留既有歷史且不更動全域 Git 設定。Production 目前沒有伺服器環境變數，Gemini 尚未啟用。
- **Codex — Gemini 遷移（2026-10-13）**：新增 `api/gemini.ts`、移除 `api/openai.ts`；直接使用官方 REST API，預設 `gemini-3.5-flash-lite`（模型 ID 依 Google 官方文件確認）。保留唯讀 function calling、工具資料 `UNTRUSTED_TOOL_DATA` 標記、語系 system instructions、sources 與 `meta/delta/sources/error/done` SSE 合約；保留 function call ID 與 thought signature。SSE 在上游請求成功後才開始，Gemini HTTP 429 可回前端 HTTP 429／中文友善訊息，5xx 不回傳上游細節。
- **Codex — Gemini 圖片與 RAG**：課表圖片用 `inlineData`、`responseMimeType=application/json`＋`responseSchema`，沿用 `VISION_PROMPT`／`cellSchema`，丟掉個別無效格子，回應／狀態碼相容；API 不保存圖片。Embedding 使用 `gemini-embedding-001`，明確要求 1536 維並正規化，query/document 使用對應 retrieval task type。匯入改用共用 embedding 函式，content hash 納入 provider/model/維度，確保舊 OpenAI vectors 重新建立。沒有新增 SDK／修改 `package.json` 或 lockfile；沒有修改 `src/**`。
- **Codex — 設定**：伺服器 key 改為 `GEMINI_API_KEY`；可選 `GEMINI_MODEL`、`GEMINI_VISION_MODEL`（預設同聊天模型）、`GEMINI_EMBEDDING_MODEL`；`vite-dev-api.ts` 的清單與 `.env.example`／`api/README.md` 已同步。聊天／圖片生成請求明確設定 Google 官方支援的 `store: false` 關閉請求紀錄；私人資料仍用使用者 JWT/RLS，service role 的用途不變；未執行線上匯入或資料庫修改。
- **禁止縮放**（開發者 2026-10-13 決定，固定 App 版面）：viewport `maximum-scale=1, user-scalable=no`；`html { touch-action: pan-x pan-y }`；`src/lib/noZoom.ts` 擋 iOS gesture 事件、雙指 touchmove、Ctrl/觸控板縮放與 Ctrl +/-；校園地圖（Leaflet）例外仍可縮放。a11y e2e 關閉 axe `meta-viewport` 規則（取捨：無法放大文字，屬 WCAG 1.4.4 例外決定）。e2e 新增縮放測試
- **正式網址：https://tku-app.vercel.app**（Vercel `tku-app`，production 部署 `6662fd2` Ready）。已驗證：開啟即導向登入頁、網站可連 Supabase（CSP 正確）、`/api/timetable-import` 正常回 503（伺服器金鑰尚未設定）、Service Worker 已註冊。Supabase Auth：Site URL = `https://tku-app.vercel.app`，Redirect URLs = `https://tku-app.vercel.app/**`、`http://localhost:5173/**`
- ⚠ GitHub push 未自動觸發第一次部署，這次是從 Vercel「Create Deployment」手動部署 `main`；之後推送若未自動部署，可在 Deployments 頁手動建立
- **部署設定 — Codex（2026-10-13）**：GitHub `bryankccy-glitch/tkuApp`（private）＋ Vercel `campus-hub5/tku-app`。bundle 驗證後僅 fast-forward 至 `16292dc`（包含 `ace6bce`、`8c01d32`），一般推送 `main`；已刪除未追蹤 bundle 與已合併的本機／遠端 `feat/gemini`、執行 worktree prune。乾淨的 `../tkuApp-codex` 保留為 detached HEAD，未刪除其內容。`vercel.json` 維持 vite／`npm ci`／`npm run build`／`dist`。伺服器端 `SUPABASE_URL`、`SUPABASE_ANON_KEY`、`SUPABASE_SERVICE_ROLE_KEY`、`GEMINI_API_KEY` 已於本日設定於 Production／Preview／Development；兩項機密由使用者在後台自行輸入，Codex 僅補齊 Gemini 變數的適用環境，未讀取／輸出值。可選 `GEMINI_MODEL`、`GEMINI_VISION_MODEL`、`GEMINI_EMBEDDING_MODEL` 使用程式預設。重新部署 `dpl_BYkMy7gxa43cAgyfxMXqVbG9HREF`（來源 `main`／`16292dc`）Ready；正式網址 https://tku-app.vercel.app，未帶 token 的 POST `/api/chat` 與 `/api/timetable-import` 均實測 HTTP 401（不再是 503），`/login` 顯示登入表單。指定驗證 `npm ci`、`npx tsc -b`、lint、Vitest（21 files／112 tests）、build 全部通過；npm ci 回報 34 項依賴漏洞，未在本輪升級。正式站登入後上傳開發者提供的課表截圖，真實 Gemini 辨識成功，確認畫面顯示 11 門課／15 個合併時段；經濟學教師有 OCR 錯字，依圖片手動修正確認欄位，尚未按「加入」或寫入課程。此結果不代表辨識完全無誤或完整匯入成功。未實測真實聊天、未套用 migration／執行 ingest。僅改交接文件，未修改 `src/**` 或 `api/**`。
- `src/data/places.ts` 移除 `@/i18n` 依賴（`PLACE_CATEGORY_LABELS` 移到 `src/lib/labels.ts`），讓 `api/` 函式在 Vercel 的 Node 環境能載入；已用 esbuild 打包後在純 Node ESM 載入 `api/chat.ts`、`api/timetable-import.ts` 驗證
- **校園探索「我的位置」**：地圖右下角按鈕，按下才請求定位權限（`useMyLocation`，watchPosition、高精準度；每次按都重新定位並置中），地圖上顯示藍點＋誤差圈；離校園 >2 km 會顯示距離；拒絕/逾時/不支援/非 https 有對應說明；位置只在裝置上使用不上傳。`vercel.json` 的 Permissions-Policy 改為 `geolocation=(self)`（原本 `()` 會在正式網站封鎖定位）。e2e `e2e/geolocation.spec.ts` 6 項通過（桌面＋手機）
- **本機也能跑 API**：`vite-dev-api.ts`（只在 `npm run dev` 生效）把 `/api/chat`、`/api/timetable-import` 交給 `api/` 的 handler 執行，伺服器端金鑰從 `.env.local` 讀（`SUPABASE_SERVICE_ROLE_KEY`、`GEMINI_API_KEY`，不加 `VITE_`）；`SUPABASE_URL`/`SUPABASE_ANON_KEY` 預設沿用 `VITE_` 值。未設金鑰時回 503，App 照常走備援。已驗證：無金鑰 503、未登入 401、格式錯誤 400、App 頁面正常
- **課表圖片匯入**（取代 CSV 成為主要匯入；CSV 仍可從匯入視窗進入）：`ImageImport.tsx` 縮圖（長邊 2000px JPEG、去 EXIF）→ `POST /api/timetable-import`（Claude Code 依使用者要求撰寫於 `api/`，沿用 Codex 的 `readServerEnv`、`CampusStore` 驗證與 `ai_usage` 限流）→ Gemini `generateContent`（`inlineData` 圖片＋`responseSchema`、`store: false`）只回傳「每格」內容 → `src/lib/timetableImport.ts` 以程式合併連續節次（同教室）、同課名跨天合併、助教課不當授課教師、教室正規化（`B 217`→`B217`）、第 13–14 節（時間未查核）略過並提示 → 確認畫面可改名／教師、取消勾選、移除時段，標示同名課程（預設不加入）與衝堂，按確認才寫入。需登入；未部署時提示改用 CSV
- **在哪裡上課**：教室代碼後顯示大樓名稱（`roomWithBuilding`，例：`B217 · 商管大樓`），用於每日時間軸與圖片匯入確認畫面
- 修正 `Sheet`：focus effect 不再因 `onClose` 每次 render 改變而重跑（之前在確認畫面打字會被搶走焦點）
- **好友課表**（課表頁上方「我的課表｜好友」）：每人 8 碼好友代碼（無易混字元）＋邀請連結 `/schedule?tab=friends&code=XXXX`；送出/接受/拒絕/取消/移除好友；雙方接受後可看對方**相同學期代碼**的週課表（唯讀，不含備註）；「共同空堂」列出週一到週五第 1–12 節兩人都沒課的時段；可重新產生代碼。不提供以 Email/學號搜尋他人
- **二手市集**（`/market`、`/market/:id`）：出售/徵求、5 種分類、參考價格（空白=可議、0=免費；徵求顯示「預算」）、課號、物品狀況；搜尋與篩選（全部/出售/徵求/我的、分類、顯示已完成）；留言區自行約面交；刊登者可改狀態（刊登中/已保留/已完成）、編輯、刪除、刪除自己貼文下的留言；檢舉（每人每篇一次）；發文前需勾選交易提醒（不經手金錢、校內公開場所面交、禁止盜版/影印課本、禁止違禁品與代寫、勿公開個資）
- **底部導覽仍 5 格**：「探索」改名「校園」，頁首切換「地點｜活動｜市集」（`src/features/explore/CampusTabs.tsx`）；在 /events、/market 時「校園」保持選取
- 好友與市集需登入；訪客/本機模式顯示登入提示（`SignInRequired`）
- `DataRepository` 新增 `social: SocialApi | null`（`src/lib/social/`）；`LocalRepository` 為 null，`SupabaseRepository` 提供 `SupabaseSocial`
- 合併 Codex `feat/ai-backend`；前端呼叫 `/api/chat` 時帶 `lang`（介面語言）、`timezone: 'Asia/Taipei'`，並濾掉空白歷史訊息（後端 schema 要求非空）
- **Supabase 上線**：專案 `tku-campus-os`（ref `gqivwpmflnxlnotirqhe`，Tokyo）。`supabase/migrations/20261012000000_init.sql` 已在 SQL Editor 套用（17 表皆開 RLS）；advisor 修正：撤銷 `is_admin()` 的 anon/authenticated 執行權、補 8 個外鍵索引（已同步進 init.sql 並套用到線上）。Security advisor 剩：3 張「RLS 無 policy」（ai_usage、admin_audit_logs、knowledge_chunks，刻意只給 service role）與 `delete_my_account` 可被登入者呼叫（刻意）
- **「我的」帳號卡**：頁面最上方顯示暱稱與 Email，獨立的「登出」按鈕（與刪除帳號分開）；訪客顯示「訪客模式」與「登入或註冊」
- **預覽版從登入頁開始**：`build:preview` 會讀 `.env.local` 成為雲端模式，且每次開啟清除訪客旗標；選「先不登入」可看範例資料
- 本機 `.env.local` 已填 `VITE_SUPABASE_URL` 與 publishable key（git 忽略；只含公開金鑰）
- **登入頁重新設計**：上方即時淡江大橋像素場景（與首頁同天氣/日出日落資料）、登入/註冊分頁、註冊可填暱稱（寫入 `display_name`）、顯示/隱藏密碼、常見錯誤中英文訊息、忘記密碼
- **訪客模式**：雲端可用時，登入頁可選「先不登入，直接使用」→ 使用 LocalRepository（`localStorage` 旗標 `tku.guest`）；「我的」顯示「登入或註冊」入口；登入後自動結束訪客模式（訪客資料不會合併到帳號）。`useAuth()` 新增 `cloudAvailable`、`isGuest`、`continueAsGuest`
- 測試隔離：Vitest 與 Playwright 強制清空 `VITE_SUPABASE_*`，避免開發者的 `.env.local` 讓測試跑到雲端模式
- **全站中英文**：所有頁面、表單驗證、Toast、錯誤訊息、日期時間格式、本機 AI 助理（中英文問題皆可）；字典 `src/i18n/locales/`，key 一致性有測試把關
- **上課與截止提醒**：「我的」可開啟系統通知（上課前 5/10/15/30 分鐘、作業依各自設定）、測試通知；App 執行中有效
- **安全標頭**：vercel.json 加入 CSP、HSTS、COOP 等；移除 index.html 內嵌 script
- **無障礙**：axe WCAG 2.2 AA 掃描 9 頁 × 淺/深色全部通過（修正 About 連結、深色主色對比）
- 修正：學期名稱改由代碼即時產生（舊資料存中文名稱）；英文星期縮寫改兩個字母
- **淡江紅＋紅黑白品牌**：Primary #B3262D、Black #171717、White、Off White #FAF9F7；連結改為深淡江紅（`link` token，取代 `blue`）；`navy`/`blue` 只留給課程顏色；地圖標記、manifest、splash、meta theme-color 同步
- **首頁 Hero 改為淡江大橋動態像素場景**（`src/components/campus-scene/`）：晴天/多雲/雨天/夕陽/夜晚＋時間與天氣組合（例如雨夜）；雲、鳥、水面閃光與倒影、雨滴與漣漪、樹搖、大橋與建築燈光、星星；2.5 秒調色盤過渡
- **即時天氣**：`src/services/weatherService.ts`（Open-Meteo、8 秒逾時、快取最後有效資料）＋ `useCampusWeather`（20 分鐘更新、離線/逾時/過期處理）；`useTimeOfDay` 依 API 日出日落，離線時用 `src/lib/solar.ts` 計算
- **i18n**：i18next＋react-i18next；首頁問候、天氣、快捷操作、錯誤訊息中英文；「我的」可切換語言，並同步 `<html lang>`
- 首頁版面：Hero 全寬、左側問候、右側淡水天氣、Hero 下方快捷操作（下一堂課/今日課表/找教室/校園活動/待辦事項）；移除 Hero 內的 AI 輸入框（AI 在底部導覽）
- **改為純手機 App 版面**：移除桌面 Sidebar 與所有 `sm:/md:/lg:` 斷點；`.app-frame` 最大寬 480px 置中；Bottom sheet 限制在 App 寬度；週課表重新設計為手機可完整顯示（不需左右捲動）；課表預設單日檢視；「作業與考試」「活動與機會」快速入口移到「我的」；PWA `orientation: portrait`
- **標誌更換**為開發者提供的 TKU Campus OS 標誌（宮燈教室＋書卷＋TKU 字標）：產生 App Icon 192/512/maskable、apple-touch、favicon 32/48、介面用 logo-128/256/512；原始檔放 `design/brand/`；移除舊的 SVG 標誌檔
- 主題色由淡江藍改為宮燈紅：新增 `primary` token；首頁歡迎區改紅色系天色；Logo/Icon/Favicon/Splash/manifest theme_color 改紅底＋金色宮燈
- 新增 Splash Screen、`public/brand/` light/dark logo
- 新增忘記密碼（登入頁）與 `/reset-password` 頁
- 修正：學期載入前首頁/課表會閃現空狀態（SemesterProvider 改為載入完成才渲染）
- 新增 React Testing Library 元件測試與 Playwright E2E

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
- Claude Code iOS 鍵盤高度（2026-10-15）：lint ✅、Vitest 26 files／126 tests ✅、Playwright 132 passed ✅。Simulator iPhone 17 Pro 重現問題 ✅；修正部署後的模擬器驗證見下一筆紀錄。
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
- **Codex（api，使用者截圖 2026-10-14）**：正式站問「明天第一堂課在哪裡？」回「目前無法產生回答，請稍後再試。」——此句是 `api/gemini.ts` 在已呼叫工具（有 sources）但最後串流沒有任何文字時的備援。推測：最後一次 `streamGenerateContent` 沒帶 `tools`，但對話內含 functionCall／functionResponse，模型仍想呼叫工具而回空（或回傳只有 thought）。建議：(1) 第一輪 `generateContent` 若已有文字且無 function call，直接用該文字回應，不再多打一次串流；(2) 最後串流請求帶同樣 `tools` 並設 `toolConfig.functionCallingConfig.mode = 'NONE'`；(3) 記錄 `finishReason`（不含內容）方便查 Vercel logs。Claude Code 因裝置連線中斷未能查看 Vercel 執行紀錄。
- **開發者／Claude Code**：行事曆分支已依使用者授權合併並正式部署。私人行程 migration 已套用，勿重複建立表；真人登入後驗證雲端 CRUD，重新上傳截圖核對教師／助教，再由使用者確認加入。舊課程中已合併的正課／助教資料不會自動重建，需核對原圖。單日完整小時格已撤回，不要實作。後續可加私人行程提醒／.ics／可信校曆。誤建 `AGEMINI_API_KEY` 可由開發者自行刪除，保留正確 `GEMINI_API_KEY`。
- **Claude Code**：前端圖片匯入隱私提示改成「圖片會傳給 Google Gemini 辨識」；`ARCHITECTURE.md` 的 AI provider 文案與 `AGENTS.md` 的目前 Codex 分支可同步更新（本輪遵守範圍未修改）。
- **開發者**：合併 `feat/gemini` 後，設定伺服器端 Gemini/Supabase 環境變數，再登入實測真實問答與圖片課表辨識。執行 `npm run ingest` 重建 Gemini vectors，不能沿用舊 OpenAI vectors；免費額度以 Google 專案總用量計算。
- **Codex**：`api/timetable-import.ts` 由 Claude Code 新增（使用者要求），之後可由 Codex 維護。`feat/ai-backend` 已合併進 `main`；之後請從最新 `main` 開新分支。可補：好友/市集的 pgTAP RLS 測試（`supabase/tests/`）、市集檢舉的管理端 API
- **Claude Code（main）**：市集照片上傳（Supabase Storage）、好友邀請通知；重跑 e2e 並新增好友/市集 e2e（需模擬 Supabase）
- **Claude Code（main）**：活動管理後台 UI（需 Codex 的 admin API）、Capacitor 打包 iOS/Android（待開發者決定）
- **開發者**：決定 Email 驗證策略（關閉或自訂 SMTP）；部署後在 Supabase Auth 設定 Site URL 與 Redirect URLs；建立 GitHub repo；Vercel 環境變數填 `VITE_SUPABASE_URL`、`VITE_SUPABASE_ANON_KEY`（publishable key）
- **開發者**：在 Supabase SQL Editor 套用 `supabase/migrations/20261012080231_ai_backend_security.sql`；在 Vercel 設定 `SUPABASE_URL`、`SUPABASE_ANON_KEY`、`SUPABASE_SERVICE_ROLE_KEY`、`GEMINI_API_KEY`（以及可選 Gemini 模型/限流變數），再驗證線上 `/api/chat` 與執行 RLS SQL。

## Git Status
- Branch：`codex/schedule-session-labels`；基底 main／origin/main `4c02535`，發布前已查核遠端。原工作目錄維持 main。
- Commits：… → `feat(auth): redesigned login with guest mode` → `feat(profile): account card with sign out…` → `docs: record live Supabase auth and RLS verification` → `feat: friend timetable sharing and second-hand market` → merge `feat/ai-backend`（Codex：AI chat backend、ingest hardening、handoff）→ `feat(ai): send UI language to /api/chat`
- Worktree：`../tkuApp-codex`（`codex/schedule-session-labels`）；只在此處修改新前端。
- Remote：`origin`（GitHub `bryankccy-glitch/tkuApp`）；2026-10-14 使用者明確授權合併部署，已 fast-forward 並一般推送 main。保留 feature worktree，不刪除其他工作。

## Important Notes
- 不可要求或儲存淡江校務系統帳密；不可爬取受限制校務資料
- 不可宣稱為淡江官方 App；不可使用淡江校徽
- Secrets 不得寫入 Git / HANDOFF
