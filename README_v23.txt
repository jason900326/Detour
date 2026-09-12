DETOUR v0.23 — ROUTE PULSE HOME

這版直接把首頁改成使用者選定的 C 方向。

互動改變：
1. 首頁不再點時間就立刻跳 Mood
2. 點 15 / 30 / 60 / 90+
3. 被選中的時間出現橘色粗框 + 小 burst
4. CTA 從灰色變橘色
5. 再按「開始 XX 分鐘 DETOUR →」
6. 才進 Mood

返回 Mood -> Home 時：
選中的時間會保留，方便直接改。

首頁視覺：
- DETOUR + SMALL DETOURS / BIGGER DAYS
- 右上 Passport 簡化成橘色 ring + 數量 badge
- Settings 改小圓形 •••
- 上半部 Route Pulse：起點、節點、Scene 圓片、終點旗幟
- 文案：
  不用先想去哪。
  先選你現在有幾分鐘，剩下交給 DETOUR。
- 4 個時間按鈕橫排
- 單一明顯 CTA

這版 Route Pulse 完全用 React Native View / Text 畫，
沒有新增圖片素材，也不需要新 npm 套件。

目的：
首頁要有「小冒險即將開始」的遊戲感，
但真正互動仍非常簡單：
選時間 -> 下一步。

安裝：
解壓到
C:\Users\jason\detour

覆蓋 src。

重開：
Ctrl + C
npx expo start -c
