# Detour 文件索引

這裡把「目前要遵守的規則」和「只供追溯的舊紀錄」分開，避免從舊版 README 或對話複製到已失效的產品行為。

## 閱讀順序

1. [`../README.md`](../README.md)：專案入口、啟動方式與目前結構。
2. [`../AGENTS.md`](../AGENTS.md)：修改產品行為前的 repository 工作規則。
3. [`../PRODUCT_FOUNDATION.md`](../PRODUCT_FOUNDATION.md)：跨主題的產品基線。
4. `product-decisions/` 與 `MOOD_V2_DECISION.md`、`ROUTE_GENERATOR_V2.md`、`SCENE_V2.md`：針對單一主題的較新決策或實作規格。
5. `design-reference/`、[`../IPAD_DEV.md`](../IPAD_DEV.md)：視覺參考與開發操作說明。

## 權責規則

- `PRODUCT_FOUNDATION.md` 是跨主題基線。
- 日期較晚、內容明確、且標示為 ACTIVE / 已定案的主題文件，可以只覆蓋它所負責的主題。
- 發生衝突時，以「較新的明確主題決策」為準；不要把該文件的規則擴大套用到其他主題。
- 沒有 ACTIVE、IMPLEMENTED 或 HISTORICAL 狀態標記的新增文件，不應成為產品行為的唯一依據。
- 程式碼是實際行為的最後驗證來源；文件與程式不一致時，先開一個小 PR 修正文件或程式，不要默默累積例外。

## 目前有效的主題文件

- [`product-decisions/2026-09-16-side-events.md`](./product-decisions/2026-09-16-side-events.md)：小插曲的節奏、單一 active event、替換與觸發原則。
- [`MOOD_V2_DECISION.md`](./MOOD_V2_DECISION.md)：三個 Mood 與 Color Walk 定義。
- [`ROUTE_GENERATOR_V2.md`](./ROUTE_GENERATOR_V2.md)：路線品質、時間預算與安全路線原則。
- [`SCENE_V2.md`](./SCENE_V2.md)：Scene pool、hard reject 與匯入流程。
- [`design-reference/README.md`](./design-reference/README.md)：完成頁與歷史頁的視覺參考規則。
- [`../IPAD_DEV.md`](../IPAD_DEV.md)：iPad 外出開發流程，不是產品決策文件。

## 歷史資料

- [`../V039_PRODUCT_CONVERGENCE.md`](../V039_PRODUCT_CONVERGENCE.md)：v0.39 的歷史收斂快照；其中的舊時間節點與 Mood 數量已被後續決策取代。
- [`releases/README.md`](./releases/README.md)：`README_vXX.txt` 的歷史 release notes。

歷史文件保留原始內容，方便追查 commit、issue 或實走測試，但不能直接作為新功能規格。新的決策請建立日期檔名，例如 `product-decisions/YYYY-MM-DD-topic.md`，並在本索引補上連結與狀態。
