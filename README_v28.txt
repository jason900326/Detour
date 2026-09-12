DETOUR v0.28 — UNIFIED ROUTE SURFACE

這版把 Main Quest 導航也改成米白色，
讓整個 DETOUR 主流程使用同一個世界。

新的色彩規則：

米白主流程：
- Home
- Mood
- Ticket / Ready
- Main Quest
- Side Quest / Field Event
- Arrival
- Recovery
- Finish
- Passport
- Settings

深色只保留真正像「器材操作」的畫面：
- Camera
- Developing
- Scene Review prototype screen

Main Quest 改動：
- 背景：黑 -> 米白
- 關閉、DETOUR、距離、指示文字：改黑字
- 方向箭頭仍然維持橘色
- <= 25m 時仍用橘色 proximity state
- hint 改成較深灰，保持清楚可讀
- Camera button 改米白 + 細框
- Indoor Test bar 改成和米白系統一致
- 小段地圖外框改成米白系統的 LINE

Quest Pulse：
- SIDE QUEST FOUND / FINAL NODE
- 背景也改成米白
- 橘色節點 + 黑字
- 所以 Main Quest -> Pulse -> Field Event 不再整頁黑白閃換

目的：
導航感不再靠「整頁黑色」，
改靠橘色 route / arrow / node、距離、震動和事件節奏。

沒有改：
- Scene Engine
- routing
- mission selection
- navigation thresholds
- Passport data
- Recovery logic

不新增 npm 套件。

安裝：
解壓到
C:\Users\jason\detour
覆蓋 src。

重開：
Ctrl + C
npx expo start -c
