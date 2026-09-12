DETOUR v0.16.2 — SIDE QUEST UI CLEANUP

這版只整理 Side Quest，Main Quest 不動。

移除：
- 03 / 03 任務計數
- MAIN QUEST PAUSED
- BEAT X REACHED
- 獨立大區塊「完成條件」
- PHOTO OPTIONAL / PHOTO REQUIRED 標籤
- 多餘分隔線與系統狀態

現在 Side Quest 只留下：
- 任務代號
- 任務本身
- 一句說明
- 一行「完成：...」
- 完成按鈕
- 非攝影任務旁邊的小相機
- 必拍任務的「找不到，跳過」

目標：
使用者進來不用理解系統，只要知道「現在做什麼」。

不需要新 npm 套件。

解壓縮到：
C:\Users\jason\detour

覆蓋：
src\app\index.tsx

建議：
Ctrl + C
npx expo start -c
