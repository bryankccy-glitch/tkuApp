# AGENTS.md — 給所有 AI 開發工具（Codex、Claude Code 等）的規則

1. **開始工作前**：閱讀 `HANDOFF.md`、本檔、`ARCHITECTURE.md`；執行 `git status` 與 `git branch` 確認狀態。
2. **不要覆寫他人的未提交修改**。發現衝突時停止破壞性操作，先檢查再處理。
3. **分支 / Worktree**：每個 AI 在自己的 feature branch 工作；兩個 AI 同時開發時使用 `git worktree`，不要在同一個資料夾切換分支。不可 force push、不可直接 push 到 `main`。
4. **尊重既有架構**：資料存取一律經過 `src/lib/data/repository.ts` 的 `DataRepository`；UI 使用 `src/components/ui` 與 `tailwind.config.js` 的 design tokens（見 `docs/DESIGN_SYSTEM.md`）。不要引入新的 UI 框架。
5. **禁止無故刪除程式**。
6. **TypeScript strict**（含 `noUncheckedIndexedAccess`），不使用 `any` 逃避型別。
7. **修改後執行**：`npm run lint && npm run typecheck && npm run test && npm run build`。失敗就如實記錄，不能宣稱通過。
8. **Secrets**：API Key、Service Role Key 只能放伺服器端環境變數，不可加 `VITE_` 前綴、不可寫入 Git 或 HANDOFF。
9. **資料真實性**：不得捏造校規、課程、教室、座標、活動。未查核的資料要標示「待查核」並附來源。
10. **工作結束**：更新 `HANDOFF.md`（只寫真正完成的事），內容必須與實際程式狀態一致。舊紀錄移到 `CHANGELOG.md`。
11. **Commit**：Conventional Commits（`feat:`、`fix:`、`docs:`、`test:`、`chore:`）。

## 目前分工（2026-10-12）
| 負責 | 範圍 | 分支 |
|---|---|---|
| Claude Code | `src/**`、專案文件 | `main` |
| Codex | `api/**`、`scripts/**`、`supabase/tests/**`、新增 migration | `feat/ai-backend`（worktree：`../tkuApp-codex`） |

跨範圍的需求寫進 `HANDOFF.md` 的 Next Steps，由負責的一方處理。
