# api/ — Vercel Functions

不使用任何 AI 服務或 API 金鑰（2026-10-26 起）：AI 助理（`src/features/ai/localEngine.ts`）、課表截圖辨識（`src/lib/ocr/`，Tesseract.js WASM）與介面翻譯（`src/i18n/packs/`）都在使用者裝置上執行。已移除 `/api/chat`、`/api/translate`、`/api/timetable-import` 與 `scripts/ingest.ts`；資料庫中舊的 AI 相關資料表（`ai_conversations`、`ai_messages`、`ai_usage`、`knowledge_*`、`ui_translations`）保留不動、目前不使用。

## Functions
| 檔案 | 用途 | 需要的伺服器變數 |
|---|---|---|
| `push.ts` | GET 公開 VAPID key；POST 測試推播 | `VAPID_PUBLIC_KEY`、`VAPID_PRIVATE_KEY`、Supabase |
| `push-reminders.ts` | pg_cron 每分鐘呼叫，送上課／截止／好友通知 | 同上＋`CRON_SECRET` |
| `sync-events.ts` | Vercel Cron 每日同步 enroll.tku.edu.tw 活動 | `CRON_SECRET`、Supabase |
| `widget.ts` | iPhone 小工具（Scriptable）資料 | Supabase |

Supabase：`SUPABASE_URL`、`SUPABASE_ANON_KEY`、`SUPABASE_SERVICE_ROLE_KEY`。永遠不要加 `VITE_` 前綴。

Layout：每個 `api/*.ts` 都是一個 Vercel Function（Hobby 方案每次部署最多 12 個）。共用程式放 `api/_lib/`、測試放 `api/_tests/`——底線開頭的資料夾不會部署成 function，不要把 helper 或測試直接放在 `api/`。

## 課表截圖匯入
在使用者手機上以 Tesseract.js（WASM）辨識，不經伺服器：`src/lib/ocr/`（格線偵測、逐行切圖、欄位解析）與 `src/features/schedule/ImageImport.tsx`。引擎與繁中模型由 `scripts/copy-ocr-assets.mjs` 在 dev/build 前複製到 `public/ocr/`（不進 Git），同源提供，CSP 只多了 `'wasm-unsafe-eval'`。

## 推播提醒診斷 `/api/push`
- GET：回 `{ configured, publicKey }`；只有公開 VAPID key，不包含 private key、CRON_SECRET 或 Supabase credentials。訂閱時讀取此執行期設定，不再依賴前端建置時的 VITE_VAPID_PUBLIC_KEY。
- POST：使用 Supabase JWT 驗證，body `{ endpoint }`；只能讀取 RLS 下本人已儲存的該裝置訂閱，不能提交任意推播密鑰。伺服器以既有 VAPID 設定傳送測試通知；push_sent 原子 claim 限制每使用者每分鐘一次。401 未登入／token 無效、404 非本人或不存在訂閱、429 測試過頻、503 未設定完整、502 上游傳送失敗，錯誤不回傳上游細節。
- 已開啟本機提醒的舊裝置：登入且通知權限已授予時自動補建訂閱；回到 App／網路恢復時重新檢查，不自動要求通知權限。失敗保留本機提醒並顯示重新連線入口。「伺服器已送出」不代表已驗證真機顯示或 OS 通知設定。

## Verification
`npm run lint && npm run typecheck && npm run test && npm run build`。
