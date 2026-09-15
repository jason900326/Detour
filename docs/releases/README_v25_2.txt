DETOUR v0.25.2 — FINISH + TEST MODE CLEANUP

修正：

1. 移除首頁左上 DETOUR 的長按 Indoor Test 隱藏入口
- Indoor Test 只能從 Settings 開 / 關
- 不再因為長按品牌文字意外切換測試模式

2. 完成頁 CTA
- 「再繞一次」改成「回首頁」
- 完成一趟就是收尾，不會暗示使用者立刻再玩一次
- 回首頁會走原本 resetDetour 流程，清掉本次暫存狀態

3. 完成頁左上 ✓
- 移除沒有互動、沒有資訊價值的完成勾勾
- MAIN QUEST COMPLETE 文字本身已經足夠表達完成狀態

沒有改 Engine / routing / Ticket / Passport。

安裝：
解壓到
C:\Users\jason\detour

覆蓋 src。

重開：
Ctrl + C
npx expo start -c
