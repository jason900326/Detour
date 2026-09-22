# Detour 文件索引

這裡把「目前要遵守的規則」和「只供追溯的舊紀錄」分開，避免從舊版 README 或對話複製到已失效的產品行為。

## 閱讀順序

1. [`../README.md`](../README.md)：V2 Playtest Build 入口、啟動方式與目前結構。
2. [`../AGENTS.md`](../AGENTS.md)：修改產品行為前的 repository 工作規則。
3. [`product-decisions/2026-09-21-detour-v2-playtest-build.md`](./product-decisions/2026-09-21-detour-v2-playtest-build.md)：目前最完整、最新的 V2 Playtest Build 規格。
4. [`../PRODUCT_FOUNDATION.md`](../PRODUCT_FOUNDATION.md)：V2 跨主題產品基準。
5. `ROUTE_GENERATOR_V2.md`、`SCENE_V2.md`：仍可重用的路線與環境資料實作參考；若與 V2 Journey 衝突，以 V2 規格為準。
6. `design-reference/`、[`../IPAD_DEV.md`](../IPAD_DEV.md)：視覺參考與開發操作說明。

## 權責規則

- `PRODUCT_FOUNDATION.md` 是 V2 跨主題基線。
- 日期較晚、內容明確、且標示為 ACTIVE / 已定案的主題文件，可以只覆蓋它所負責的主題。
- 發生衝突時，以「較新的明確主題決策」為準；不要把該文件的規則擴大套用到其他主題。
- 沒有 ACTIVE、IMPLEMENTED 或 HISTORICAL 狀態標記的新增文件，不應成為產品行為的唯一依據。
- 程式碼是實際行為的最後驗證來源；文件與程式不一致時，先開一個小 PR 修正文件或程式，不要默默累積例外。

## 目前有效的主題文件

- [`product-decisions/2026-09-21-detour-v2-playtest-build.md`](./product-decisions/2026-09-21-detour-v2-playtest-build.md)：V2 Playtest Build 的核心 Journey、目標、短步 routing、Closing 與驗證問題。
- [`ROUTE_GENERATOR_V2.md`](./ROUTE_GENERATOR_V2.md)：路線品質、時間預算與安全路線原則。
- [`SCENE_V2.md`](./SCENE_V2.md)：Scene pool、hard reject 與匯入流程。
- [`design-reference/README.md`](./design-reference/README.md)：完成頁與歷史頁的視覺參考規則。
- [`../IPAD_DEV.md`](../IPAD_DEV.md)：iPad 外出開發流程，不是產品決策文件。

`2026-09-16-side-events.md` 與 `MOOD_V2_DECISION.md` 保留作為舊版決策追溯，不再是 V2 Playtest Build 的產品入口；V2 不重新接回 Mood 或 Side Event 流程。

## 清理規則

- 已移除舊版 `README_vXX.txt`、v0.39 收斂快照與未使用的 Expo starter 資料；Git 歷史仍可追溯。
- 舊版 Mood、時間選擇與 Side Event 文件只保留供追溯；V2 Playtest Build 首頁不再提供這些設定。
- 正式使用的素材、Scene migration、Arrival／紙張／ticket interaction 與 active product decisions 不因清理而移除。
- 新的決策請建立日期檔名，例如 `product-decisions/YYYY-MM-DD-topic.md`，並在本索引補上連結與狀態。
