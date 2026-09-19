# Detour

Detour 把現實世界變成一場 10–60 分鐘的小型探索遊戲。手機負責指路、出題與記錄；真正的遊戲畫面是使用者面前的城市。

產品決策與歷史文件的閱讀順序請先看 [`docs/README.md`](./docs/README.md)。目前產品基準是 [`PRODUCT_FOUNDATION.md`](./PRODUCT_FOUNDATION.md)，較晚且明確的主題決策會覆蓋該主題的舊內容。

## 目前狀態

- App：Expo / React Native / Expo Router
- 主要平台：iOS 優先
- Preview 更新：`main` push 後由 GitHub Actions 發布到 EAS `preview` channel
- 核心流程：時間 → Mood → 出票 → Journey → 尋找 / 拍照 → Arrival → 完成 / 收藏 / 分享
- 時間選項：10–60 分鐘，每 5 分鐘一個節點
- 尋找目標：10–15 分鐘 3 個、20–25 分鐘 5 個、30–35 分鐘 7 個、40–45 分鐘 9 個、50–60 分鐘 10 個
- 旅程時間以「已走」計時；選擇時間是規劃預算，不是截止時間

## 本機啟動

```bash
npm install
cp .env.example .env
npx expo start
```

`.env.example` 目前包含 AI / Supabase client 所需的公開設定欄位。真正的 key 不要提交到 repository。

## 常用指令

```bash
npm run start
npm run start:ipad
npm run ios
npm run android
npm run web
npm run lint
npm run typecheck
npm test
npm run quality
```

`npm run quality` 是合併前的本機快速檢查；GitHub Actions 另外會執行 iOS Expo bundle 與 Preview 發布。

## 專案結構

```text
src/
  app/                  # Expo Router route 入口
    index.tsx           # 主旅程畫面與流程 orchestration
    camera.tsx          # 相機 route
    explore.tsx         # Explore route
  components/           # Journey、相機、出票與共用 UI
  hooks/                # controller、GPS、相機與 persistence boundary
  lib/                  # 純規則、資料模型、導航、routing、Scene 與 storage
assets/
  detour/               # 正式 Detour artwork
  mood/                 # Mood SVG
```

## 架構原則

`src/app/index.tsx` 是流程協調層，不應再成為所有邏輯與資料模型的存放處。

新增功能時優先遵守：

1. **資料 model / 固定規則** 放 `src/lib`，不要宣告在畫面檔。
2. **Journey / routing / scene / AI 計算** 留在各自 engine。
3. **可重用 UI** 應逐步移到 `src/components`，不要再新增 `v50 / v51 / v52` 形式的整套複製樣式。
4. **Controller lifecycle** 放 `src/hooks`；畫面只保留 route 與 UI orchestration。
5. UI 重構必須保持既有產品行為；先拆結構，再改視覺。
6. 每次影響主要旅程的修改至少要通過 TypeScript、測試與 iOS Expo bundle，之後再合併到 `main`。

## Preview 發布

`.github/workflows/eas-update-preview.yml` 會在 `main` 有程式變更時執行：

```bash
eas update --channel preview
```

因此：

- `main` = 手機 preview 應該能玩的版本。
- 大型重構先走獨立 branch，驗證後再合併。
- EAS Update 成功代表 bundle / 發布成功，不等於完整旅程已經被自動化測試。

## 文件與決策

- [`docs/README.md`](./docs/README.md)：文件權責、閱讀順序與歷史資料規則
- [`PRODUCT_FOUNDATION.md`](./PRODUCT_FOUNDATION.md)：產品定位與跨主題基線
- [`IPAD_DEV.md`](./IPAD_DEV.md)：iPad / Codespaces / Expo Go 開發流程
- `docs/product-decisions/`：日期明確、可覆蓋單一主題的最新產品決策
- `docs/` 內的 V2 文件：目前仍在使用的 domain / import / route 參考
- `docs/releases/`：早期 `README_vXX.txt` release notes 歷史快照
- [`V039_PRODUCT_CONVERGENCE.md`](./V039_PRODUCT_CONVERGENCE.md)：歷史收斂紀錄，不是目前規則來源

新的產品或開發狀態請更新正式文件，不再新增 `README_vXX.txt` 或沒有狀態標記的根目錄說明檔。

## 開發優先順序

目前先以可實際 Playtest 的完整旅程為目標。新增功能前，優先處理：

- 真機 journey flow 的 bug
- controller / persistence / GPS / camera 邊界
- 共用 UI component 化
- 基本自動驗證
- README、架構文件與產品基準保持同步
