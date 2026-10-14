# Changelog

## 2026-10-14 — Codex：正式發布
- 使用者要求合併部署後，將 `codex/schedule-session-labels` fast-forward 合併 main、一般推送 GitHub 並部署正式站；月／年檢視、教師標示、未登入 API 401 實測成功。
- 發布前 lint、typecheck、121 個單元測試、build、132 個 E2E 全通過；既有依賴漏洞未在本輪修復。

## 2026-10-14 — Codex：前端需求調整
- 使用者授權 Codex 另開前端分支，正課／助教標示與月／年学生行事曆改由 Codex 實作，不再僅列為 Claude Code 待辦。
- 使用者先提出、後撤回單日完整小時格；未發布该版面，保留原單日時間軸，HANDOFF 舊待辦已更新。

## 2026-10-12 — Claude Code
- 首次建立專案：Design System、Dashboard、課表、作業考試、校園探索、活動、AI 助理 UI（本機引擎）、個人中心、Supabase schema 與 RLS。

## 2026-10-12（下午）— Claude Code
- 主題色改為宮燈紅；Splash、light/dark logo；忘記密碼；RTL 元件測試與 Playwright E2E；修正學期載入閃爍。
- 標誌更換為開發者提供的 TKU Campus OS 標誌。
- 改為純手機 App 版面，移除桌面 Sidebar；週課表手機版重新設計。
- 品牌改為紅黑白（淡江紅 #B3262D）；首頁改為淡江大橋像素動畫＋Open-Meteo 即時天氣；新增 i18next 中英文切換。
- 全站英文介面；上課與截止通知提醒；CSP 與安全標頭；axe 無障礙自動檢測並修正。
