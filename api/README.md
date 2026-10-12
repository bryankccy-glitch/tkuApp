# api/ — Vercel Functions（Codex 負責，分支 feat/ai-backend）

## POST /api/chat
Request headers：`Authorization: Bearer <Supabase access token>`、`Content-Type: application/json`

```json
{ "message": "≤1000 字", "conversationId": "uuid | null", "semesterId": "uuid | undefined",
  "timezone": "Asia/Taipei", "history": [{ "role": "user|assistant", "content": "..." }] }
```

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
