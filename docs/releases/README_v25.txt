DETOUR v0.25 — TICKET = REAL ROUTE

這版修正 Ticket Flow 的語意斷裂。

舊流程：
Mood
→ 假裝印車票
→ ROUTE LOCKED
→ 使用車票
→ 「正在找一條真的走得通的路」
→ Main Quest

新流程：
Mood
→ 印製車票
   同時真的做：
   1. 要求 foreground location
   2. 取得現在位置
   3. 判斷 DAY / TWILIGHT / NIGHT
   4. 抓真實 Scene candidates
   5. 選 Scene
   6. 算真實 walking route
   7. 產生 missions
   8. 建 navigation beats
→ 上面全部成功，才發行 READY 車票
→ 拿票上路
→ 直接 Main Quest

所以現在：
ROUTE LOCKED 真的代表 route locked。

已移除：
「正在找一條真的走得通的路」畫面。

如果印車票期間：
- 定位權限沒開
- Scene 找不到
- routing 失敗
- 路線不適合

車票不會假裝成功。
會直接回 Mood，並告訴使用者這張票暫時印不出來。

計時：
實際 DETOUR duration 從「拿票上路」那一刻才開始，
不是從印車票開始算。

Indoor Test：
同樣先用真實位置、Scene、walking route 印票，
拿票後才用按鈕模擬移動。

沒有新增 npm 套件。

安裝：
解壓到
C:\Users\jason\detour

覆蓋 src。

重開：
Ctrl + C
npx expo start -c
