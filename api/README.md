# api/ — Vercel Functions（Codex 負責，分支 feat/ai-backend）

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

Status：503 未設定 AI/Supabase（前端自動改用本機助理）、401 token 無效、429 速率限制、400 輸入錯誤。

規則：私人資料用「帶使用者 JWT 的 client」查詢以套用 RLS；service role 只用於 `ai_usage` 與 `match_knowledge_chunks`；不得捏造校規。

## Implementation
- `chat.ts` validates the request, verifies the bearer token with Supabase Auth, records/checks `ai_usage`, stores conversation messages with the user JWT client, then streams Responses API deltas as SSE.
- Tool reads for schedules, tasks, events, and conversations use the user's JWT client. Only usage accounting, vector search, and document ingestion use the service-role client.
- `searchUniversityKnowledge` returns official-source fallback links even when the vector search has no reliable match; retrieved text is enclosed in untrusted-data markers before it is sent back to the model.
- Required server-only variables: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`. Optional: `OPENAI_MODEL`, `OPENAI_EMBEDDING_MODEL`, `AI_RATE_LIMIT_PER_MINUTE`.
- `npm run ingest` downloads supported public PDF/HTML documents listed in `src/data/sources.ts`. Unavailable or unsupported sources are logged and skipped. It requires `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `OPENAI_API_KEY`.

## POST /api/timetable-import
Headers：`Authorization: Bearer <Supabase access token>`。Body：`{ "image": "data:image/(jpeg|png|webp);base64,…" }`（前端先縮到長邊 ≤ 2000px JPEG，≤ 3.5 MB）。
Response 200：`{ "cells": [{ "weekday": 1-7, "period": 1-14, "group", "course", "teacher", "room" }] }`（每個有課的格子一筆；合併節次、換算時間、衝堂檢查在前端 `src/lib/timetableImport.ts` 以程式處理）。
Status：503 未設定、401、429（共用 `ai_usage` 每分鐘上限）、400、422 `not_timetable`、502 模型錯誤（不回傳細節）。
圖片只送給模型（`store: false`），伺服器不保存。可選 `OPENAI_VISION_MODEL`（預設沿用 `OPENAI_MODEL`）。`vercel.json` 設定此函式 `maxDuration` 60 秒。
