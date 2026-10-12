# TKU Campus OS — Development Handoff

## Last Updated
2026-10-12 16:20（Asia/Taipei, UTC+8）

## Updated By
Claude Code

## Current Status
Phase 0–1 完成；Phase 2–5 前端 MVP 可用（本機模式可完整操作）。雲端模式程式已完成，但**尚未連接真實 Supabase 專案驗證**。AI 後端 `/api/chat` 尚未實作（已交給 Codex）。

## Completed
- 專案骨架：Vite 6 + React 18 + TypeScript strict + Tailwind 3 + React Router 6 + TanStack Query 5 + RHF + Zod + PWA
- Design System：tokens、深色模式、字級、Logo/Icon/Favicon、Loading、空狀態插畫、宮燈拱廊帶（見 docs/DESIGN_SYSTEM.md）
- 導覽：手機底部 5 格（AI 中央浮起）、桌面 Sidebar、skip link、focus 樣式
- 資料層：`DataRepository` 介面＋ `LocalRepository`（localStorage）＋ `SupabaseRepository`（RLS）
- 首頁 Dashboard：時段天色歡迎區、AI 快捷提問、下一堂課（倒數/教室/教師/位置/.ics 提醒）、今日時間軸、本週待辦與考試、活動、常用服務
- 課表：CRUD、多時段、節次選擇（1–12 節，已查核）、衝突檢測（表單即時＋課表紅框）、週課表/單日、學期切換與新增、CSV 匯入（含錯誤列報告）/匯出（防公式注入）、課程詳情
- 作業與考試：CRUD、6 種類型、優先度、提醒設定、6 種篩選、完成/復原、.ics 提醒
- 校園探索：29 個建築代碼、搜尋（含教室→建築）、分類、OSM 地圖（只標校園中心）、Google 地圖導航、來源與查核狀態
- 活動頁：搜尋/分類/日期/收藏/詳情/報名/分享/行事曆（資料來自 Supabase `campus_events`）
- AI 助理 UI：串流、Markdown、來源卡片、快捷問題、停止、重試、複製、清除；本機規則式助理
- 我的：個人資料、主題、資料匯出 JSON、刪除帳號/資料、登出、回饋（雲端）
- 登入/註冊頁（Supabase Email+密碼）、關於與隱私頁、404
- Supabase migration：16 張核心表＋ `ai_usage`、RLS、觸發器、`is_admin()`、`match_knowledge_chunks()`、`delete_my_account()`；`seed.sql`（開發用）

## Latest Changes
首次建立整個專案（見 Completed）。

## Files Changed
全部為新檔案。主要目錄：`src/app`、`src/components`、`src/features/*`、`src/lib`、`src/data`、`supabase/`、`public/`、`docs/`、`api/README.md`。

## Database & API Changes
- `supabase/migrations/20261012000000_init.sql`：profiles, semesters, courses, user_courses, schedule_entries, tasks, campus_places, campus_events, event_bookmarks, knowledge_documents, knowledge_chunks(vector 1536), ai_conversations, ai_messages, ai_usage, feedback, notification_preferences, admin_audit_logs
- 角色只能由 service role 變更（trigger `protect_profile_role`）
- API：`/api/chat` 合約已定義於 `api/README.md`，**尚未實作**

## Technical Decisions
- 未設定 Supabase → 本機模式（不需登入）；已設定 → 必須登入
- `/api/chat` 回 503/404 或非 SSE 時，前端自動改用本機助理
- 地圖不捏造座標：建築 `coords: null`，導航用 Google Maps 名稱搜尋
- 提醒以 .ics（VALARM）實作；Web Push 列入 Roadmap
- `tailwind-merge` 已註冊自訂字級（`src/lib/cn.ts`），新增字級需同步
- ESLint：關閉 `react-refresh/only-export-components`；允許字串中的全形空白
- 詳見 ARCHITECTURE.md

## Tests
執行於 Claude 雲端工作區（Node 22.22）：
- `npm run lint` ✅ 0 problems
- `npm run typecheck` ✅
- `npm run test` ✅ 5 files, 26 tests（schedule/conflicts、csv、tasks、LocalRepository CRUD、本機 AI 助理）
- `npm run build` ✅（PWA precache 32 entries）
- 以 Playwright 截圖檢查首頁（手機/桌面）、課表、AI、探索：版面正常。發現並修正「新增課程」按鈕文字消失（tailwind-merge 字級衝突）
- 未執行：RTL 元件測試、Playwright E2E、RLS 測試（需 Supabase）

## Known Issues
- 雲端模式（SupabaseRepository、登入、RLS）尚未在真實 Supabase 專案驗證
- 建築代碼來源為學生社群整理；建築座標未查核；T 棟名稱「驚聲」待核對
- 淡江官方品牌色/CIS 未找到公開來源，目前為設計提案色
- npm audit：建置工具鏈有已知漏洞警告（dev 依賴為主），尚未處理
- 活動收藏在本機模式存於 localStorage
- 課表週視圖在手機上需水平捲動（手機預設為單日視圖）

## Next Steps
- **Codex（feat/ai-backend，worktree ../tkuApp-codex）**：實作 `api/chat.ts`（JWT、速率限制、tools、RAG、SSE、對話紀錄）、`scripts/ingest.ts`、RLS 測試。只改 `api/`、`scripts/`、`supabase/tests/`、新增 migration
- **Claude Code（main）**：RTL 元件測試與 Playwright E2E、忘記密碼流程、Web Push 提醒、活動管理後台、Splash Screen
- **開發者**：建立 Supabase 專案並套用 migration；提供 Vercel/Supabase 環境變數；建立 GitHub repo 並 push

## Git Status
- Branch：`main`
- Commit：`feat: initial TKU Campus OS MVP`（首次 commit）
- 未提交修改：無
- 尚未設定 remote（GitHub repo 待建立）

## Important Notes
- 不可要求或儲存淡江校務系統帳密；不可爬取受限制校務資料
- 不可宣稱為淡江官方 App；不可使用淡江校徽
- Secrets 不得寫入 Git / HANDOFF
