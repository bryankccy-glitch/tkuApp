# TKU Campus OS 淡江智慧校園

**One Campus. One OS.** — 淡江學生的課表、作業考試、校園探索與 AI 校園助理。

> 學生自主開發的第三方平台，**非淡江大學官方 App**。不會要求校務系統帳號密碼。

## 功能（MVP）
- 首頁：依時段變化的歡迎區、下一堂課倒數、今日課表時間軸、本週待辦與考試、活動與常用服務
- 課表：新增/編輯/刪除、淡江節次 1–12、衝突檢測、週課表/單日、學期切換、CSV 匯入匯出、課程詳情
- 作業與考試：CRUD、篩選（今日/本週/即將截止/逾期/已完成）、`.ics` 提醒
- 校園探索：建築代碼搜尋（輸入 E304 會找到工學大樓）、分類、地圖、Google 地圖導航
- 活動與機會：搜尋、分類、日期、收藏、報名連結、分享、加入行事曆
- AI 校園助理：串流、Markdown、來源卡片；未設定 API 時使用本機助理
- 我的：個人資料、深淺色、資料匯出、刪除帳號/資料
- 首頁淡江大橋像素動畫（依淡水即時天氣與日出日落變化）
- 上課與截止提醒（系統通知）
- 繁體中文／English 切換
- PWA 可安裝、深色模式、手機 App 版面

## 快速開始
```bash
npm install
npm run dev          # http://localhost:5173 ，未設定 Supabase 時為「本機模式」
```

## 指令
| 指令 | 說明 |
|---|---|
| `npm run dev` | 開發伺服器 |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript strict |
| `npm run test` | Vitest |
| `npm run build` | 正式建置（含 PWA） |
| `npm run test:e2e` | Playwright E2E（第一次先執行 `npx playwright install chromium`） |
| `npm run build:preview` | 預覽版（範例資料，可放到靜態空間展示） |

## 部署（Vercel + Supabase）
1. **Supabase**：建立專案 → SQL Editor 依序執行 `supabase/migrations/*.sql`（或 `supabase db push`）。開發環境可再執行 `supabase/seed.sql`。Authentication → URL Configuration 加入你的網域。
2. **管理員**：在 SQL Editor 以 service role 執行 `update profiles set role='admin' where id='<user uuid>';`（使用者無法自行升級）。
3. **Vercel**：匯入 GitHub repo（Framework：Vite）。設定環境變數（見 `.env.example`）：
   - 前端：`VITE_SUPABASE_URL`、`VITE_SUPABASE_ANON_KEY`
   - 伺服器：`SUPABASE_URL`、`SUPABASE_ANON_KEY`、`SUPABASE_SERVICE_ROLE_KEY`、`OPENAI_API_KEY`、`OPENAI_MODEL`、`OPENAI_EMBEDDING_MODEL`、`AI_RATE_LIMIT_PER_MINUTE`
4. Deploy。`vercel.json` 已設定 SPA rewrite 與安全標頭。

⚠ Service Role Key 與 OpenAI Key 只能設為伺服器端變數，**不可**加 `VITE_` 前綴。

## 文件
- `HANDOFF.md` 開發交接（每次工作前後必讀/更新）
- `AGENTS.md` AI 協作規則與分工
- `ARCHITECTURE.md` 架構與決策
- `docs/DESIGN_SYSTEM.md` 設計系統
- `ROADMAP.md` 路線圖與待查核清單
- `api/README.md` `/api/chat` 介面合約

## 資料來源
節次時間：淡江德文系 113-1 課程表；建築代碼：學生社群整理（待核對）；校園位置：Wikipedia；地圖：© OpenStreetMap contributors。詳見 App 內「關於與隱私」。
