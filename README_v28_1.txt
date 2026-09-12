DETOUR v0.28.1 — SIDE QUEST RETURN CLEANUP

修正使用者回饋：

1. Side Quest 主 CTA 不再是黑色
「完成這個 Side Quest」現在：
- 米白底
- 黑字
- 黑色細框
- 橘色箭頭

它仍然是主 CTA，但不會在整套米白系統裡突然出現一大塊黑色。

拍照按鈕維持米白 + 細框，因此底部兩個 action 現在屬於同一套視覺語言。

2. 移除 EVENT CLEARED / 回到主線
按完成後：
- 保留成功震動
- 不顯示任何「完成」中繼畫面
- 直接使用既有 transitionTo 動畫：
  Side Quest 淡出 / 微位移
  -> Main Quest 淡入

跳過 required-photo Side Quest 也採相同處理：
不再顯示 EVENT SKIPPED。

如果該 Side Quest 剛好是最後一個導航節點，
則同樣用 transition 動畫直接接 Arrival。

沒有改：
- 任務內容
- Scene Engine
- Routing
- Navigation thresholds
- Arrival
- Passport

不需要新 npm 套件。

安裝：
解壓到
C:\Users\jason\detour
覆蓋 src。

重開：
Ctrl + C
npx expo start -c
