# Roadmap

狀態：✅ 完成 ｜ 🟡 部分完成 ｜ ⬜ 未開始

## Phase 0 — 專案初始化 ✅
HANDOFF / AGENTS / README / ROADMAP / ARCHITECTURE / .env.example

## Phase 1 — 品牌與 Design System ✅
- ✅ 色彩 tokens（主題色：宮燈紅）、字級、深色模式、Logo（light/dark）、App Icon、Favicon、Splash、Loading mark、空狀態插畫
- ✅ 手機 App 版面＋底部導覽（桌面 Sidebar 已依開發者決定移除）
- ⬜ 查核淡江官方品牌規範；若取得授權再調整色彩

## Phase 2 — 基礎平台 🟡
- ✅ React + TS + Vite、Routing、Supabase client、Email 登入/註冊、Profiles
- ✅ Migration（全部核心資料表）+ RLS + Seed
- ⬜ 在真實 Supabase 專案套用 migration 並驗證（需專案金鑰）
- ✅ 忘記密碼與重設密碼頁（待 Supabase 實測）

## Phase 3 — 學習中心 🟡
- ✅ Dashboard（真實資料）、課表 CRUD、節次、衝突檢測、CSV 匯入匯出、學期切換、課程詳情
- ✅ 作業/考試 CRUD、今日/本週/即將截止/逾期/已完成、`.ics` 提醒
- ✅ 上課與截止提醒（系統通知，App 執行中有效）
- ⬜ 伺服器端 Web Push（App 關閉時也能提醒，使用 `notification_preferences`）
- ⬜ 課程目錄（`courses`）搜尋並加入課表

## 首頁像素場景 ✅
- ✅ 淡江大橋 Pixel Art 動畫（晴/多雲/雨/夕陽/夜晚＋組合）、Open-Meteo 即時天氣、日出日落切換、reduced motion
- ⬜ 查核淡江大橋塔身輪廓與索面；雷雨閃電效果（目前刻意不做以免過度刺激）

## Phase 4 — 校園探索 🟡
- ✅ 建築代碼搜尋、分類、教室→建築對應、Google 地圖導航、OSM 地圖
- ✅ 活動頁：搜尋、分類、日期、收藏、詳情、報名連結、分享、行事曆匯出
- ⬜ 逐筆查核建築名稱與座標（目前來源為學生整理）
- ⬜ 活動管理後台（admin 角色，寫入 `admin_audit_logs`）

## Phase 5 — AI 校園助理 🟡
- ✅ 聊天 UI（串流、Markdown、來源卡片、快捷問題、重試、複製、清除）
- ✅ 本機助理（規則式，不需 API Key）
- ⬜ `/api/chat`：JWT 驗證、速率限制、Tool calling、RAG、對話紀錄 —— **Codex 進行中（feat/ai-backend）**
- ⬜ 知識庫匯入腳本（官方文件 → pgvector）

## Phase 6 — 正式 MVP ⬜
- ✅ Vitest 單元＋元件測試（39 項）、Playwright E2E（36 項，桌面＋手機）
- ⬜ RLS 測試（Codex）、登入/登出 E2E（需 Supabase）
- ✅ CSP 與安全標頭（vercel.json）、WCAG 2.2 AA 自動檢測（axe，9 頁 × 淺色/深色）
- ⬜ Vercel 部署、效能檢查、Beta 測試

## i18n ✅
- ✅ 全部頁面中英文（建築名稱、官方文件標題、CSV 格式維持中文）；本機 AI 助理理解中英文問題
- ⬜ 雲端 AI（Codex）回答語言跟隨介面語言

## Phase 7 — Super App ⬜
校園社群、社團討論、揪團、二手書/二手物品（須先完成防詐、檢舉封鎖、審核、個資保護設計）、職涯中心、個人化推薦、AI 行程規劃、跨校架構。

## 待查核清單
- 淡江官方品牌色碼與識別使用規範
- 夜間第 13、14 節時間
- 學期起訖日（目前以 8/1、2/1 推估）
- 淡江大橋塔身輪廓、單/雙索面
- 各建築精確座標；T＝「驚聲紀念大樓」名稱
- 官方文件內文（請假規則、學生手冊）尚未匯入知識庫
