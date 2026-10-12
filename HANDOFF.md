# TKU Campus OS — Development Handoff

## Last Updated
2026-10-12 16:40（Asia/Taipei, UTC+8）

## Updated By
Claude Code

## Current Status
前端 MVP 可用（本機模式完整可操作），主題色已改為紅色。雲端模式程式完成但**尚未連接真實 Supabase 驗證**。AI 後端 `/api/chat` 由 Codex 在 `feat/ai-backend` 進行中。

## Completed
- 專案骨架：Vite 6 + React 18 + TS strict + Tailwind 3 + React Router 6 + TanStack Query 5 + RHF + Zod + PWA
- Design System：tokens（主題色 `primary` = 宮燈紅 #A84643）、深色模式、字級、Logo（含 light/dark SVG）、App Icon、Favicon、Splash Screen、Loading、空狀態插畫、宮燈拱廊帶
- 導覽：手機底部 5 格、桌面 Sidebar、skip link、focus 樣式
- 資料層：`DataRepository` ＋ `LocalRepository` ＋ `SupabaseRepository`
- 首頁、課表（CRUD/節次/衝突/週檢視/學期/CSV/詳情）、作業考試、校園探索、活動、AI 助理 UI（本機引擎）、我的、登入/註冊、**忘記密碼與重設密碼**、關於與隱私
- Supabase migration（16 核心表＋ai_usage、RLS、觸發器、函式）與開發 seed
- 預覽版建置 `npm run build:preview`（範例資料、hash routing）
- 測試：Vitest 單元＋元件測試 39 項；Playwright E2E 36 項（桌面＋手機）

## Latest Changes
- 主題色由淡江藍改為宮燈紅：新增 `primary` token；首頁歡迎區改紅色系天色；Logo/Icon/Favicon/Splash/manifest theme_color 改紅底＋金色宮燈
- 新增 Splash Screen、`public/brand/` light/dark logo
- 新增忘記密碼（登入頁）與 `/reset-password` 頁
- 修正：學期載入前首頁/課表會閃現空狀態（SemesterProvider 改為載入完成才渲染）
- 新增 React Testing Library 元件測試與 Playwright E2E

## Files Changed
- 樣式/品牌：`src/styles/index.css`、`tailwind.config.js`、`src/components/brand/*`、`src/components/layout/AppShell.tsx`、`src/features/dashboard/Hero.tsx`、`index.html`、`vite.config.ts`、`public/favicon.svg`、`public/icons/*`、`public/brand/*`、`docs/DESIGN_SYSTEM.md`
- 全部 `src/**/*.tsx` 中 `*-navy` class 改為 `*-primary`
- 認證：`src/features/auth/LoginPage.tsx`、`src/features/auth/ResetPasswordPage.tsx`、`src/app/router.tsx`
- 資料：`src/app/SemesterProvider.tsx`、`src/app/AuthProvider.tsx`（新增 `localRepository` prop 供測試注入）
- 測試：`src/test/*`、`src/features/**/__tests__/*`、`e2e/*`、`playwright.config.ts`、`tsconfig.node.json`、`package.json`（`test:e2e`）

## Database & API Changes
本次無。`/api/chat` 合約見 `api/README.md`（Codex 實作中）。

## Technical Decisions
- 主題色 token 命名為 `primary`；`navy` 保留為輔助色；課程顏色 key `navy` 不變（資料相容）
- 紅底上的宮燈改為金色 #F2C46B 以保持辨識度
- E2E 預設使用 `npx playwright install chromium` 安裝的瀏覽器；可用 `PW_CHROMIUM_PATH` 指定
- 其餘見 ARCHITECTURE.md

## Tests
執行於 Claude 雲端工作區（Node 22.22）：
- `npm run lint` ✅
- `npm run typecheck` ✅
- `npm run test` ✅ 11 files, 39 tests
- `npm run build` ✅
- `npm run test:e2e` ✅ 36 passed（desktop 1360×900、mobile Pixel 7）：主要流程、衝突、待辦、CSV 匯入、探索、AI 來源、深色模式、8 頁無水平捲動、導覽 RWD、PWA manifest＋service worker、skip link
- 未執行：RLS 測試、登入/登出與重設密碼的實際流程（需 Supabase 專案）

## Known Issues
- 雲端模式（登入、重設密碼、RLS）尚未在真實 Supabase 專案驗證
- 建築代碼來源為學生整理、座標未查核；T 棟名稱待核對
- 淡江官方品牌規範未找到公開來源；紅色主題為開發者指定的設計提案
- 預覽版（Artifact）無法顯示 OSM 地圖底圖、無法下載 CSV/.ics
- npm audit 有建置工具鏈警告，尚未處理

## Next Steps
- **Codex（feat/ai-backend）**：`api/chat.ts`、`scripts/ingest.ts`、RLS 測試（只改 `api/`、`scripts/`、`supabase/tests/`、新增 migration）。⚠ `main` 已更新，開始前請 `git rebase main` 或在合併時處理
- **Claude Code（main）**：Web Push 課前提醒、活動管理後台 UI（需 Codex 的 admin API）、i18n 架構（英文介面預留）
- **開發者**：建立 Supabase 專案並套用 migration；建立 GitHub repo；提供 Vercel 環境變數

## Git Status
- Branch：`main`
- Commits：`feat: initial TKU Campus OS MVP` → `feat: add hosted preview build with example data` → `feat: red theme, splash, password reset, component and e2e tests`
- 未提交修改：無
- Worktree：`../tkuApp-codex`（`feat/ai-backend`，Codex）
- 尚未設定 remote

## Important Notes
- 不可要求或儲存淡江校務系統帳密；不可爬取受限制校務資料
- 不可宣稱為淡江官方 App；不可使用淡江校徽
- Secrets 不得寫入 Git / HANDOFF
