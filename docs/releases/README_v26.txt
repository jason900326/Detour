DETOUR v0.26 — QUEST PULSE

這版不擴功能，只補 Main Quest 的遊戲回饋。

- 距離下一個節點 <= 25m：
  箭頭與距離轉成橘色。
- 一般節點：
  短震動後無縫切到下一段。
- Side Quest 節點：
  顯示 SIDE QUEST FOUND / 路上有事發生了。
  約 0.6 秒後進任務。
- 最後節點：
  顯示 FINAL NODE / 主線到站。
  約 0.7 秒後進 Arrival。
- 增加 checkpoint lock，避免 GPS 在節點附近重複觸發同一任務。

沒有 XP、沒有進度條、沒有 Beat 數量。
Main Quest 仍維持黑色極簡導航。

安裝：
解壓到
C:\Users\jason\detour
覆蓋 src。

重開：
Ctrl + C
npx expo start -c
