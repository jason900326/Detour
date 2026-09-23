# Pocket Playtest · 2026-09-22

## 視覺

奶油白紙張、墨黑字、橘色行動、淡紫探索紙條、鼠尾草綠收尾。
首頁是一張還沒發生故事的小票。正在找的內容只在探索紙條；Ticket 只印已完成發現。
找到時紙條換頁、短震動；Emoji 留到完成頁的票根呈現。按鈕有縮放回饋，支援減少動態效果。

本次 UI 調整：首頁以大 Logo、留白、繞行線條及兩個 CTA 組成，右上角提供精簡玩法說明。原生載入與等待使用 Skia 路徑動畫，支援減少動態效果。探索目標與「找到了」整合成主卡；方向提示是較輕的獨立路標，地圖可展開。拍照入口改為橫向「沿途留一張」，不使用右下角浮動按鈕。

「找到了」立即記錄發現並開啟相機，略過拍照仍保留發現。相機採用 expo-camera 自訂介面，Expo Go 和正式 build 相同。探索中不允許滑回首頁；× 先開啟結束確認。收藏、詳情、分享、說明和相機有邊緣返回手勢。相機存檔時暫停返回，避免儲存被中斷。

完成與詳情照片改成固定高度的堆疊，輕點翻閱；分享畫面提供封面縮圖選擇，選擇與控制列不會被拍進分享圖片。選中的照片成功載入後才可分享，零照片分享仍以票根為主。封面選擇保留於本次 App 工作階段。

參考：
- https://dribbble.com/shots/26772110-Travel-Journal-Mobile-App （留白與照片優先的回顧層級）
- https://dribbble.com/shots/27263101-Travel-Mobile-App-UI-Vintage-Postcard-Journal-Retro （照片與紙張的收藏感）
- https://recent.design/ （Godly 目前導向此設計選集；卡片、Typography 與動態方向）
- https://dribbble.com/shots/26286190-Modern-Travel-Discovery-App-UI （簡洁探索介面與色彩；原頁一度有人機驗證，採搜尋可見資訊）
- https://recent.design/i/eoyvn9b-expanding-card-transitions （Godly 現轉址 Recent；卡片操作回饋）

## 結構

src/components/pocket 是 V2 入口介面；src/hooks/use-pocket-journey.ts 管理旅程；pocket-engine.ts 管理目標節奏；pocket-routing.ts 規劃下一段。
舊版元件保留供比對，App routes 已切換到 V2。舊收藏可匯入，V2 使用獨立儲存 key。

## 外測限制

- 真實 GPS、指南針、相機、系統分享與持機流暢度需用手機驗證，瀏覽器只能驗證介面及流程。
- 使用公開 Overpass 與 OSM 步行服務，可能限流；失敗會保留探索目標並提供重試，不捏造直線導航。
- OSM 的公共區域與道路資料不是現場安全保證，遵守現場通行狀態。
- 前景定位；App 切到背景不持續記錄，背景／被系統終止期間不計入有效旅程時間。冷啟動若有未完成旅程會先詢問繼續或重來。
- 15 分鐘上限收好已發生的紀錄，不要求超時仍追逐終點。
- 無照片分享以票根為主；Web fallback 分享文字，Expo Go 分享圖片。

版本 0.49.0 使用獨立 appVersion runtime，避免接收到舊版本的 OTA 更新。本次合併至 main；沒有啟動 EAS build。
