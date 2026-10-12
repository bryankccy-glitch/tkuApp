# TKU Campus OS Design System

> 色彩為**產品設計提案**，不是淡江大學官方標準色。2026-10-12 搜尋未找到淡江公開的品牌識別規範（CIS），待查核。

## 視覺概念：宮燈拱廊
- **主識別**：開發者提供的 TKU Campus OS 標誌（宮燈教室建築與書卷曲線）。首頁歡迎區底部的「拱廊帶」（`Colonnade`，金色宮燈）延續相同建築意象。
- **書卷曲線**：用在空狀態插畫（`ScrollIllustration`）與 Logo 底部波線。
- **淡水天空**：首頁歡迎區以宮燈紅為底，依時段切換色調（清晨/白天/黃昏/夜晚），不使用天氣資料。
- 一次只讓一個元素突出：首頁的拱廊帶。其他區塊保持安靜、資訊清楚。

## 色彩 tokens（`src/styles/index.css`，Tailwind 名稱）
| Token | Light | 用途 |
|---|---|---|
| `primary` | #A84643 Heritage Red（**主題色**，2026-10-12 依開發者指示改為紅色） | 主要按鈕、導覽選取、首頁歡迎區、Logo、App Icon、啟動畫面 |
| `heritage` | #A84643 | 強調：目前狀態、考試、今天標記（與主題色同色系） |
| `navy` | #15345A TKU Navy | 輔助色（保留供資訊視覺化、地圖等使用） |
| `blue` | #3478C8 Campus Blue | 連結、Focus ring |
| `canvas` | #F8F6F1 Warm Ivory | 頁面背景 |
| `surface` | #FFFFFF Cloud White | 卡片、面板 |
| `sunken` | #E9EDF2 Soft Gray | 次要底色、segmented control |
| `ink` | #253244 Slate Text | 主要文字 |
| `muted` / `line` | — | 次要文字 / 分隔線 |
| `success` `warning` `danger` | — | 狀態 |
深色模式在 `[data-theme='dark']` 重新定義同名 tokens；所有元件只使用 tokens。

課程顏色（7 色）在 `src/lib/labels.ts` 的 `COURSE_COLOR_STYLES`：淡江藍、校園藍、宮燈紅、淡水綠、夕照橘、暮色紫、石板灰。

## 字體
Inter（英數）＋ Noto Sans TC（中文），系統字型 fallback。數字使用 `.tabular`。
| Token | Size / Line-height |
|---|---|
| `text-display` | 36 / 1.15 bold |
| `text-h1` | 28 / 1.25 bold |
| `text-h2` | 22 / 1.3 |
| `text-h3` | 18 / 1.4 semibold |
| `text-body-lg` | 17 / 1.65 |
| `text-body` | 15 / 1.6 |
| `text-caption` | 13 / 1.45 |
| `text-label` | 12 / 1.3 semibold |
⚠ 自訂字級已註冊到 `tailwind-merge`（`src/lib/cn.ts`），新增字級時要一併加入，否則會蓋掉文字顏色。

## 形狀與層次
圓角依層級：`xs`(6) 小標籤/按鈕內、`sm`(10) 按鈕/輸入/列表、`md`(14)、`lg`(20) 主要卡片、`xl`(28) bottom sheet。
不是所有區塊都是卡片：今日課表用時間軸、活動用分隔線列表、待辦用帶邊框面板，只有「下一堂課」使用陰影（`shadow-lift`）。

## 版面與導覽（App 版面，2026-10-12 起）
- **只有手機版面**：所有螢幕尺寸都使用同一個 App 版面（`.app-frame`，最大寬度 `max-w-app` = 30rem / 480px）。平板與電腦上置中顯示為手機寬度，外圍為 `sunken` 底色。
- 不使用 Tailwind 斷點（`sm:`/`md:`/`lg:`）；版面只為手機設計。
- 底部 5 格導覽（首頁／課表／AI 助理（中央浮起紅色圓鈕，選取時加外圈）／探索／我的），選取時圖示加粗＋紅色圓點。
- 次要入口：「作業與考試」「活動與機會」在「我的」頁上方快速入口，以及首頁的「全部待辦」「查看全部」。
- Bottom sheet、Toast 皆限制在 App 寬度內。PWA manifest `orientation: portrait`。

## 元件（`src/components`）
`Button` / `IconButton`、`Sheet`（手機 bottom sheet、桌面 dialog；focus trap、Esc 關閉）、`ConfirmSheet`、`Toast`（含復原動作）、`Segmented`、`EmptyState`、`PageHeader`、`ErrorNotice`、`LogoMark` / `Wordmark` / `LoadingMark`、`Colonnade`、`ScrollIllustration`。

## 無障礙
WCAG 2.2 AA 目標：可見 focus ring、跳到主要內容連結、表單 label、`aria-live` 訊息、`prefers-reduced-motion` 停用動畫、44px 左右觸控目標。

## 品牌資產
**主標誌**（2026-10-12 由開發者提供）：宮燈教室建築＋書卷曲線＋淡水夕照＋紅色 TKU 字標＋「Campus OS」。非淡江官方校徽。
- 原始檔：`design/brand/tku-campus-os-logo-1024.png`（不進 PWA 快取）
- App Icon：`public/icons/icon-192.png`、`icon-512.png`、`icon-maskable-512.png`（圖案縮至安全區 78%）、`apple-touch-icon.png`
- Favicon：`public/icons/favicon-32.png`、`favicon-48.png`
- 介面用：`public/brand/logo-128/256/512.png`（透明圓角），由 `LogoMark` / `Wordmark` / `LoadingMark` 使用
- 標誌為白底磁磚，深淺色模式共用同一版本；小尺寸（≤32px）細節會糊化，未來可考慮另做簡化版圖示
- Splash Screen：`index.html` 內的啟動畫面（React 掛載後自動被取代），支援深色與減少動態。
⚠ 自訂字級已註冊於 tailwind-merge；新增色彩 token 不需註冊。
