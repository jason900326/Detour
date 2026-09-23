# Detour

不知道要幹嘛時，可以立刻開始的一場約 10 分鐘小探險。

按「繞一下？」→ 帶著探索紙條走 → 找到了，開相機留一眼（可略過）→ 從現在的位置繼續 → 收好這趟的 Emoji 票根。

目前入口為 Pocket QR 版（0.49.0），`src/app/index.tsx` 使用 `src/components/pocket/pocket-app.tsx`。Pocket 架構與資料邊界見 [`docs/POCKET_ARCHITECTURE.md`](docs/POCKET_ARCHITECTURE.md)。

## 本機試玩

```sh
npm install
npx expo start --go --lan
```

手機與電腦連同一個 Wi-Fi，用 Expo Go 掃終端 QR code。這個流程不使用 EAS Build。
相機使用 Expo Go 內建的 expo-camera；照片可選，找到不必拍照。

## Playtest V2

- 極簡入口、探索紙條、動態 Emoji 票根。
- 約 1–3 分鐘短路段；偏離後從新位置繼續，記住走過的路。
- Easy 開始，難度隨尋找時間調整，永遠可以換題。
- 約 8–10 分鐘開始選收尾處，15 分鐘完成；四次提早發現先放緩探索。
- 完成、收藏、分享各有獨立畫面，分享支援零照片。
- 票根與照片只存在本機；OSM / 步行路線服務需要網路。
- 首頁右上角有簡短玩法說明。探索中不提供滑回首頁；左上角 × 會先確認是否收好票根。
- 收藏、票根詳情、分享、說明與相機支援左側邊緣右滑返回。照片以堆疊翻閱，分享前可選主照片。

## 驗證

```sh
npm run typecheck
npm run lint
npm test
```

完整概念見 [Playtest 規格](docs/V2_PLAYTEST_SPEC.md)，本次設計與外測注意點見 [設計筆記](docs/POCKET_PLAYTEST.md)。
