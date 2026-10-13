# api/ — Vercel Functions（Codex 負責，分支 feat/gemini）

## POST /api/chat
Request headers：`Authorization: Bearer <Supabase access token>`、`Content-Type: application/json`

```json
{ "message": "≤1000 字", "conversationId": "uuid | null", "semesterId": "uuid | undefined",
  "timezone": "Asia/Taipei", "history": [{ "role": "user|assistant", "content": "..." }] }
```
可選欄位 `lang: "zh-TW" | "en"` 用來指定回答語言；省略時以繁體中文回答。前端切換 i18n 後可帶入目前語系。

Response：`Content-Type: text/event-stream`，每個事件為 `data: <JSON>\n\n`
```
{"type":"meta","conversationId":"<uuid>"}
{"type":"delta","text":"..."}                 // 可多次
{"type":"sources","sources":[SourceRef]}      // 結束前一次
{"type":"error","message":"繁中訊息"}
{"type":"done"}
```
`SourceRef = { title; publisher?; url?; updated?; kind: "official"|"personal"|"campus" }`

Status：503 未設定 AI/Supabase（前端自動改用本機助理）、401 token 無效、429 使用者速率限制或 Gemini 專案額度耗盡、400 輸入錯誤、502 Gemini 暫時故障。錯誤只包含友善訊息，不包含模型原始回應。

規則：私人資料用「帶使用者 JWT 的 client」查詢以套用 RLS；service role 只用於 `ai_usage` 與 `match_knowledge_chunks`；不得捏造校規。

## Implementation
- `chat.ts` validates the request, verifies the bearer token with Supabase Auth, records/checks `ai_usage`, stores conversation messages with the user JWT client, then streams Gemini `streamGenerateContent` deltas through the existing SSE contract.
- `gemini.ts` uses the official REST API with the key only in the `x-goog-api-key` header. There is no AI SDK dependency, URL key parameter, or persistent Gemini session. Generation requests explicitly set `store: false` to disable request logging. Function calls are restricted to the six read-only tools; matching function IDs and thought signatures are preserved on subsequent turns.
- SSE starts only after the upstream tool rounds and streaming HTTP request succeed, so an upstream HTTP 429 remains an HTTP 429 to the frontend. Failures during an already-started stream use `error` + `done` events.
- Tool reads for schedules, tasks, events, and conversations use the user's JWT client. Only usage accounting, vector search, and document ingestion use the service-role client.
- `searchUniversityKnowledge` returns official-source fallback links even when the vector search has no reliable match; retrieved text is enclosed in untrusted-data markers before it is sent back to the model.
- Required server-only variables: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`. Optional: `GEMINI_MODEL` (default `gemini-3.5-flash-lite`), `GEMINI_VISION_MODEL` (default same as `GEMINI_MODEL`), `GEMINI_EMBEDDING_MODEL` (default `gemini-embedding-001`), `AI_RATE_LIMIT_PER_MINUTE` (default 10). Never prefix secrets with `VITE_` or commit `.env.local`.
- Default model IDs were confirmed against Google's [Flash-Lite model documentation](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite) and [embedding model documentation](https://ai.google.dev/gemini-api/docs/models/gemini-embedding-001). Generation uses the [GenerateContent REST API](https://ai.google.dev/api/generate-content), not the persistent Interactions API.
- The per-user `ai_usage` limit is separate from Google's project-wide RPM/TPM/RPD quotas. Multiple users and function-call rounds consume the same project quota; HTTP 429 is handled without automatic retries.
- `npm run ingest` downloads supported public PDF/HTML documents listed in `src/data/sources.ts`. Unavailable or unsupported sources are logged and skipped. It requires `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `GEMINI_API_KEY`. Embeddings explicitly request `outputDimensionality: 1536`, are normalized, and use retrieval-query/document task types; the database remains `vector(1536)`.
- Re-run ingestion when switching providers: OpenAI and Gemini vectors cannot be compared. The document hash now includes `gemini`, the embedding model ID, and 1536 dimensions, so unchanged document text is re-embedded once after the provider switch. No existing document/chunks are replaced until its new embeddings are complete.

## POST /api/timetable-import
Headers：`Authorization: Bearer <Supabase access token>`。Body：`{ "image": "data:image/(jpeg|png|webp);base64,…" }`（前端先縮到長邊 ≤ 2000px JPEG，≤ 3.5 MB）。
Response 200：`{ "cells": [{ "weekday": 1-7, "period": 1-14, "group", "course", "teacher", "room" }] }`（每個有課的格子一筆；合併節次、換算時間、衝堂檢查在前端 `src/lib/timetableImport.ts` 以程式處理）。
Status：503 未設定、401、429（共用 `ai_usage` 每分鐘上限）、400、422 `not_timetable`、502 模型錯誤（不回傳細節）。
圖片以 `inlineData` 送給 Google Gemini，搭配 `responseMimeType: application/json`、`responseSchema` 與 `store: false`；格式錯誤的個別格子由 `cellSchema` 丟掉。此 handler 不保存圖片、不寫入資料庫或日誌、不使用 Google Files API。可選 `GEMINI_VISION_MODEL`（預設沿用 `GEMINI_MODEL`）。`vercel.json` 設定此函式 `maxDuration` 60 秒。

聊天仍依既有合約將使用者/assistant 訊息與 sources 存在 Supabase（使用者 JWT/RLS）；API 執行環境不另外保存對話檔案或內容日誌。Google 對傳入資料的處理依其服務條款，不能將無本機保存等同於供應商不留存。

## Verification
`npm run lint && npm run typecheck && npm run test && npm run build`。API 測試使用 mock fetch 覆蓋 Gemini 串流、function call→工具→回答、圖片結構化 JSON/無效格子、上游 429/5xx，以及傳給 Google 的請求不夾帶 Supabase 金鑰或 JWT。

另用 esbuild `--bundle --platform=node --format=esm --packages=external` 打包 `chat.ts`、`timetable-import.ts`，再以純 Node ESM 載入；npm dependencies 按 Vercel 的 Node resolution 外部載入，專案程式/靜態資料被打包，輸出不可含 `@/` alias。真實問答與讀圖需 `.env.local` 的 Gemini 金鑰、service role 與已登入使用者 JWT；沒有設定時只驗證 503，不代表已完成模型實測。
