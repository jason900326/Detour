# Detour V2 — Playtest Build

Detour 是一場不知道下一步會發生什麼的約 10 分鐘小探險。

它帶玩家走一段平常不會走的路，並一路注意平常不會注意的東西。玩家不是前往一個一開始就決定好的秘密目的地；這趟路會根據玩家當下的位置逐小段形成，後半段才開始收尾。

這個版本唯一要驗證的事情是：

> 從按下開始到最後抵達，完整 10–15 分鐘的新版 Detour 到底好不好玩？

本版不處理 monetization、社群、成長、複雜收藏、登入、AI 圖像辨識或雙人專屬玩法。

## V2 核心流程

```text
首頁「去繞一下」
  → 取得目前位置
  → 規劃 1–3 分鐘短步路線
  → 顯示一張當前探索紙條
  → 找到了／換一個
  → Emoji 留在這張票上
  → 從玩家現在的位置形成下一段
  → Exploration
  → Closing
  → 抵達後才揭曉收尾位置
  → Completion / History / Share
```

### 首頁

首頁不再要求選時間、Mood、顏色、遊玩人數或玩法。主要 CTA 是「去繞一下」，並標示「約 10 分鐘」。出票／票根可以保留為開始之後的品牌儀式，但不能成為額外設定流程。

### Journey

- 每次只規劃接下來約 1–3 分鐘。
- 不把完整 10 分鐘路線預先鎖死。
- 不用每 50 公尺要求玩家繼續直走。
- 只有真正的轉彎或方向決策才強烈提示。
- 玩家因為尋找目標偏離路線是正常玩法；系統接受目前 GPS 位置，從新位置安排下一段，不要求原路返回。
- Journey 約有 3–4 個主要發現，約 8–10 分鐘開始收尾，最晚約 15 分鐘結束。

### 探索紙條

每次只顯示一個目標，例如：

- `🐱 找一隻貓。`
- `🎨 找一個有塗鴉的地方。`
- `🩹 找一個被修補過的地方。`

「找到了」會以短震動回饋，讓對應 Emoji 留在本趟 Ticket，然後從目前位置形成下一段。「換一個」永遠可用；Detour 不會讓玩家卡在單一低命中率目標上。

MVP 使用系統 Emoji、Typography、基本 View、圓角、線條、照片、GPS polyline、Haptic 與簡單 opacity / scale。題目品質優先於 Emoji，不能為了使用 Emoji 硬做低品質題目。

題庫包含 Easy、Medium、Hard 三種難度。節奏為 Easy → Medium → Medium / Hard；第一題不會太難，Hard 不連續，上一題找很久時下一題降低難度。OSM／Overpass 只做環境的弱加權，不能當成某個物件存在的證明。

### Ticket

Ticket 只記錄已經發生的發現：

```text
☁️ → ☁️ 🎨 → ☁️ 🎨 🪴 🐱
```

不預告未來任務，不顯示問號或尚未發生的 Emoji。這串痕跡是當次 Journey 的回饋、紀錄與未來分享內容。

找到與拍照分離。相機可以常駐在 Journey 畫面；找到目標不要求拍照，玩家也可以自由拍攝並把照片留在本次 Journey。

### Closing

Closing 大約在已經有 3 個發現且接近 8–10 分鐘時啟動。系統停止積極向外擴張，開始找安全、自然可以停下來的位置，例如小公園、廣場、綠地、河岸入口、步行空間或公共座椅區。店家不是 MVP 的必要條件。

途中只說「差不多了，再往這邊走一小段」，不先公布名稱。抵達後才揭曉「這趟停在 ○○」。接近 15 分鐘時進入 Forced Finish：不再產生新探索目標，完成目前 Journey；15 分鐘不是 Failure。

## 明確不做

本 Playtest Build 不加入：

- Coin、XP、商店、票券貨幣、次數限制、Daily reward、Streak、Ranking。
- 任何付費機制。Monetization hypothesis unresolved。
- AI 圖像辨識或找到驗證。玩家按「找到了」時，系統相信玩家。
- 單人／雙人分流或雙人專屬玩法。
- 景點推薦、一般導航、任務 RPG、運動統計或攝影證明流程。

## 實測只觀察

1. 玩家是否真的開始抬頭找東西。
2. 找東西是否比單純導航有趣。
3. 「找到了 → Emoji → 下一段」是否有完成感。
4. 題目是否太蠢、太容易或完全找不到。
5. 玩家是否仍焦慮「到底要去哪、還要多久」。
6. 偏離後動態 route 是否自然。
7. Closing 是否提供真正的結尾。
8. 玩家完成後第一句話是什麼。
9. 下次有 10 分鐘沒事時，玩家是否會自己再開。

最後一題是最重要的留存訊號。

## 室內模式 Playtest

首頁的「室內測試」只給開發／實測使用，不會取 GPS，也不會呼叫步行路線服務。進入後，Journey 畫面會出現控制列：

- **走 35m**：推進目前短段，測試導航 beat、地圖位置與路線進度。
- **走到這段結尾**：直接觸發短段結束，確認下一段是否從目前位置形成。
- **模擬偏離**：把目前位置移到路線外，確認 App 接受偏離、從新位置重新安排，不要求原路返回。
- **快轉到 Closing**：把時間推到 10:00，確認探索目標消失、收尾文案與收尾路線出現。
- **直接完成**：快速查看 Completion、Ticket、Emoji、照片數量、History 與 Share。

建議室內先照這個順序測：

1. 進入「室內測試」，確認第一題是簡單目標。
2. 不按地圖，連按幾次「走 35m」，觀察 route 與目標是否同時存在。
3. 按「找到了」，確認 Emoji 只在找到後進 Ticket，且下一題出現。
4. 按「換一個」，確認不會卡題，也不會把 Emoji 加進 Ticket。
5. 按「走到這段結尾」，確認不會結束整趟 Journey，而是從目前位置形成下一段。
6. 按「模擬偏離」，確認不跳出「請返回」類錯誤，且 route 能重新安排。
7. 累積約 3 個發現後按「快轉到 Closing」，確認進入收尾，不再出新的主要探索題。
8. 按「走到這段結尾」直到完成，確認抵達後才揭曉收尾位置。
9. 用「直接完成」補測 Completion、History、無照片分享，以及重新開始。

室內測試先不要評價按鈕漂不漂亮；先記錄流程是否自然、玩家是否知道下一步、是否仍焦慮目的地／剩餘時間，以及完成後第一句話。

## Expo Go 本機 Playtest

先切到目前要看的 branch，再在 VS Code 終端機執行：

```bash
npm install
git pull --rebase
npx expo start --go --lan --clear
```

電腦與 iPhone 必須連同一個 Wi-Fi。這個指令只啟動本機 Metro，讓 Expo Go 讀取目前 branch 的程式，不會執行 EAS build、rebuild、export 或 EAS Update。

如果只需要一般 Expo 開發伺服器，也可以使用：

```bash
npm install
cp .env.example .env
npx expo start
```

真機 Playtest 需要位置權限；相機只在玩家主動按下「想留就拍」時使用。真正的 key 不要提交到 repository。

## 常用指令

```bash
npm run start
npx expo start --go --lan --clear
npm run ios
npm run android
npm run web
npm run lint
npm run typecheck
npm test
npm run quality
```

## 專案結構

```text
src/
  app/index.tsx                    # V2 Playtest Build 主入口
  app/camera.tsx                   # 自由拍攝 route
  components/v2-detour-screen.tsx  # V2 Home / Journey / Completion / History UI
  hooks/use-v2-detour-controller.ts# V2 lifecycle、GPS、routing、persistence
  lib/v2-journey.ts                # V2 題庫、難度與 Exploration / Closing 規則
  lib/v2-routing.ts                # 短步 route 候選、重走與 U-turn 避免
  lib/routing-engine.ts             # 真實步行路線服務
  lib/navigation-engine.ts         # polyline 與轉彎提示
  lib/app-model.ts                 # 本機紀錄與相機資料模型
```

舊版 controller 與視覺元件仍保留在 repository，供相機、資料遷移與後續拆除使用；目前主入口只走 V2 Playtest Build。它們不應被重新接回首頁，也不應成為 V2 新功能的依賴。

## 開發原則

1. 先保證真機可以完整走完一趟，再處理視覺精修。
2. 新增功能必須服務「短路線 → 找東西 → Emoji 留票 → 下一段 → Closing」核心 loop。
3. 所有路線都從目前 GPS 位置形成；不要求玩家回到舊路線。
4. 不用 monetization 或虛擬獎勵掩蓋核心體驗問題。
5. 主要旅程修改至少通過 TypeScript、測試與 iOS Expo bundle。

更完整的 V2 決策位於 [`docs/product-decisions/2026-09-21-detour-v2-playtest-build.md`](./docs/product-decisions/2026-09-21-detour-v2-playtest-build.md)。
