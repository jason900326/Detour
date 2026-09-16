DETOUR v0.28.2 — REMOVE ENGINE REVIEW

移除開發者人工 Engine Review：
- sceneReview stage
- ENGINE REVIEW UI
- 候選 Scene 人工切換
- 開發者「想去 / 普通 / 太熟 / 現在不想去」評分
- 相關 state / functions / styles

保留 Scene feedback infrastructure 與 Recovery 回饋，
因為真實使用者在旅程中的換終點原因仍有統計價值。

之後 Scene 品質改用真實測試數據判斷：
- 完成率
- 到達率
- 換終點率
- 「不值得」比例
- Scene kind 成功率
- Mood / 時間長度成功率

安裝：
解壓到 C:\Users\jason\detour
覆蓋 src

重開：
Ctrl + C
npx expo start -c
