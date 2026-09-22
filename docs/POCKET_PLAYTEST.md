# Pocket Playtest · 2026-09-22

## 視覺

奶油白紙張、墨黑字、橘色行動、淡紫探索紙條、鼠尾草綠收尾。
首頁是一張還沒發生故事的小票。正在找的內容只在探索紙條；Ticket 只印已完成發現。
找到時紙條換頁、Emoji 彈性蓋上票根、短震動。按鈕有縮放回饋，支援減少動態效果。

參考：
- https://dribbble.com/shots/26286190-Modern-Travel-Discovery-App-UI （簡洁探索介面與色彩；原頁一度有人機驗證，採搜尋可見資訊）
- https://recent.design/i/eoyvn9b-expanding-card-transitions （Godly 現轉址 Recent；卡片操作回饋）

## 結構

src/components/pocket 是 V2 入口介面；src/hooks/use-pocket-journey.ts 管理旅程；pocket-engine.ts 管理目標節奏；pocket-routing.ts 規劃下一段。
舊版元件保留供比對，App routes 已切換到 V2。舊收藏可匯入，V2 使用獨立儲存 key。

## 外測限制

- 真實 GPS、指南針、相機、系統分享與持機流暢度需用手機驗證，瀏覽器只能驗證介面及流程。
- 使用公開 Overpass 與 OSM 步行服務，可能限流；失敗會保留探索目標並提供重試，不捏造直線導航。
- OSM 的公共區域與道路資料不是現場安全保證，遵守現場通行狀態。
- 前景定位；App 切到背景不持續記錄，回到前景會按真實經過時間更新階段。
- 15 分鐘上限收好已發生的紀錄，不要求超時仍追逐終點。
- 無照片分享以票根為主；Web fallback 分享文字，Expo Go 分享圖片。

這次沒有執行 EAS build、雲端部署或 Git push。
