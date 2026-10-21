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
- Layout: every `api/*.ts` file is a Vercel Function (Hobby plan allows at most 12 per deployment). Shared code lives in `api/_lib/` and tests in `api/_tests/` — folders starting with `_` are not deployed as functions, so never put helpers or tests directly in `api/`.
- `_lib/gemini.ts` uses the official REST API with the key only in the `x-goog-api-key` header. There is no AI SDK dependency, URL key parameter, or persistent Gemini session. Generation requests explicitly set `store: false` to disable request logging. Function calls are restricted to the six read-only tools; matching function IDs and thought signatures are preserved on subsequent turns.
- SSE starts only after the upstream tool rounds and streaming HTTP request succeed, so an upstream HTTP 429 remains an HTTP 429 to the frontend. Failures during an already-started stream use `error` + `done` events.
- Tool reads for schedules, tasks, events, and conversations use the user's JWT client. Only usage accounting, vector search, and document ingestion use the service-role client.
- `searchUniversityKnowledge` returns official-source fallback links even when the vector search has no reliable match; retrieved text is enclosed in untrusted-data markers before it is sent back to the model.
- Required server-only variables: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`. Optional: `GEMINI_MODEL` (default `gemini-3.5-flash-lite`), `GEMINI_EMBEDDING_MODEL` (default `gemini-embedding-001`), `AI_RATE_LIMIT_PER_MINUTE` (default 10). Never prefix secrets with `VITE_` or commit `.env.local`.
- Default model IDs were confirmed against Google's [Flash-Lite model documentation](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite) and [embedding model documentation](https://ai.google.dev/gemini-api/docs/models/gemini-embedding-001). Generation uses the [GenerateContent REST API](https://ai.google.dev/api/generate-content), not the persistent Interactions API.
- The per-user `ai_usage` limit is separate from Google's project-wide RPM/TPM/RPD quotas. Multiple users and function-call rounds consume the same project quota; HTTP 429 is handled without automatic retries.
- `npm run ingest` downloads supported public PDF/HTML documents listed in `src/data/sources.ts`. Unavailable or unsupported sources are logged and skipped. It requires `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `GEMINI_API_KEY`. Embeddings explicitly request `outputDimensionality: 1536`, are normalized, and use retrieval-query/document task types; the database remains `vector(1536)`.
- Re-run ingestion when switching providers: OpenAI and Gemini vectors cannot be compared. The document hash now includes `gemini`, the embedding model ID, and 1536 dimensions, so unchanged document text is re-embedded once after the provider switch. No existing document/chunks are replaced until its new embeddings are complete.

## 課表截圖匯入（已移除 /api/timetable-import）
課表截圖改在使用者手機上以 Tesseract.js（WASM）辨識，不經伺服器、不需要 API 金鑰：`src/lib/ocr/`（格線偵測、逐行切圖、欄位解析）與 `src/features/schedule/ImageImport.tsx`。引擎與繁中模型由 `scripts/copy-ocr-assets.mjs` 在 dev/build 前複製到 `public/ocr/`（不進 Git），同源提供，CSP 只多了 `'wasm-unsafe-eval'`。

聊天仍依既有合約將使用者/assistant 訊息與 sources 存在 Supabase（使用者 JWT/RLS）；API 執行環境不另外保存對話檔案或內容日誌。Google 對傳入資料的處理依其服務條款，不能將無本機保存等同於供應商不留存。

## Verification
`npm run lint && npm run typecheck && npm run test && npm run build`。API 測試使用 mock fetch 覆蓋 Gemini 串流、function call→工具→回答、上游 429/5xx，以及傳給 Google 的請求不夾帶 Supabase 金鑰或 JWT。

另用 esbuild `--bundle --platform=node --format=esm --packages=external` 打包 `chat.ts`，再以純 Node ESM 載入；npm dependencies 按 Vercel 的 Node resolution 外部載入，專案程式/靜態資料被打包，輸出不可含 `@/` alias。真實問答需 `.env.local` 的 Gemini 金鑰、service role 與已登入使用者 JWT；沒有設定時只驗證 503，不代表已完成模型實測。
