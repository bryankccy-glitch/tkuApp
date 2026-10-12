# TKU Campus OS — Development Handoff

## Last Updated
2026-10-12 22:15（Asia/Taipei, UTC+8）

## Updated By
Claude Code（合併 Codex `feat/ai-backend`）

## Current Status
前端 MVP 可用，Supabase 專案 `tku-campus-os` 已上線（註冊/登入/RLS 已以真實帳號驗證）。新增**好友課表**與**二手市集**（資料表已套用並以真實帳號驗證）。Codex 的 AI 後端（`feat/ai-backend`）已合併進 `main`；其 migration `20261012080231_ai_backend_security.sql` **尚未套用到線上資料庫**，`/api/chat` 尚未部署（需 Vercel 伺服器端環境變數）。

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
- **部署設定**：GitHub `bryankccy-glitch/tkuApp`（private）＋ Vercel 專案 `tku-app`（team CampusHub，已連 GitHub 自動部署）。`vercel.json` 固定 framework=vite、`npm ci`、`npm run build`、輸出 `dist`；新增 `.env.production`（只含公開的 Supabase URL 與 publishable key，供正式建置；`.gitignore` 例外放行）。伺服器端 `SUPABASE_URL`、`SUPABASE_ANON_KEY`、`SUPABASE_SERVICE_ROLE_KEY`、`OPENAI_API_KEY` 需在 Vercel 後台設定
- `src/data/places.ts` 移除 `@/i18n` 依賴（`PLACE_CATEGORY_LABELS` 移到 `src/lib/labels.ts`），讓 `api/` 函式在 Vercel 的 Node 環境能載入；已用 esbuild 打包後在純 Node ESM 載入 `api/chat.ts`、`api/timetable-import.ts` 驗證
- **校園探索「我的位置」**：地圖右下角按鈕，按下才請求定位權限（`useMyLocation`，watchPosition、高精準度；每次按都重新定位並置中），地圖上顯示藍點＋誤差圈；離校園 >2 km 會顯示距離；拒絕/逾時/不支援/非 https 有對應說明；位置只在裝置上使用不上傳。`vercel.json` 的 Permissions-Policy 改為 `geolocation=(self)`（原本 `()` 會在正式網站封鎖定位）。e2e `e2e/geolocation.spec.ts` 6 項通過（桌面＋手機）
- **本機也能跑 API**：`vite-dev-api.ts`（只在 `npm run dev` 生效）把 `/api/chat`、`/api/timetable-import` 交給 `api/` 的 handler 執行，伺服器端金鑰從 `.env.local` 讀（`SUPABASE_SERVICE_ROLE_KEY`、`OPENAI_API_KEY`，不加 `VITE_`）；`SUPABASE_URL`/`SUPABASE_ANON_KEY` 預設沿用 `VITE_` 值。未設金鑰時回 503，App 照常走備援。已驗證：無金鑰 503、未登入 401、格式錯誤 400、App 頁面正常
- **課表圖片匯入**（取代 CSV 成為主要匯入；CSV 仍可從匯入視窗進入）：`ImageImport.tsx` 縮圖（長邊 2000px JPEG、去 EXIF）→ `POST /api/timetable-import`（Claude Code 依使用者要求撰寫於 `api/`，沿用 Codex 的 `readServerEnv`、`CampusStore` 驗證與 `ai_usage` 限流）→ OpenAI Responses API（圖片＋strict JSON schema、`store: false`）只回傳「每格」內容 → `src/lib/timetableImport.ts` 以程式合併連續節次（同教室）、同課名跨天合併、助教課不當授課教師、教室正規化（`B 217`→`B217`）、第 13–14 節（時間未查核）略過並提示 → 確認畫面可改名／教師、取消勾選、移除時段，標示同名課程（預設不加入）與衝堂，按確認才寫入。需登入；未部署時提示改用 CSV
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
- 圖片匯入測試：`src/lib/__tests__/timetableImport.test.ts`（以開發者提供的真實淡江課表截圖逐格轉錄為 fixture：11 門課、節次與時間正確）、`api/timetable-import.test.ts`、`src/features/schedule/__tests__/ImageImport.test.tsx`；以真實截圖上傳＋模擬 API 截圖檢查，axe 0 violations。**尚未用真實 OpenAI 模型辨識**（需部署與 `OPENAI_API_KEY`）
- 目前 `npm run test` ✅ 21 files / 103 tests、lint ✅、typecheck ✅、build ✅
- ⚠ 尚未重跑 `npm run test:e2e`（上一輪 118 passed；本輪底部導覽「探索」改名「校園」，e2e 未依名稱尋找該連結）
- 未執行：自動化 RLS 測試（Codex `supabase/tests/`）；重設密碼流程（雲端工作區無法連 supabase.co；Email 驗證信限制見 Known Issues）

## Known Issues
- 淡江大橋塔身輪廓與單/雙索面待查核（目前為詮釋）
- Artifact 預覽環境無法連線 Open-Meteo，會顯示「暫時無法取得天氣」（實際部署正常）
- 重設密碼信件流程尚未實測（需 Site URL 與寄信服務）
- Supabase Auth 已關閉「Confirm email」（開發者 2026-10-12 決定）：註冊後可立即登入，但 Email 未驗證；正式上線前建議接自訂 SMTP 再開回驗證
- Supabase Auth 的 Site URL / Redirect URLs 尚未設定（驗證與重設密碼連結會導回預設 localhost:3000）；部署網址確定後要加入
- 建築代碼來源為學生整理、座標未查核；T 棟名稱待核對
- 淡江官方品牌規範未找到公開來源；紅色主題與標誌為開發者指定
- 新標誌細節多，favicon（32px）較難辨識；可考慮另做簡化版小圖示
- 預覽版（Artifact）無法顯示 OSM 地圖底圖、無法下載 CSV/.ics
- npm audit 有建置工具鏈警告，尚未處理

## Next Steps
- **Codex**：`api/timetable-import.ts` 由 Claude Code 新增（使用者要求），之後可由 Codex 維護。`feat/ai-backend` 已合併進 `main`；之後請從最新 `main` 開新分支。可補：好友/市集的 pgTAP RLS 測試（`supabase/tests/`）、市集檢舉的管理端 API
- **Claude Code（main）**：市集照片上傳（Supabase Storage）、好友邀請通知；重跑 e2e 並新增好友/市集 e2e（需模擬 Supabase）
- **Claude Code（main）**：活動管理後台 UI（需 Codex 的 admin API）、Capacitor 打包 iOS/Android（待開發者決定）
- **開發者**：決定 Email 驗證策略（關閉或自訂 SMTP）；部署後在 Supabase Auth 設定 Site URL 與 Redirect URLs；建立 GitHub repo；Vercel 環境變數填 `VITE_SUPABASE_URL`、`VITE_SUPABASE_ANON_KEY`（publishable key）
- **開發者**：在 Supabase SQL Editor 套用 `supabase/migrations/20261012080231_ai_backend_security.sql`；在 Vercel 設定 `SUPABASE_URL`、`SUPABASE_ANON_KEY`、`SUPABASE_SERVICE_ROLE_KEY`、`OPENAI_API_KEY`（以及可選模型/限流變數），再驗證線上 `/api/chat` 與執行 RLS SQL。

## Git Status
- Branch：`main`
- Commits：… → `feat(auth): redesigned login with guest mode` → `feat(profile): account card with sign out…` → `docs: record live Supabase auth and RLS verification` → `feat: friend timetable sharing and second-hand market` → merge `feat/ai-backend`（Codex：AI chat backend、ingest hardening、handoff）→ `feat(ai): send UI language to /api/chat`
- Worktree：`../tkuApp-codex`（`feat/ai-backend`，已合併；git 顯示 prunable）
- 尚未設定 remote

## Important Notes
- 不可要求或儲存淡江校務系統帳密；不可爬取受限制校務資料
- 不可宣稱為淡江官方 App；不可使用淡江校徽
- Secrets 不得寫入 Git / HANDOFF
