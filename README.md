# Detour

**不知道要幹嘛時，可以立刻開始的一場約 10 分鐘小探險。**

Detour 從你現在的位置開始，帶你走一小段路，給你一個真實世界裡可以注意的東西。找到之後，系統會從你實際走到的位置重新形成下一小段，最後留下這趟的 Emoji、照片與票根記憶。

它不是景點推薦 App，也不是把目的地藏起來的一般導航。Detour 想做的是：讓人用不同的方式注意原本會直接走過的城市細節。

## 一趟 Detour 的感覺

```text
現在的位置
→ 收到一張探索紙條
→ 邊走邊找
→ 找到了
→ 留下一個 Emoji
→ 從目前位置繼續
→ 慢慢收尾
→ 收下一張屬於這趟的票根
```

Journey 不會在開始時先鎖死完整路線或偷偷決定一個終點。

系統一次只規劃接下來約 1–3 分鐘的短段。你為了找東西偏離建議方向是正常玩法；Detour 會接受你現在的位置，保留已經走過的路，再從那裡決定下一段，而不是要求你回到原本的 route。

旅程因此是邊走邊形成的。前段偏探索，約 8–10 分鐘後開始收尾，接近 15 分鐘時結束。

## 產品原則

目前 Pocket V2 刻意保持簡單：

- 一趟大約 10–15 分鐘。
- 首頁可以直接開始，不先選時間、Mood、玩法或人數。
- 一次只給一個觀察目標。
- 永遠可以「換一個」，不讓單一題目卡住旅程。
- 不需要 AI 驗證；按下「找到了」就相信玩家。
- 拍照是可選的，找到不等於必須拍照。
- 不做 XP、coins、streak、leaderboard。
- 票根、照片與 Journey history 以 local-first 為原則。
- 真實世界的注意力比盯著地圖更重要。

更完整的產品理由與取捨見 [PRODUCT_FOUNDATION.md](PRODUCT_FOUNDATION.md)。

## Current Pocket playtest

目前 App 入口是 **Pocket V2 playtest**，版本為 **0.49.0**。

主要入口：

```text
src/app/index.tsx
src/components/pocket/pocket-app.tsx
```

這個版本不是在證明一套完整商業模式，而是在驗證核心 Journey 本身：

- 使用者會不會開始抬頭觀察周遭？
- 找東西是否比單純跟著方向走更有趣？
- 「找到了 → Emoji → 下一段」是否有完成感？
- 題目是否太容易、太難，或讓人煩躁？
- 偏離之後的動態 rerouting 是否自然？
- Closing 是否像一個有意義的結尾，而不是突然停止？
- 最重要的是：下次又多出 10 分鐘時，會不會想再打開 Detour？

這些目前都仍是 playtest 問題，不是已經被證明的結論。

Pocket 也已經有一個 development-only 的 Experience 內容實驗，用來驗證同一套 Journey engine 能否支援不同觀察方式；正式首頁仍然維持直接「繞一下？」的 core flow。

## Running locally

先安裝依賴：

```sh
npm install
```

使用 Expo Go，在同一個 Wi-Fi 開發：

```sh
npx expo start --go --lan
```

手機與開發電腦需要能在同一個區網互相連線。啟動後用 Expo Go 掃描終端或 Expo Dev Tools 顯示的 QR code。

如果 LAN 不方便，repo 也保留 tunnel script：

```sh
npm run start:ipad
```

這個 script 目前等同於 `expo start --go --tunnel --clear`。

## Quality checks

常用檢查：

```sh
npm run lint
npm run typecheck
npm test
```

一次跑完：

```sh
npm run quality
```

目前測試主要覆蓋 Journey phase、discovery selection、Experience filtering、routing policy、route quality、storage recovery、分享資料選擇與其他產品規則。這些測試刻意把重要規則留在 pure logic，避免只能靠真機手動驗證。

## Architecture overview

```text
src/
  app/                    App entry
  components/pocket/      Pocket UI / screens
  hooks/                  Journey controller
  lib/                    Journey, content, routing, storage, telemetry

backend/                  Playtest backend functions
docs/                     Product / playtest / architecture notes
scripts/                  Repository checks and data tooling
```

主要責任：

- **Pocket UI** — 首頁、Journey、Completion、History、Detail、Share、Help。
- **Journey controller** — `src/hooks/use-pocket-journey.ts`，管理定位、active journey、phase、reroute、完成與 cold-launch recovery。
- **Journey engine** — `src/lib/pocket-engine.ts`，保留 Journey state 與 phase / GPS 等 pure rules。
- **Discovery content** — `src/lib/pocket-content.ts`，管理題庫、難度、environment weighting、Experience 與內容選擇。
- **Routing** — `src/lib/pocket-routing.ts` 與 shared routing engine，從目前位置規劃下一個短步行段。
- **Storage** — AsyncStorage + local photo files，保存 active journey、history 與照片。
- **Playtest analytics** — local-first telemetry，完成後 best-effort sync。
- **Backend playtest sync** — 接收 playtest telemetry；analytics failure 不應阻擋 Journey。

更完整的責任與資料邊界見 [docs/POCKET_ARCHITECTURE.md](docs/POCKET_ARCHITECTURE.md)。

## Privacy and network

目前 Pocket 的資料行為可以簡單理解成：

- Journey ticket、active state 與 history 儲存在裝置本機。
- Detour 拍攝並保留的 Journey 照片存在裝置本機。
- 為了取得附近可步行候選與步行路線，Pocket 需要網路，並會使用目前位置向 OSM / routing 相關服務提出請求。
- Playtest telemetry 與 routing 是不同資料流。現行 Pocket telemetry 設計不會上傳 raw GPS trace、照片或 destination name；它主要記錄 discovery ID、難度、粗粒度 environment、時間、found / skipped、reroute 與 route-quality ratios 等測試訊號。
- Analytics sync 是 best-effort；失敗不應阻擋 Journey。

這一節描述目前程式行為，不取代正式的隱私政策或法律文件。

## Product status

Detour 目前是 **active playtest / experimental product**。

現在的開發重點，是確認「約 10 分鐘出去走、注意一些平常不會注意的東西」這件事本身是否夠有趣、自然，而且值得重複打開。

因此現階段刻意不把注意力放在：

- monetization implementation
- social systems
- AI image recognition
- complex progression systems
- coins / XP / streak economy
- mandatory themed-mode selection

這不是缺少功能，而是 scope discipline：先把核心 Journey 驗證清楚，再決定哪些系統真的值得存在。

## Documentation

目前與 Pocket V2 最相關的文件：

- [PRODUCT_FOUNDATION.md](PRODUCT_FOUNDATION.md) — 現行產品基準與核心取捨。
- [docs/V2_PLAYTEST_SPEC.md](docs/V2_PLAYTEST_SPEC.md) — V2 Journey / playtest 詳細規格。
- [docs/POCKET_PLAYTEST.md](docs/POCKET_PLAYTEST.md) — Pocket UI、互動與真機測試注意事項。
- [docs/POCKET_ARCHITECTURE.md](docs/POCKET_ARCHITECTURE.md) — 現行 Pocket 架構、storage、routing、analytics 與 privacy boundaries。
- [docs/DISCOVERY_SELECTION.md](docs/DISCOVERY_SELECTION.md) — discovery 候選生成、ranking、decision log、重播與 playtest tuning。
- [docs/POCKET_FEEDBACK_SHARE.md](docs/POCKET_FEEDBACK_SHARE.md) — haptic、audio 與分享輸出的實作說明。

未來 monetization 方向目前只是一份產品假設，沒有付費實作；相關原則記錄在 [docs/MONETIZATION_HYPOTHESES.md](docs/MONETIZATION_HYPOTHESES.md)。
