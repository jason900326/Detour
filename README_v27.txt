DETOUR v0.27 — FIELD EVENT

這版不加 Engine 功能，專門把 Side Quest / Arrival 接進目前的視覺世界。

顏色規則：
- Main Quest 導航：黑色
- Side Quest：米白
- Arrival：米白
- Recovery / Finish / Passport / Settings：米白
- Camera / 顯影流程維持自己的深色操作畫面

SIDE QUEST
- 黑色導航中的 SIDE QUEST FOUND pulse 結束後
- 切到米白 FIELD EVENT 頁
- 上方用 route strip 表示：
  Main Quest -> Side Quest -> Main Quest continues
- 任務內容改成：
  SIDE QUEST / title / instruction / CLEAR CONDITION
- 完成後短暫出現：
  EVENT CLEARED
  回到主線。
- 跳過 required-photo 任務則顯示：
  EVENT SKIPPED
  沒關係，繼續走。
- 約 0.5 秒後回黑色導航

ARRIVAL
- 加入 route -> flag 的 Destination Revealed strip
- Kicker 改成 MAIN QUEST · ARRIVAL
- 保持目的地名稱、最終任務與 Recovery 功能不變

沒有新增 npm 套件。
沒有改 Scene / routing / mission selection。

安裝：
解壓到
C:\Users\jason\detour
覆蓋 src。

重開：
Ctrl + C
npx expo start -c
