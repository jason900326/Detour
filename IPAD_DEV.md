# iPad + Expo Go 開發流程

這份流程是給「只帶 iPad 出門」時使用。開發主機改用 GitHub Codespaces，iPad 只需要 Safari + Expo Go。

## 出門前先做一次

1. 在 GitHub 打開 `jason900326/Detour`。
2. `Code` → `Codespaces` → `New with options`。
3. Branch 選 `main`。
4. 如果畫面要求 Codespaces secrets，請把你電腦本機 `.env` 裡對應的值填入：
   - `EXPO_PUBLIC_DETOUR_AI_URL`
   - `EXPO_PUBLIC_DETOUR_SCENE_URL`
   - `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
5. 建立 Codespace。第一次建立會自動跑 `npm ci`，並安裝 Expo tunnel 需要的 `@expo/ngrok`。

## iPad 上開始開發

Codespace 開好後，在 Terminal 執行：

```bash
npx expo login
npm run start:ipad
```

`start:ipad` 等同於：

```bash
expo start --go --tunnel --clear
```

Tunnel 可以讓 Expo Go 不必跟 Codespace 在同一個區域網路。

## 在同一台 iPad 開 Expo Go

最方便的方式：Codespace 與 Expo Go 登入同一個 Expo 帳號，然後在 Expo Go 的 Projects 裡打開 Detour。

如果沒有出現在 Projects：

1. 回到 Codespace Terminal。
2. 找到 Expo 顯示的 `exp://...` tunnel URL。
3. 複製連結，在 Safari 開啟，讓 iPad 交給 Expo Go 開啟。

## 修改與儲存

在 Codespaces 編輯檔案並儲存後，Expo Go 會自動 reload。Tunnel 比本機 LAN 慢是正常的。

## 今天外出修改時不要直接在 main 工作

每次開始一輪修改，先建立自己的 branch：

```bash
git switch -c ipad/<簡短名稱>
```

完成後：

```bash
git add -A
git commit -m "你的修改說明"
git push -u origin HEAD
```

這樣即使 iPad 斷線或 Codespace 關閉，修改也已經保存在 GitHub，不會重演本機素材被覆蓋的問題。

## 常用指令

```bash
npm run start:ipad   # Expo Go + tunnel + clear cache
npm run typecheck    # TypeScript 檢查
git status           # 修改前後都先看一次
```
