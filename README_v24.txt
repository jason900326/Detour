DETOUR v0.24 — TICKET FLOW

首頁 Route Pulse 保留。
這版重做首頁之後的 Mood -> Preparing -> Ready。

1. MOOD
- 不再點了就直接跳走
- 2x2 + 1 張全寬選擇卡
- 選中後橘框
- 每個 Mood 有簡短「這趟會是什麼感覺」
- CTA：印製這趟 DETOUR 車票

2. PREPARING
- 改成真正的 Ticket Printing 儀式
- 顯示：
  TIME
  MOOD
  TICKET SERIAL
  ROUTE GENERATING
  barcode
- 橘色 Route line 逐步生成
- 底部 printing progress
- 約 2 秒後自動進 READY

3. READY
- 完整 DETOUR Ticket
- TIME / MOOD / START
- HIGHLIGHTS：
  1 條隱藏主線
  N 個支線任務
  1 個抵達任務
  終點保密
- ROUTE LOCKED 印章
- CTA：使用這張票開始 DETOUR

4. BACK
- 從 Ready 返回 Mood 時保留已選 Mood
- 從 Mood 返回首頁保留已選時間

沒有新增 npm 套件。
沒有動 Engine / routing / Passport 功能。

解壓到：
C:\Users\jason\detour

覆蓋 src。

完整重啟：
Ctrl + C
npx expo start -c
