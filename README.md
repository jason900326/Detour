# Detour

不知道要幹嘛時，可以立刻開始的一場約 10 分鐘小探險。

按「去繞一下」→ 帶著探索紙條走 → 找到了，Emoji 留在票上 → 從現在的位置繼續 → 收好這趟的意外。

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
- 開發版「設定 → 室內試玩」可不使用定位測完整流程。試玩票有明確標示。

## 驗證

```sh
npm run typecheck
npm run lint
npm test
```

完整概念見 [Playtest 規格](docs/V2_PLAYTEST_SPEC.md)，本次設計與外測注意點見 [設計筆記](docs/POCKET_PLAYTEST.md)。
