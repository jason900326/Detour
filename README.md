# Detour

Detour 把現實世界變成一場 10–60 分鐘的小型探索遊戲。手機負責指路、出題與記錄；真正的遊戲畫面是使用者面前的城市。

產品決策的正式基準請先看 [`PRODUCT_FOUNDATION.md`](./PRODUCT_FOUNDATION.md)。

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
npm run ios
npm run android
npm run web
npm run lint
npm run typecheck
```

## 專案結構

```text
src/
  app/
    index.tsx          # 主旅程畫面與流程 orchestration
    camera.tsx         # 相機、鏡頭切換、拍攝與照片確認
    explore.tsx        # Explore route
  lib/
    app-model.ts       # App stage、session / passport model、固定 UI flow constants
    journey-engine.ts  # Journey / Mood / 任務規則
    navigation-engine.ts
    routing-engine.ts
    scene-engine.ts
    ai-engine.ts
    playtest-analytics.ts
    scene-feedback.ts
assets/
  detour/              # 正式 Detour artwork
  mood/                # Mood SVG
```

## 架構原則

`src/app/index.tsx` 是流程協調層，不應再成為所有邏輯與資料模型的存放處。

新增功能時優先遵守：

1. **資料 model / 固定規則** 放 `src/lib`，不要宣告在畫面檔。
2. **Journey / routing / scene / AI 計算** 留在各自 engine。
3. **可重用 UI** 應逐步移到 `src/components`，不要再新增 `v50 / v51 / v52` 形式的整套複製樣式。
4. UI 重構必須保持既有產品行為；先拆結構，再改視覺。
5. 每次影響主要旅程的修改至少要通過 TypeScript typecheck 與 iOS Expo bundle，之後再合併到 `main`。

## Preview 發布

`.github/workflows/eas-update-preview.yml` 會在 `main` 有程式變更時執行：

```bash
eas update --channel preview
```

因此：

- `main` = 手機 preview 應該能玩的版本。
- 大型重構先走獨立 branch，驗證後再合併。
- EAS Update 成功代表 bundle / 發布成功，不等於完整旅程已經被自動化測試。

## 文件整理方式

- `README.md`：目前專案入口與開發方式（唯一主 README）
- `PRODUCT_FOUNDATION.md`：產品決策與體驗基準
- `docs/releases/`：舊版 `README_vXX.txt` release notes / 交付說明歸檔
- `V039_PRODUCT_CONVERGENCE.md`：特定產品收斂紀錄
- `IPAD_DEV.md`：iPad 開發環境說明

舊版 release notes 不再放在 repository 根目錄；歷史檔名保留，方便追溯當時版本內容。

## 開發優先順序

目前先以可實際 Playtest 的完整旅程為目標。新增功能前，優先處理：

- 真機 journey flow 的 bug
- `index.tsx` 拆分
- 共用 UI component 化
- 基本自動驗證
- README / 架構文件與產品基準保持同步
