DETOUR v0.25.4 — RECOVERY + COMPLETE TICKET REDESIGN

這版只重做兩個還留在舊視覺語言的頁面：
Recovery / Finish。

RECOVERY — ROUTE REISSUE
- 不再是大標 + 四個設定式長按鈕
- 新增「CURRENT ROUTE / INTERRUPTED」路線事件卡
- 用 route break → ? 表示目前 Scene 失敗、即將重新派發終點
- 說明改成「已走過的路和 Side Quest 保留 → 換一個終點」
- 四個原因改成 2 x 2 adventure choice cards
- 每張卡有編號、符號、原因與簡短語意
- replacement loading 會顯示成重新派發狀態卡
- Light / Dark 都有完整對比

FINISH — COMPLETED TICKET
- 移除舊版「大字 + 三欄資料」完成頁語言
- 改成和前面的 Ticket Flow 同一套完成憑證
- YOU MADE A DETOUR
- DETOUR / COMPLETED
- DONE stamp
- 完整 route graphic
- DESTINATION
- TIME / SIDE QUESTS / FILM
- ticket barcode + serial
- 有照片時顯示 DEVELOPED FRAMES
- 次要 CTA：打開這張 Postcard
- 主 CTA：完成 · 回首頁
- Light / Dark 都有獨立對比

其他頁面、Engine、routing、Passport 都沒有改。

安裝：
解壓到
C:\Users\jason\detour

覆蓋 src。

重開：
Ctrl + C
npx expo start -c
