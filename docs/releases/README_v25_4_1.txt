DETOUR v0.25.4.1 — FIXED COLOR RULE

修正上一版誤加回來的 system Dark variants。

正確視覺規則：
- Recovery：米白
- Finish：米白
- 首頁 / Mood / Ticket / Ready / Arrival / Passport / Settings：維持各自原本米白設計
- 不再因為 iPhone 系統是 Dark Mode，就把這些頁面自動反黑
- 導航流程原本的深色視覺保留，不受系統 Appearance 控制

這版保留 v0.25.4 新做的 Recovery / Finish 版型，只拿掉錯誤的 systemDark 套色。

安裝：
C:\Users\jason\detour
覆蓋 src

Ctrl + C
npx expo start -c
