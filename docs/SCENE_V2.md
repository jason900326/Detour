# Detour — Scene V2

> 狀態：IMPLEMENTED / 等待 dry-run 與正式重匯
> scoring version：2

## 目的

Scene V2 把不會隨使用者當下狀態改變的判斷，搬到全台 OSM 匯入階段完成。出票時只保留距離、真實步行路線、當下時間、使用者歷史等 Journey 判斷。

核心原則：

**Scene intelligence 預算；Journey intelligence 即時計算。**

## Destination Pool

| Mood | 使用的目的地池 |
| --- | --- |
| 隨便走 | scene_family = detour |
| 色色的 | scene_family = detour，和隨便走完全相同 |
| 吃東西 | scene_family = food |
| 慢慢走 | 不查 Scene；使用者指定目的地 |

market 和 food 只屬於 Food Pool，不會再混入隨便走／色色的候選。

## 匯入順序

1. 從 Taiwan OSM extract 篩出可能相關的 objects。
2. 執行 Hard Reject。
3. 分類 Scene kind。
4. 計算客觀特徵與分數。
5. 寫入 Supabase。
6. 產生可下載的 import report。
7. 正式匯入完成後，才停用上一批已消失的 OSM rows。

Hard Reject 被排除的資料不會分類、不會打分，也不會寫入 Supabase。

## Hard Reject

目前固定排除：

- 宗教場所
- access=private/no
- 醫院、診所、牙醫與醫療設施
- 執勤中的警察、消防、救護設施
- 軍事區與監獄
- 一般政府辦公設施
- 學校、幼兒園、大專院校與教育用地
- 墓園、墓地與殯葬設施
- 人工 route anchor

政府或警消營運的公開博物館／藝廊仍可保留；判斷依據是該 OSM feature 本身是否明確標記為公開目的地。

## 預處理欄位

| 欄位 | 意義 |
| --- | --- |
| quality_score | 到場後是否有足夠資料與實體內容，避免「去了什麼都沒有」 |
| oddity_score | 是否有 Detour 的陌生、微怪、非日常感 |
| visual_score | 到現場是否有清楚可看或可辨識的東西 |
| food_commitment_score | 是否適合低承諾、臨時起意的購買 |
| traits | art、historic、structure、odd 等可解釋特徵 |
| scene_family | detour 或 food |
| scoring_version | 本次 rubric 版本，方便之後安全重算 |

所有數值分數介於 0–100。它們不是 AI 黑箱評分，而是由 kind + OSM tags 的固定規則批次計算。

## 新增候選類型

Scene V2 的全台 tags filter 補入：

- 階梯
- 步行街段
- 人行橋
- 老樹／自然紀念物

Python 分類器仍會再次檢查多個 tags；例如一般汽車橋不會因為 bridge=yes 就被當成人行橋。

## 查詢與性能

nearby_detour_scenes() 先用 PostGIS ST_DWithin 和 GiST index 限定附近範圍，再依 scene_family 分池。

Detour Pool 的預選權重：

- quality 35%
- oddity 45%
- visual 20%

Food Pool 的預選權重：

- quality 65%
- food commitment 35%

RPC 最多回 180 筆，真實 routing 不會對全部候選執行。

## 安全部署順序

1. 執行 backend/detour-scene/scenes-v4.sql。
2. 手動執行 GitHub Action Import Taiwan Scenes，先選 dry_run=true。
3. 下載 detour-scene-import-report，檢查排除數、各 kind 數量與 score 分布。
4. 確認後再以 dry_run=false 正式重匯。
5. 部署更新後的 detour-scene Edge Function。
6. 用台北、台中、台南、高雄、花蓮座標各抽查一次候選。

正式匯入只在全部新 rows 上傳成功後呼叫 finalize_osm_scene_import()；中途失敗不會停用上一批資料。

